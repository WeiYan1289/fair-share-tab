import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { BillValidationError, resolveBillSplits, serializeBill } from "@/lib/bills";
import { prisma } from "@/lib/prisma";
import { billSchema } from "@/lib/validation/bill";

async function loadBillForGroup(billId: string, groupId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { event: { select: { groupId: true } } },
  });
  if (!bill || bill.event.groupId !== groupId) return null;
  return bill;
}

// Edits a bill. This is a full replace of title/amount/payer/split
// configuration, not a partial patch -- system-design.md §5 gives one shared
// body shape for create and edit, and every field is revalidated exactly as
// on create. Rejects settled bills outright (data-model.md invariant 8).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const existing = await loadBillForGroup(billId, session.groupId);
  if (!existing) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (existing.status === "settled") {
    return NextResponse.json(
      { error: "This bill is settled and must be unsettled before it can be edited" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = billSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  let resolved;
  try {
    resolved = await resolveBillSplits(input, session.groupId);
  } catch (error) {
    if (error instanceof BillValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const bill = await prisma.$transaction(async (tx) => {
    await tx.split.deleteMany({ where: { billId } });

    await tx.bill.update({
      where: { id: billId },
      data: {
        payerId: resolved.payerId,
        title: input.title,
        totalAmount: input.totalAmount,
        splitMethod: input.splitMethod,
        category: input.category,
        note: input.note,
      },
    });

    await tx.split.createMany({
      data: resolved.splits.map((s) => ({
        billId,
        memberId: s.memberId,
        shareAmount: s.shareAmount,
      })),
    });

    return tx.bill.findUniqueOrThrow({ where: { id: billId }, include: { splits: true } });
  });

  return NextResponse.json({ bill: serializeBill(bill) });
}

// Deletes a bill (cascades to its splits). Rejects settled bills. Explicitly
// irreversible -- no undo/trash (Screen Spec P5-04).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const existing = await loadBillForGroup(billId, session.groupId);
  if (!existing) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (existing.status === "settled") {
    return NextResponse.json(
      { error: "This bill is settled and must be unsettled before it can be deleted" },
      { status: 409 },
    );
  }

  await prisma.bill.delete({ where: { id: billId } });

  return new NextResponse(null, { status: 204 });
}
