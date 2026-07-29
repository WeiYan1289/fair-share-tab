import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import {
  computeSettlementPreview,
  SettlementValidationError,
  type NetBalanceView,
} from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";
import type { Transfer } from "@/lib/settlement";

// Persists the settlement, its transfers, and marks the included bills
// settled -- one transaction (system-design.md §5, §6.4). Transfers are
// always recomputed server-side from billIds; the client never supplies
// transfer amounts directly, the same "never trust client money math"
// pattern as bill splits (src/lib/bills.ts). Editor-only. Strictly
// event-scoped: a settlement always covers exactly one event's bills.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    assertSameOrigin(request);
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.status === "archived") {
    return NextResponse.json({ error: "This event is archived and cannot be settled" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settlementBillsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let settlement;
  let preview: { netBalances: NetBalanceView[]; transfers: Transfer[]; billIds: string[] } | undefined;
  try {
    // Preview and write share one transaction so a concurrent confirm (or a
    // bill edit/delete) can't slip into the gap between reading "unsettled"
    // bills and marking them settled -- see the guarded updateMany below.
    settlement = await prisma.$transaction(async (tx) => {
      preview = await computeSettlementPreview(parsed.data.billIds, eventId, tx);

      const created = await tx.settlement.create({
        data: { eventId, status: "confirmed" },
      });

      await tx.settlementBill.createMany({
        data: preview.billIds.map((billId) => ({ settlementId: created.id, billId })),
      });

      if (preview.transfers.length > 0) {
        await tx.transfer.createMany({
          data: preview.transfers.map((t) => ({
            settlementId: created.id,
            fromMemberId: t.fromMemberId,
            toMemberId: t.toMemberId,
            amount: t.amount,
          })),
        });
      }

      const { count } = await tx.bill.updateMany({
        where: { id: { in: preview.billIds }, status: "unsettled" },
        data: { status: "settled" },
      });
      if (count !== preview.billIds.length) {
        throw new SettlementValidationError(
          "Some of these bills were already settled -- reload and try again.",
        );
      }

      return created;
    });
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  if (!preview) {
    throw new Error("unreachable: transaction resolved without setting preview");
  }

  return NextResponse.json(
    {
      settlement: {
        id: settlement.id,
        eventId: settlement.eventId,
        status: settlement.status,
        createdAt: settlement.createdAt,
        billIds: preview.billIds,
        transfers: preview.transfers,
      },
    },
    { status: 201 },
  );
}
