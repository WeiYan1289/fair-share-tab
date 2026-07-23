# FairShareTab — Screen Spec

Build-detail companion to `FairShareTab - Mockups.dc.html`. Screen IDs (e.g. `P2-04`) are the link between the two files — find the ID here, find the same ID as a quiet caption above its mockup there.

**Display rule — the viewer's own member:** the viewer's member renders as their name plus a "you" marker — never as the word "You" alone. In rosters and lists (dashboard member chips, add-bill Paid-by/Split-between/breakdown lists, the settle-up transfer graph, and confirm-transfer dialogs) the marker is a small mint "you" pill next to the name plus a mint ring on the avatar; on space-constrained mobile scrollers the ring alone is used. Screenshots of any screen must read correctly to someone who isn't the viewer.

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
The app root with no share link and no stored identity yet.

### P1-01 — Landing — cold visitor
- **Route:** App root, / — no share link, no stored member identity on this device
- **Entered from:** a bare visit to the app root.
- **Exits to:** P1-03 (I have an invite link) or to the Create-group flow inside P3-01 Group switcher.
- **Data read:** None — static marketing content plus the transfer-graph illustration
- **Actions → writes:** Create a group → opens the create-group modal (P3-01). I have an invite link → expands P1-03 inline.
- **States:** Default only
- **Notes:** Only shown when no member identity is stored on this device at all — see P1-02 for the returning-device case.

### P1-02 — Landing — returning device
- **Route:** App root, / — a member identity is already stored on this device
- **Entered from:** a bare visit to the app root when a prior claim exists.
- **Exits to:** the stored group's events list (P3-02) on Continue, or to P1-01 via Use a different link.
- **Data read:** This device's stored member identity and the list of groups it belongs to (name, initials, color, member count)
- **Actions → writes:** Continue to [Group] → opens that group's events list. Row tap on another stored group → switches to it. Use a different link → clears the shortcut and falls back to the paste-link flow.
- **States:** Default only
- **Notes:** This is the state most repeat visitors see — no marketing content, fastest path back in.

### P1-03 — Paste-link state — valid / invalid
- **Route:** Inline expansion of P1-01 — no dedicated path
- **Entered from:** P1-01 I have an invite link.
- **Exits to:** P2-04 Who are you (claim) on a valid link, or stays open with an inline error on an invalid one.
- **Data read:** None until submitted; the pasted string is validated client-side against the expected link shape
- **Actions → writes:** Continue → validates the pasted link and navigates to P2-04, or shows the inline error state shown here.
- **States:** Empty / valid / invalid (shown)
- **Notes:** Same link format as everywhere else in the app — the link itself is the credential, no separate code entry.

## Part 2 — Entry & access
How a group comes to exist and how someone gets into it via a share link.

### P2-01 — Create group (cross-reference)
- **Route:** Modal, no dedicated path — opened from Group switcher → + Create new group
- **Entered from:** P3-01 Group switcher.
- **Exits to:** P3-02 Events list (new, empty group) on Create, or back to P3-01 on Cancel.
- **Data read:** None — blank form
- **Actions → writes:** Create group → writes a new Group{name, currency} and makes it active. Cancel → discards, no write.
- **States:** Default only
- **Notes:** See P3-01 for the actual mockup; not duplicated here.

### P2-02 — Share dialog
- **Route:** Modal (desktop) / bottom sheet (mobile) over /g/:groupId, no dedicated path
- **Entered from:** the Share action on P4-01/P4-02 dashboard headers.
- **Exits to:** P2-03 Regenerate-link confirm, or closes back to the underlying screen on Done.
- **Data read:** Group.shareLink, Group.linkPermission (edit | view)
- **Actions → writes:** Copy link → copies Group.shareLink, shows a transient Copied state. Toggle Can edit / View only → writes Group.linkPermission. Regenerate link → opens P2-03. Share via… (mobile) → native share sheet.
- **States:** Default / copied-confirmation (~2s, transient)
- **Notes:** No password or account — the link itself is the credential. The permissions warning stays visible as body copy, never a tooltip. ↳ old link stops resolving immediately — anyone still on it lands on the Invalid link screen (6.5) until you reshare the new one.

### P2-03 — Regenerate link — confirm
- **Route:** Confirmation dialog over P2-02, no dedicated path
- **Entered from:** P2-02 Regenerate link. Cancel returns to P2-02; confirming also returns to P2-02, now showing the new link.
- **Data read:** Group name only
- **Actions → writes:** Regenerate link → invalidates Group.shareLink and issues a new token.
- **States:** Single state
- **Notes:** Old link stops resolving immediately, no grace period — anyone still on it lands on P2-05.

### P2-04 — Who are you — member claim
- **Route:** /g/:groupId/join
- **Entered from:** Entered by opening a shared link for the first time on a device.
- **Exits to:** P3-02 Events list once a member is chosen, or to P4-04 via I'm not listed.
- **Data read:** Group.name, Group.members[] (active only: name, avatar/initials)
- **Actions → writes:** Select a member chip → stages the choice. Continue as [Name] → writes the chosen memberId to this device's local storage. I'm not listed → opens P4-04 add-member.
- **States:** Unselected (Continue not actionable) / selected (pictured)
- **Notes:** Claim is per device, not per person — a shared computer needs re-claiming for each user. ↳ the chosen member id is stored in this browser's local storage — no login, no password. Reopening the same link on this device skips straight to the group next time.

### P2-05 — Invalid / revoked link
- **Route:** Shown for any /g/:token that no longer resolves to a group
- **Entered from:** a stale or regenerated link. Exits out of the app to fairsharetab.app (no in-app path back).
- **Data read:** None
- **Actions → writes:** Go to fairsharetab.app → leaves the app.
- **States:** Single state
- **Notes:** Same screen for link-was-regenerated and access-was-removed cases — copy stays generic on purpose.

## Part 3 — Group & events
Once inside a group: switching groups, the events list, and creating an event.

### P3-01 — Group switcher
- **Route:** Dropdown/sheet over any /g/:groupId/* route
- **Entered from:** the nav pill on any in-group screen.
- **Exits to:** P3-02 Events list of the chosen group, or opens the Create-group modal (P2-01).
- **Data read:** The claimed member's Group[] (name, avatar/initials, member count, active flag)
- **Actions → writes:** Select a group row → switches active group, navigates to its events list. + Create new group → opens the create-group modal.
- **States:** Collapsed (nav pill) / open (dropdown desktop, sheet mobile) / create-group modal (filled, and your-name-missing validation)
- **Notes:** List is scoped to groups the claimed member on this device belongs to. The create-group modal now also requires **Your name** (with helper text: "This is how the group will see you in bills and balances") — the creator was previously left as an unnamed member. Missing name blocks the Create-group button (disabled state) and shows a coral inline error, same pattern as other required-field validation in the file.

### P3-02 — Events list
- **Route:** /g/:groupId/events
- **Entered from:** P3-01 switcher, P2-04 claim screen, or app launch (last-active group).
- **Exits to:** P4-01 Event dashboard on selecting an event.
- **Data read:** Group.events[] (name, member count, total spent, unsettled amount)
- **Actions → writes:** Select an event card → opens its dashboard. + Create event → opens P3-04.
- **States:** Populated (this) / empty (P3-03)
- **Notes:** —

### P3-03 — Events list — empty state
- **Route:** /g/:groupId/events, zero events
- **Entered from:** Same entry points as P3-02.
- **Data read:** Group.events.length === 0
- **Actions → writes:** + Create your first event → opens P3-04.
- **States:** This is the empty-state variant of P3-02
- **Notes:** —

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
- **Entered from:** P4-01 + Add member or P2-04 I'm not listed. Exits back to P4-01 on save/cancel.
- **Data read:** Event.members[] (for rename/deactivate); new-member form (name, optional email)
- **Actions → writes:** Add member → writes a new Member. Tap name → inline rename, writes Member.name (including the viewer's own — same affordance, no separate UI). Press-hold → opens P4-05 deactivate confirm. That's not me — switch member → clears this device's claimed identity and returns to the paste-link flow (P1-03), recovering from a mis-claim.
- **States:** Add form / inline-rename (shown for both another member and the viewer's own, tagged with the "you" marker) / deactivated (55% opacity, Reactivate link)
- **Notes:** Members are never hard-deleted — deactivation is the only removal path, and it's reversible. "That's not me" is the only recovery path from claiming the wrong identity at P2-04 — previously there was none.

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
- **Actions → writes:** Fill title/amount → Bill.title/amount. Select Paid by / Split between → Bill.paidBy/splitAmong. Toggle split mode → equal (this) or custom (P5-02). Save bill → creates/updates the Bill.
- **States:** Equal split (this) / custom + error (P5-02) / locked-settled (P5-03)
- **Notes:** Inactive members are excluded from both member lists, with an explanatory note shown.

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
- **Data read:** The settled Bill's fields (read-only)
- **Actions → writes:** None available — Save bill is disabled. The bill must be unmarked as settled via P6-03 first.
- **States:** Locked (only state)
- **Notes:** This is the only path back to an editable bill — there is no direct unlock action on this screen.

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
