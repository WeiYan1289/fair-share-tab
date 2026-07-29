# Password reset — design proposal

**Status: proposal only. No code, no migration, no dependency added.**

## Context

Member login/registration shipped (PR #3, commits 84a03cc/80feb5a/5c275f5),
but there is no way to recover a forgotten password. A registered member who
forgets their password is locked out of every group they created or
converted from a visitor group, permanently — the only account artifact left
behind is their `user.email`, which they can no longer authenticate with.
`docs/data-model.md` §11 and `docs/system-design.md` both list password
reset as explicitly out of scope for v1, so this is new ground, not a gap in
existing docs.

There is currently no email-sending capability anywhere in the repo — no
dependency, no env var, no code. `member.email` is stored "for invites" but
never used to send anything (`AddMemberModal.tsx`). Adding password reset
therefore means adding the app's first outbound email integration, which is
why this proposal spends real space on comparing providers rather than
assuming one.

This document specifies the schema, the flow, a security problem the
existing session design creates for any reset feature, and a provider
recommendation — so the feature can be built later without re-deriving any
of this.

## Schema

One new table, following the project's existing migration conventions
(`snake_case` columns, `@map`, UUID PKs):

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_token")
}
```

**The token is stored as a SHA-256 hash, never in the clear.** This is a
deliberate departure from `GroupShareLink`, which stores its `token` raw —
and the difference is not an inconsistency, it's the point. A share link is
a *capability*: it's designed to be held by many people simultaneously, and
revocation is "flip `revoked_at`," not "the token must never have been
readable." A password reset token is a *credential* for exactly one
person's account recovery, structurally closer to `passwordHash` than to a
share link — the same reasoning that makes storing passwords hashed rather
than plain applies here. If the `password_reset_token` table ever leaked
(a backup, a read-replica misconfiguration, a logging accident), raw tokens
would let an attacker take over every account with a pending reset email;
hashed tokens would not.

Token generation reuses `generateShareToken` from `src/lib/auth/token.ts`
(unbiased base62, CSPRNG-backed) at **32 bytes**, i.e. call it as
`generateShareToken(32)` — wider than the share-link default, since this
token is a bearer credential for account takeover, not a lookup key gated
behind rate limiting alone.

## Flow

**`POST /api/auth/forgot`** — body `{ email }`.

- Rate limited on both IP and the submitted email (two separate
  `isRateLimited` keys, following the `rate-limit.ts` pattern already used
  for `auth-login`/`auth-register`).
- Looks up the user by email. **Always returns a generic 200** — something
  like "If an account exists for that email, we've sent a reset link" —
  regardless of whether the email matched, mirroring the anti-enumeration
  stance `login/route.ts` already takes with `getDummyHash()`. The lookup
  still runs in both branches so response timing doesn't leak the answer
  either.
- On a match: generate the token, hash it, insert a `PasswordResetToken`
  row with `expiresAt = now + 30 minutes`, and send the email via the
  `Mailer` interface below with a link to
  `{APP_URL}/reset?token={rawToken}`.

**`GET /reset?token=...`** — a plain page rendering an email/password-style
form (new-password + confirm). Doesn't validate the token server-side on
this GET beyond presence — validation happens on submit, since there's no
session to protect and revealing "token invalid" before submission tells an
attacker nothing they couldn't infer from the flow's existence.

**`POST /api/auth/reset`** — body `{ token, newPassword }`.

- Hash the submitted token, look up a matching `PasswordResetToken` where
  `usedAt IS NULL AND expiresAt > now()`. Not found → generic 400 ("This
  link is invalid or has expired — request a new one").
- In one transaction: rehash `newPassword` with the existing Argon2id
  parameters from `src/lib/auth/password.ts` (unchanged — this proposal
  doesn't touch hashing config), update `user.passwordHash`, set
  `usedAt = now()` on the token used, and invalidate every *other*
  outstanding token for that `userId` (set their `usedAt` too, or delete
  them) — a stale second reset email from an earlier request shouldn't
  remain valid after a successful reset.
- On success, do **not** automatically sign the browser in. Redirect to
  `/login` with a "Password updated — log in with your new password"
  message. Auto-login here would mean the token itself grants a full
  session, widening what a leaked-in-transit link can do.

## The session-invalidation problem

**This is the part of the feature most likely to be built wrong, so it's
called out explicitly rather than left implicit in the flow above.**

`fst_user_session` (`src/lib/auth/session.ts`) is a stateless HMAC-signed
cookie with a **1-year `maxAge`** and, per `require-user-session.ts`, **no
per-request revocation check** — unlike `fst_session` (the group-context
cookie), which re-validates its underlying `GroupShareLink`/`GroupMembership`
row against the database on every single request. This asymmetry is
intentional today (`fst_user_session` only needs to answer "is there a
`userId`", not "is this specific grant still valid"), but it means:

**A password reset does not invalidate any session cookie an attacker
already holds.** If someone's password was compromised and their session
cookie was *also* captured (a shared device, a stolen browser profile, a
leaked cookie via XSS), resetting the password locks out future logins but
does nothing to the session already sitting in the attacker's browser —
which can keep making authenticated requests indefinitely, `maxAge: 1 year`
worth of them. This defeats a large part of why password reset exists as a
security feature in the first place: "I think someone else has my
password" should end with the user certain no one else has access, and
today it wouldn't.

**Required fix, to ship alongside password reset, not after it:**

1. Add `passwordChangedAt DateTime? @map("password_changed_at")` to `User`,
   set whenever `passwordHash` changes (both this feature and any future
   "change password while logged in" feature).
2. Include it in the signed `UserSessionPayload` at login time — or,
   simpler and self-correcting, don't put it in the payload at all and
   instead have `requireUserSession()` re-fetch `user.passwordChangedAt`
   and compare it against a `issuedAt` timestamp already in the payload,
   rejecting the session if the password changed after the session was
   issued. The second approach costs one extra query per request (same
   trade-off `requireSession()` already makes for the group cookie) but
   means a session invalidates itself the instant it's stale, with no
   dependency on the payload carrying data that could itself go stale.
3. Either way, this makes `requireUserSession()` a DB-backed check like
   `requireSession()` already is, closing the asymmetry rather than adding
   a special case just for reset.

Without this, "reset your password" is cosmetic against an attacker who
already has a session — worth building right the first time rather than
patching in later as a follow-up incident response.

## Free email providers

| Provider | Free tier | Notes |
|---|---|---|
| **Resend** (recommended) | 3,000/mo, 100/day | Best developer experience of the group, a clean TypeScript SDK, runs fine on Vercel's Node runtime (the deployment target per CLAUDE.md). `onboarding@resend.dev` works as a sender with zero domain setup, so the whole flow is testable in dev before any domain/DNS work exists. One small dependency (`resend`). |
| Brevo | 300/day (~9,000/mo) | Highest raw volume on the free tier, but deliverability in practice needs a verified sending domain (SPF/DKIM) — more upfront setup than Resend for the same eventual outcome. |
| MailerSend | 3,000/mo | Comparable ceiling to Resend; onboarding is a bit heavier (domain verification pushed earlier in the flow). |
| SMTP2GO | 1,000/mo | Plain SMTP — works with any mail library, no vendor SDK lock-in, but lowest free ceiling here and no first-party TypeScript client. |
| Amazon SES | not free (~$0.10/1,000) | Cheapest at real scale, but heaviest initial setup (IAM, sandbox-mode approval, domain verification before any mail is deliverable) — disproportionate for a feature that, for this app's likely volume, may never leave the free tier of the alternatives. |
| Supabase Auth's built-in email | included with Supabase | **Not recommended, despite being "free" and already provisioned.** The project uses Supabase strictly as a Postgres host — `docs/system-design.md` is explicit that RLS and `auth.uid()` are not used, and CLAUDE.md rule 7 keeps all access server-side through custom Argon2id/`GroupMembership` logic. Adopting Supabase Auth's mailer would mean adopting Supabase Auth's user model alongside it, which conflicts with the `member`/`user` separation this app was deliberately built around (CLAUDE.md rule 6) — a much larger and unrelated migration bundled into what should be a small feature. |

**Gmail SMTP is not on this list on purpose.** Sending application/transactional
mail through a personal or Workspace Gmail account violates Google's terms
for that use case, and Google actively rate-limits and blocks it — it isn't
a viable option even for a low-volume app like this one, free or not.

**Recommendation: Resend.** Best DX-to-setup ratio, works without any DNS
changes for development, and stays comfortably within its free tier for
this app's plausible reset-email volume for a long time.

## Interface, so the flow is testable before a provider exists

```ts
// src/lib/mail/mailer.ts
export interface Mailer {
  send(input: { to: string; subject: string; html: string; text: string }): Promise<void>;
}
```

A `ConsoleMailer` implementation (logs the email instead of sending it)
lets `/api/auth/forgot` and `/api/auth/reset` be built, exercised, and
manually tested end-to-end in development with zero external dependency or
API key — the `ResendMailer` implementation drops in later as a pure swap,
selected by an env var so nothing in the route handlers needs to know which
transport is active.

**New env vars**, to add to `.env.local` and `docs/README.md`'s (currently
stale — see backlog item #11 in the parent plan) setup section when this
ships:

```
RESEND_API_KEY=
EMAIL_FROM=
APP_URL=
```

## Explicitly out of scope here (unchanged from data-model.md §11)

Email verification at registration, OAuth/social login, and "log out all
other sessions" as a standalone user-facing feature (though the
`passwordChangedAt` mechanism above is most of the plumbing that last one
would need, should it get built).
