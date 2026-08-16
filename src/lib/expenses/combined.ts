import { computeNetBalances, simplifyDebts, type Transfer } from "@/lib/settlement";
import type { BillForNetting } from "@/lib/settlement/types";
import type { MemberEventBalanceTransfer } from "./aggregate";

export interface CombinedEventInput {
  eventId: string;
  currency: string;
  /** This event's UNSETTLED bills only -- the caller filters by status. */
  bills: BillForNetting[];
}

export interface CombinedCurrencyResult {
  currency: string;
  /** memberId -> net (SUM paid - SUM owed) across every included event. */
  memberNets: Map<string, number>;
  transfers: Transfer[];
  eventIds: string[];
  eventCount: number;
  unsettledTotal: number;
}

/**
 * The single per-currency core behind all three cross-event surfaces
 * (event-list Overall panel, member Balance Combined section, settle flow),
 * so they can never silently disagree -- the same principle
 * computeMemberEventBalance applies to the single-event case.
 *
 * Partitions the given events by currency (never summing across currencies --
 * money is currency-blind integers, CLAUDE.md rule 1), then within each
 * currency nets over the UNION of all those events' unsettled bills and runs
 * the pure settlement engine once. A currency is only returned when >= 2
 * events carry unsettled money -- with 0 or 1, the existing per-event figure
 * already IS the combined answer, so a combined block would only duplicate it.
 */
export function computeCombinedBalances(events: CombinedEventInput[]): CombinedCurrencyResult[] {
  const byCurrency = new Map<string, CombinedEventInput[]>();
  for (const event of events) {
    if (event.bills.length === 0) continue; // only events that carry unsettled money
    const list = byCurrency.get(event.currency) ?? [];
    list.push(event);
    byCurrency.set(event.currency, list);
  }

  const results: CombinedCurrencyResult[] = [];
  for (const [currency, currencyEvents] of byCurrency) {
    if (currencyEvents.length < 2) continue; // gating: >= 2 same-currency events

    const allBills = currencyEvents.flatMap((e) => e.bills);
    const memberNets = computeNetBalances(allBills);
    const transfers = simplifyDebts(memberNets);
    const unsettledTotal = allBills.reduce((sum, b) => sum + b.totalAmount, 0);

    results.push({
      currency,
      memberNets,
      transfers,
      eventIds: currencyEvents.map((e) => e.eventId),
      eventCount: currencyEvents.length,
      unsettledTotal,
    });
  }
  return results;
}

/**
 * Keeps only the transfers touching `memberId`, expressed from their side --
 * the same reduction computeMemberEventBalance does per event, extracted so
 * the cross-event member view reuses identical direction logic.
 */
export function memberTransfersFrom(transfers: Transfer[], memberId: string): MemberEventBalanceTransfer[] {
  return transfers
    .filter((t) => t.fromMemberId === memberId || t.toMemberId === memberId)
    .map((t): MemberEventBalanceTransfer => {
      const isPayer = t.fromMemberId === memberId;
      return {
        otherMemberId: isPayer ? t.toMemberId : t.fromMemberId,
        direction: isPayer ? "pays" : "receives",
        amount: t.amount,
      };
    });
}
