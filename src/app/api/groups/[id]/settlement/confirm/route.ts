import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { computeSettlementPreview, SettlementValidationError } from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";

// Persists the settlement, its transfers, and marks the included bills
// settled -- one transaction (system-design.md §5, §6.4). Transfers are
// always recomputed server-side from billIds; the client never supplies
// transfer amounts directly, the same "never trust client money math"
// pattern as bill splits (src/lib/bills.ts). Editor-only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
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

  let preview;
  try {
    preview = await computeSettlementPreview(parsed.data.billIds, groupId);
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: { groupId, status: "confirmed" },
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

    await tx.bill.updateMany({
      where: { id: { in: preview.billIds } },
      data: { status: "settled" },
    });

    return created;
  });

  return NextResponse.json(
    {
      settlement: {
        id: settlement.id,
        groupId: settlement.groupId,
        status: settlement.status,
        createdAt: settlement.createdAt,
        billIds: preview.billIds,
        transfers: preview.transfers,
      },
    },
    { status: 201 },
  );
}
