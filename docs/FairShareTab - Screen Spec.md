# FairShareTab — Screen Spec

Build-detail companion to `FairShareTab - Mockups.dc.html`. Screen IDs (e.g. `P2-01`) are the link between the two files — find the ID here, find the same ID as a quiet caption above its mockup there.

**Display rule — member names:** no per-viewer identity is tracked (CLAUDE.md rule 5) — every member renders as their plain name, identically for anyone with the link. Screenshots of any screen must read correctly to someone who isn't the viewer.

## Part 0 — Foundations
Brand, tokens, and component primitives. Reference only — not routed screens.

### P0-01 — Brand & logo lockups
Reference only — not a routed screen.

### P0-02 — Color tokens
Reference only — not a routed screen.

### P0-03 — Typography
Reference only — not a routed screen.

### P0-04 — Radii & shadows
Reference only — not a routed screen.

### P0-05 — Component primitives
Reference only — not a routed screen.

## Part 1 — Landing
The app root, shown identically to every visitor regardless of prior visits.

### P1-01 — Landing
- **Route:** App root, /
- **Entered from:** a bare visit to the app root.
- **Exits to:** P1-03 (I have an invite link) or the Create-group modal (P2-01).
- **Data read:** None — static marketing content plus the transfer-graph illustration
- **Actions → writes:** Create a group → opens the create-group modal (P2-01). I have an invite link → expands P1-03 inline.
- **States:** Default only
- **Notes:** The only landing view — shown to every visitor regardless of device history. Access to a group is granted purely by opening its link; there is no returning-device variant and no join/claim step.

### P1-03 — Paste-link state — valid / invalid
- **Route:** Inline expansion of P1-01 — no dedicated path
- **Entered from:** P1-01 I have an invite link.
- **Exits to:** the group's events list (P3-02) on a valid link, or stays open with an inline error on an invalid one.
- **Data read:** None until submitted; the pasted string is validated client-side against the expected link shape
- **Actions → writes:** Continue → validates the pasted link and navigates straight into the group, or shows the inline error state shown here.
- **States:** Empty / valid / invalid (shown)
- **Notes:** Same link format as everywhere else in the app — the link itself is the credential, no separate code entry.

## Part 2 — Entry & access
How a group comes to exist and how someone gets into it via a share link.

### P2-01 — Create group (cross-reference)
- **Route:** Modal, no dedicated path — opened from the landing page's Create a group button
- **Entered from:** P1-01 Landing.
- **Exits to:** P3-02 Events list (new, empty group) on Create, or back to P1-01 on Cancel.
- **Data read:** None — blank form
- **Actions → writes:** Create group → writes a new Group{name} and its first Member{creatorName}, plus an editor share link. Cancel → discards, no write.
- **States:** Default only
- **Notes:** See P1-01 for the actual mockup; not duplicated here. Also shown: a one-line reminder of what "owned" means for this group — path-specific copy (asMember vs. anonymous), see the create-group modal in the app for exact wording.

### P2-02 — Share dialog
- **Route:** Modal (desktop) / bottom sheet (mobile) over /g/:groupId, no dedicated path
- **Entered from:** the Share action on P4-01/P4-02 dashboard headers.
- **Exits to:** P2-03 Regenerate-link confirm, or closes back to the underlying screen on Done.
- **Data read:** Group.shareLink, Group.linkPermission (edit | view)
- **Actions → writes:** Copy link → copies Group.shareLink, shows a transient Copied state. Toggle Can edit / View only → writes Group.linkPermission. Regenerate link → opens P2-03. Share via… (mobile) → native share sheet.
- **States:** Default / copied-confirmation (~2s, transient)
- **Notes:** No password or account — the link itself is the credential. The permissions warning stays visible as body copy, never a tooltip. ↳ old link stops resolving immediately — anyone still on it lands on the Invalid link screen (6.5) until you reshare the new one. A visitor only ever sees Regenerate for a link role that doesn't exist yet (lazy creation, not destructive); once a link exists, a visitor sees either an "Own & regenerate" link to /register (only the group's own creator, on the device they created it from) or nothing. A registered member always sees Regenerate on both links — the group they're a member of always has an owner.

### P2-03 — Regenerate link — confirm
- **Route:** Confirmation dialog over P2-02, no dedicated path
- **Entered from:** P2-02 Regenerate link. Cancel returns to P2-02; confirming also returns to P2-02, now showing the new link.
- **Data read:** Group name only
- **Actions → writes:** Regenerate link → invalidates Group.shareLink and issues a new token.
- **States:** Single state
- **Notes:** Old link stops resolving immediately, no grace period — anyone still on it lands on P2-05.

### P2-04 — Exit group — confirm
- **Route:** Confirmation dialog over any in-group screen, no dedicated path
- **Entered from:** the "Exit group" control in the header (visitor sessions only — the member-session equivalent slot is "Log out").
- **Data read:** None
- **Actions → writes:** Exit group → clears the group-context session cookie only. Cancel → closes, no write.
- **States:** Single state
- **Notes:** Deliberately blunt copy — exiting is unrecoverable from the app's side, since the token was stripped from the address bar on arrival (rule 8). Redirects to "/" on confirm, which is the landing page once the session is gone.

### P2-05 — Invalid / revoked link
- **Route:** Shown for any /g/:token that no longer resolves to a group
- **Entered from:** a stale or regenerated link. Exits out of the app to fairsharetab.app (no in-app path back).
- **Data read:** None
- **Actions → writes:** Go to fairsharetab.app → leaves the app.
- **States:** Single state
- **Notes:** Same screen for link-was-regenerated and access-was-removed cases — copy stays generic on purpose.

## Part 3 — Group & events
Once inside a group: the events list and creating an event.

### P3-02 — Events list
- **Route:** /g/:groupId/events
- **Entered from:** opening a share link (direct or pasted at P1-01), or creating a new group (P2-01).
- **Exits to:** P4-01 Event dashboard on selecting an event.
- **Data read:** Group.events[] (name, member count, total spent, unsettled amount)
- **Actions → writes:** Select an event card → opens its dashboard. + Create event → opens P3-04. + Add member (editor only) → creates a new group Member with no event attachment (does not open P4-04).
- **States:** Populated (this) / empty (P3-03)
- **Notes:** Owner badge ("Owned by \<name\>") shown under the group name/switcher whenever the group has a registered owner; nothing shown for an unowned group.

### P3-03 — Events list — empty state
- **Route:** /g/:groupId/events, zero events
- **Entered from:** Same entry points as P3-02.
- **Data read:** Group.events.length === 0
- **Actions → writes:** + Create your first event → opens P3-04. + Add member (editor only) → creates a new group Member with no event attachment (does not open P4-04).
- **States:** This is the empty-state variant of P3-02
- **Notes:** Owner badge ("Owned by \<name\>") shown under the group name/switcher whenever the group has a registered owner; nothing shown for an unowned group.

### P3-04 — Create event — modal
- **Route:** Modal, no dedicated path — opened from the events list (P3-02) + Create event button
- **Entered from:** P3-02 Events list.
- **Exits to:** the new event's dashboard (P4-01) on Create, or closes back to P3-02 on Cancel.
- **Data read:** None — blank form. Group.members is implicitly inherited.
- **Actions → writes:** Create event → writes a new Event{name, dateRange, groupId} scoped to the current group. Cancel → discards.
- **States:** Default only
- **Notes:** Members are not chosen here — every active group member is included by default; add trip-specific people afterward from the event dashboard.

## Part 4 — Inside an event
The event dashboard and the member roster it depends on.

### P4-01 — Event dashboard — light
- **Route:** /g/:groupId/events/:eventId
- **Entered from:** P3-02/P3-03.
- **Exits to:** P5-01 (+ Add bill), P4-04 (member chips / + Add member), P6-01 (Settle up), P2-02 (Share).
- **Data read:** Event.name/dateRange/memberCount/totalSpend; Event.members[] (name, avatar, balance); Event.bills[] (title, paidBy, splitCount, amount, settled)
- **Actions → writes:** + Add bill → P5-01. + Add member → P4-04. Settle up → P6-01. Share → P2-02. Bill row edit/delete icons → P5-01 / P5-04.
- **States:** Light (this) / dark (P4-02) / empty (P4-03) / read-only (P7-01)
- **Notes:** Inactive members render at 55% chip opacity but stay visible — never removed. ↳ balance counts up, 400ms ease-out, on load ↳ tap name to rename inline · press-hold to deactivate — never delete

### P4-02 — Event dashboard — dark
- **Route:** Same as P4-01
- **Entered from:** Same as P4-01
- **Data read:** Same as P4-01
- **Actions → writes:** Same as P4-01
- **States:** Dark-mode counterpart of P4-01
- **Notes:** Dark-mode parity is only designed for the dashboard and the settle-up graph (P6-04), not every screen.

### P4-03 — Event dashboard — empty states
- **Route:** Same as P4-01, with Event.bills.length === 0 or Event.members.length === 0
- **Entered from:** Same as P4-01
- **Data read:** Event with zero bills, or zero members
- **Actions → writes:** + Add bill / + Add member (first-item variants)
- **States:** Zero-bills and zero-members (both shown)
- **Notes:** —

### P4-04 — Member management — add / inline rename / deactivate
- **Route:** Modal (desktop) / bottom sheet (mobile) over P4-01; rename & deactivate act in place on the dashboard's member chips
- **Entered from:** P4-01 + Add member. Exits back to P4-01 on save/cancel.
- **Data read:** Event.members[] (for rename/deactivate); new-member form (name, optional email)
- **Actions → writes:** Add member → writes a new Member. Tap name → inline rename, writes Member.name.
- **States:** Add form / inline-rename / deactivated (55% opacity, Reactivate link)
- **Notes:** Members are never hard-deleted — deactivation is the only removal path, and it's reversible.

### P4-05 — Deactivate — confirmation
- **Route:** Confirm dialog over P4-01/P4-04
- **Entered from:** a press-hold on a member chip in P4-04. Cancel or Deactivate both return to P4-01.
- **Data read:** The target Member's name
- **Actions → writes:** Deactivate → sets Member.active = false. Cancel → no write.
- **States:** Single state
- **Notes:** Deactivated members stay attached to past bills; they're excluded from new-bill assignment (P5-01's Paid-by / Split-between lists).

## Part 5 — Bills
Logging, editing, locking, and deleting individual expenses.

### P5-01 — Add bill — split equally
- **Route:** /g/:groupId/events/:eventId/bills/new (or /bills/:billId/edit)
- **Entered from:** P4-01 + Add bill or a bill row's edit icon. Exits back to P4-01 on Save/Cancel.
- **Data read:** Event.members[] (active only); existing Bill fields when editing
- **Actions → writes:** Fill title/amount → Bill.title/amount. Select Paid by / Split between → Bill.paidBy/splitAmong. Toggle split mode → equal (this) or custom (P5-02). Attach a photo → Bill.receiptUrl (optional). Save bill → creates/updates the Bill.
- **States:** Equal split (this) / custom + error (P5-02) / locked-settled (P5-03)
- **Notes:** Inactive members are excluded from both member lists, with an explanatory note shown.
- **Receipt field** (between Total amount and Paid by), labelled **"Receipt (optional)"**:
  - **Empty:** dashed "⊕ Add a photo" button. Save is enabled regardless.
  - **Uploading:** local thumbnail appears instantly, with filename, size and a progress bar. The thumbnail is inert while in flight.
  - **Attached:** "N KB · attached ✓". Clicking the thumbnail opens a full-size in-app preview — it never re-opens the file picker. Replacing is Remove (×) then pick again.
  - **Failed:** the reason, inline. Retry is offered only where retrying could succeed — a file rejected for size or an unreadable format gets none, since re-sending the same bytes cannot change the outcome.
  - **Save is never disabled by receipt state.** Pressing Save mid-upload shows "Uploading receipt…" and waits up to 10s; if the upload fails or times out the bill saves *without* the receipt and says so, offering Retry receipt / Done rather than silently discarding it.
  - Accepts JPEG/PNG/WebP up to 10 MB, downscaled in the browser to a 1600px JPEG before upload. HEIC is excluded from `accept` on purpose: iOS transcodes to JPEG at pick time when the list names JPEG.

### P5-02 — Add bill — custom amounts (error + rounding/currency)
- **Route:** Same as P5-01, split mode = custom
- **Entered from:** Same as P5-01
- **Data read:** Same as P5-01, plus per-member custom amount fields
- **Actions → writes:** Edit a per-member amount → running total recalculates live, no submit step. Save bill → disabled until amounts reconcile to the total.
- **States:** Reconciled (Save enabled) / under-or-over total (coral warning, Save disabled — pictured)
- **Notes:** Equal-split rounding: the leftover cent from an odd division goes to the payer, so splits always sum exactly. Currency follows the event's currency (e.g. JPY, no decimals), not a fixed USD. ↳ recalculates live on every keystroke, no submit needed

### P5-03 — Editing a settled bill — locked
- **Route:** Same edit path as P5-01, for a Bill with settled = true
- **Entered from:** a settled bill's lock icon on P4-01. Close returns to P4-01; there is no save path.
- **Data read:** The settled Bill's fields (read-only), including its receipt if it has one
- **Actions → writes:** None available — Save bill is disabled. The bill must be unmarked as settled via P6-03 first.
- **States:** Locked (only state)
- **Notes:** This is the only path back to an editable bill — there is no direct unlock action on this screen.
- **Receipt:** shown as a thumbnail that opens the same full-size in-app preview as P5-01, with no add/remove control. Visible to **viewers** as well as editors — the app shows everyone with the link the same thing. If the bill has no receipt, the block is absent entirely; there is no "No receipt" empty state. If the image fails to load the block also disappears, so an unreachable Blob store degrades to "no receipt" rather than a broken icon.

### P5-04 — Delete bill — confirmation
- **Route:** Confirm dialog over P4-01
- **Entered from:** a bill row's delete icon on P4-01. Cancel or Delete both return to P4-01 (Delete removes the row).
- **Data read:** The target Bill's title and amount
- **Actions → writes:** Delete bill → removes the Bill and recalculates every member's balance. Cancel → no write.
- **States:** Single state
- **Notes:** Explicitly irreversible (can't be undone) — no undo/trash designed.

## Part 6 — Settle up
Reducing every unsettled bill in an event to the minimum set of transfers.

### P6-01 — Settle up — select bills
- **Route:** /g/:groupId/events/:eventId/settle
- **Entered from:** P4-01 Settle up.
- **Exits to:** P6-02 on Calculate.
- **Data read:** Event.bills[] where settled = false (title, paidBy, splitCount, amount)
- **Actions → writes:** Toggle bill checkboxes → changes the included set and the running summary. Calculate → computes the transfer graph.
- **States:** Single state (selection)
- **Notes:** —

### P6-02 — Settle up — transfer graph
- **Route:** Same as P6-01, step 2
- **Entered from:** P6-01 Calculate.
- **Exits to:** P6-03 on Mark as settled.
- **Data read:** Derived transfers[] (from, to, amount) computed from the selected bills' net balances
- **Actions → writes:** Mark as settled → opens P6-03.
- **States:** Light (this) / dark (P6-04)
- **Notes:** Transfers are the minimum-transaction solution (net every member, greedily match largest debtor to largest creditor) — not a literal one-bill-one-transfer mapping. ↳ arrows draw in one-by-one, 150ms stagger, on load

### P6-03 — Settle up — confirm mark as settled
- **Route:** Confirm dialog over P6-02
- **Entered from:** P6-02 Mark as settled. Cancel returns to P6-02; confirming exits to P4-01 with the included bills now settled and locked (P5-03).
- **Data read:** The computed transfers[] for display
- **Actions → writes:** Yes, mark as settled → sets settled = true on every included Bill and zeroes the resolved balances. Cancel → no write.
- **States:** Single state
- **Notes:** Explicitly hard to undo — this is also what puts bills into the P5-03 locked state.

### P6-04 — Settle up — dark mode
- **Route:** Same as P6-02, dark color scheme
- **Entered from:** Same as P6-02
- **Data read:** Same as P6-02
- **Actions → writes:** Same as P6-02
- **States:** Dark-mode counterpart of P6-02
- **Notes:** Only the graph step has a dark variant designed — steps 1 and 3 don't yet.

## Part 7 — Cross-cutting states
States that apply across multiple screens rather than belonging to one.

### P7-01 — Read-only dashboard (view-only link)
- **Route:** Same path as P4-01, accessed via a link with Group.linkPermission = view
- **Entered from:** Same entry as P4-01, gated by link permission. No mutating exits.
- **Data read:** Identical to P4-01
- **Actions → writes:** None — every mutating action is removed outright, not merely disabled.
- **States:** Light (this) / dark (shown)
- **Notes:** Same route and data as P4-01 — the only difference is which actions render, driven by link permission rather than a per-user role. ↳ view-only visitors never see + Add bill, + Add member, Settle up, or per-row edit/delete — same data, zero mutation affordances.

### P7-02 — Loading & error states
- **Notes:** Skeleton treatments now designed for events list, dashboard, and settle-up calculation (shown). Generic network-error/offline states remain a known gap.

### P7-03 — Disabled button states
Reference only — not a routed screen.

### P7-04 — Responsive rules
Reference only — not a routed screen.
