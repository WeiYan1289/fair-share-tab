import { simplifyDebts, type Transfer } from "@/lib/settlement";
import type { NetBalances } from "@/lib/settlement/types";

// Client-side "who pays whom" for one event's current member balances, for the
// desktop workspace's live per-event settle preview. Reuses the pure engine
// (simplifyDebts) -- no new debt logic. Zero-net members are dropped so they
// never appear as a spurious 0 transfer. Display only; the server recomputes
// on confirm.
export function previewTransfers(members: { id: string; balance: number }[]): Transfer[] {
  const nets: NetBalances = new Map();
  for (const m of members) if (m.balance !== 0) nets.set(m.id, m.balance);
  return simplifyDebts(nets);
}
