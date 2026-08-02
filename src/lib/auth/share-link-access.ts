/**
 * The access rule behind POST /api/groups/{id}/links/regenerate
 * (session-persistence-and-ownership design §5, "The rule" and
 * "Create-when-absent is not regeneration"): revoking and replacing an
 * *existing* link is destructive — the old link stops resolving
 * immediately with no grace period — so it is a registered-member action
 * only. An anonymous editor-link holder must never be able to lock out a
 * registered owner. Creating a link for a role that currently has none
 * revokes nothing, so it stays open to any editor, visitor or member —
 * gating that path too would break ShareDialog's lazy-creation of the
 * viewer link and leave a visitor unable to recover a missing editor link.
 */
export function canRegenerateOrCreateLink(params: {
  hasActiveLink: boolean;
  actorType: "member" | "visitor";
}): boolean {
  if (!params.hasActiveLink) return true;
  return params.actorType === "member";
}
