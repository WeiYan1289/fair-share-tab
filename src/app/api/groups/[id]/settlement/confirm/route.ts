import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import {
  computeGroupSettlementPreview,
  SettlementValidationError,
  type NetBalanceView,
} from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";
import type { Transfer } from "@/lib/settlement";

// Persists a cross-event settlement (groupId set, eventId null), its transfers,
// and flips every covered bill to settled -- one transaction. Preview and
// write share the transaction so a concurrent confirm or bill edit can't slip
// into the gap; the guarded updateMany count check is the same race guard the
// event route uses. Editor-only. All money math is recomputed server-side
// from billIds, never trusted from the client.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

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

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settlementBillsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let settlement;
  let preview:
    | { netBalances: NetBalanceView[]; transfers: Transfer[]; billIds: string[]; eventIds: string[]; currency: string }
    | undefined;
  try {
    settlement = await prisma.$transaction(async (tx) => {
      preview = await computeGroupSettlementPreview(parsed.data.billIds, groupId, tx);

      const created = await tx.settlement.create({
        data: { groupId, eventId: null, status: "confirmed" },
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
        groupId: settlement.groupId,
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
