# Link-only access: remove localStorage-driven identity and personalization

## Context

Access to a group is already gated by a share-token → httpOnly session cookie
exchange (`GET /g/{token}` → `signSession({groupId, role, shareLinkId})`),
re-validated against `revoked_at` on every request. That mechanism is not
driven by localStorage and needs no change.

What *is* driven by localStorage today (`src/lib/device-identity.ts`) is a
personalization layer on top: which member you claimed in a group (via a
`/join` screen), a "returning device" landing-page variant, a multi-group
switcher, and a "you" marker rendered next to your claimed member everywhere.
This is the layer the user wants gone — partly because it adds a claim/join
step between the link and the group, and partly because it makes the landing
page show two different things depending on device history, which the user
wants simplified to one clean marketing page.

Confirmed with the user (in order):
1. Opening a link should go **straight into the group** — no join/claim
   screen at all.
2. The "Sarah (you)" marker is **dropped entirely**, not replaced by another
   identity mechanism. There is no per-viewer identity anywhere anymore.
3. The landing page becomes a **single page** for everyone — no
   returning-device variant, no group switcher.
4. The **cookie-exchange mechanism stays** as the access-control mechanism
   (it already satisfies "purely controlled by the link"); only the
   localStorage personalization layer is removed. Putting the raw token in
   the URL on every request was explicitly rejected — it would violate
   CLAUDE.md rule 8 (share tokens must never sit in the address bar).
5. Since removing localStorage means there's no device-side fallback if you
   navigate away without saving the link, add a **one-time "save this link"
   reminder** with a copy button, shown to both editor and viewer sessions
   once per link-open (see "Save-link reminder" below).

## Save-link reminder (new)

Removing localStorage creates a real gap: the session cookie only ever holds
**one group at a time** (`SESSION_COOKIE_NAME`, one value), so anyone who
belongs to more than one group on the same device can no longer "just revisit
the site" to switch back — each group now requires reopening its original
link, every time, forever. There is also no more device-side fallback if
cookies are cleared or a different browser/device is used.

**Rejected: a `beforeunload` "are you sure you want to leave" dialog.** Modern
browsers ignore any custom message on `beforeunload` and show only a generic
"Leave site?" prompt, so it wouldn't actually convey "save your link." It's
also unreliable on mobile (doesn't fire on tab close/app switch in most
mobile browsers) and is the kind of intrusive native dialog this app
otherwise avoids.

**Chosen approach:** a one-time, dismissible banner shown the first time a
visitor lands in the group after opening their link, with a **Copy link**
button. Shown for both `editor` and `viewer` sessions equally — both are
equally affected by the loss of localStorage, and viewers have no other
in-app way to see their own link (`ShareDialog` stays editor-only).

Mechanism, no new persistent client storage required:
- `GET /g/{token}` (`src/app/g/[groupId]/route.ts`) redirects to
  `/g/{groupId}/events?savelink={token}` instead of a bare `/g/{groupId}/events`
  — a one-time, one-render carry of the token, not a persistent address-bar
  exposure (CLAUDE.md rule 8 is about the token never *sitting* in the URL;
  this value is read and stripped within the same client-side render pass,
  before the user can screenshot or bookmark it).
- `EventsListView` (the universal landing screen after any link open) reads
  `savelink` from the URL on mount, shows the banner if present, and
  immediately calls `router.replace` to strip the query param from the URL
  bar — so a page refresh, back-navigation, or re-visit never shows it again.
  This makes "once per visit" fall out naturally from the one-time query
  param, with no sessionStorage or other new storage needed.
- The banner's Copy button copies `${origin}/g/{token}` (the full, original
  invite link — the only thing that grants access from a different browser
  or device) to the clipboard via `navigator.clipboard.writeText`.
- Dismissing the banner just hides it (local component state); the query
  param is already stripped either way.

## Architecture

No change to the auth mechanism itself:
- `GET /g/{token}` (`src/app/g/[groupId]/route.ts`) still looks up
  `GroupShareLink` by token, checks `revokedAt`, signs the same
  `{groupId, role, shareLinkId}` session cookie, and 303-redirects to a clean
  URL. **The only change**: the redirect destination becomes
  `/g/{groupId}/events` instead of `/g/{groupId}/join`.
- `requireSession()` (`src/lib/auth/require-session.ts`), the two link roles
  (`editor`/`viewer`), link creation/regeneration/listing
  (`src/app/api/groups/[id]/links/*`), and every existing server-side role
  check are unchanged.
- Adding a member to a group/event (`AddMemberModal.tsx`,
  `POST /api/events/[id]/members`, `POST /api/groups/[id]/members`) is
  unchanged — it never went through claim or localStorage.

## Removed entirely

- `src/app/g/[groupId]/join/` route/page and `src/components/join/JoinScreen.tsx`
- `POST /api/groups/[id]/claim` (`src/app/api/groups/[id]/claim/route.ts`)
- `src/lib/device-identity.ts` and all its imports/usages
- `src/components/group/GroupSwitcher.tsx`
- `src/components/landing/LandingGate.tsx` and
  `src/components/landing/ReturningDeviceLanding.tsx`

## Changed components

- **`src/app/page.tsx`**: renders `ColdVisitorLanding` directly, renamed to
  `Landing` (the "cold" qualifier no longer makes sense once there is no
  "returning device" counterpart) — no gate, no localStorage read. This
  component already has the desired shape (hero, "Create a group",
  "I have an invite link" → `PasteLinkPanel`, `/tutorial` link); it just
  becomes the only landing view instead of one of two.
- **`src/components/group/CreateGroupModal.tsx`**: stops calling
  `saveDeviceIdentity`; redirects straight into the new group like any other
  link entry.
- **`src/components/group/GroupHeader.tsx`**: drops the personal avatar (was
  read from `device-identity`) and drops `GroupSwitcher`. Becomes just logo +
  group name + theme toggle. (`ShareDialog.tsx` is opened from
  `EventDashboard.tsx`, not the header — unaffected by this change; link
  creation/regeneration stays as-is.)
- **`src/components/members/MemberChip.tsx`, `src/components/settle/SettleUpFlow.tsx`,
  `src/components/settle/TransferGraph.tsx`, `src/components/bills/BillForm.tsx`**:
  remove all `viewerMemberId`/"(you)" comparison logic. Members render as
  plain names everywhere (`"Sarah owes RM 158.30"`, not
  `"Sarah (you) owes..."`). `BillForm`'s payer/participant pickers lose their
  "defaults to you" pre-selection and become plain lists with no default.
- Note the distinct, **unaffected** concept: `viewerRole` (`"editor" |
  "viewer"`, from the session) still gates UI (e.g. hiding "Mark as settled"
  for viewer sessions) exactly as today — only the *"which member is you"*
  identity concept (`viewerMemberId`) is removed. These were always separate
  even though both used the word "viewer."

## Docs updates

- **CLAUDE.md rule 5** is rewritten (not merely relaxed): since no per-viewer
  identity is tracked anywhere, there is nothing ambiguous to disambiguate.
  New wording: member names are shown plainly and identically to every viewer
  of a link — no "you" marker exists because no per-viewer identity is
  tracked.
- **`docs/data-model.md`** / **`docs/system-design.md`**: remove references to
  the join/claim screen and device identity from the access-flow description;
  update the token-exchange redirect target.
- **Screen Spec**: P2-04 (join screen) and P1-02 (returning-device landing)
  entries are marked removed/superseded.

## Edge cases

- **Multiple people on the same link**: unaffected — role/access was never
  per-device.
- **Same browser, two different group links**: a single session cookie
  already meant only one active group per browser at a time — that part is
  unchanged. What's new is there's no longer any in-app switcher or cached
  token to fall back on, so switching back to another group now strictly
  requires reopening that group's original link. The save-link reminder
  (above) is the mitigation: it nudges everyone to keep their link somewhere
  (bookmark, notes app, the chat thread it came from) at the moment they'd
  most plausibly act on it.
- **Revoked/invalid link**: unchanged — same generic 404 message
  ("This link is invalid or has been revoked.").
- **Existing test data with previously-claimed members**: no schema or data
  migration needed. `Member` has no "claimed by" flag; `saveDeviceIdentity`
  was purely client-side state.

## Testing

- No change to the settlement engine or currency logic — existing Vitest
  suites are unaffected.
- Manual browser pass: fresh (no localStorage) visit to an editor link lands
  directly on the events dashboard with edit access; fresh visit to a viewer
  link lands read-only with mutating actions hidden and server-rejected;
  `/g/{groupId}/join` and `POST /api/groups/[id]/claim` return 404; `/` shows
  the single marketing landing regardless of prior visits; no "(you)" marker
  or personal avatar renders anywhere; opening a link shows the save-link
  banner exactly once, the `savelink` query param never persists past the
  first render (check via view-source / URL bar after the banner appears),
  and Copy link puts the full original link on the clipboard for both editor
  and viewer sessions.
- No new automated tests are required for this change (routing/UI removal,
  not new business logic).
