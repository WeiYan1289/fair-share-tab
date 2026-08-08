import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { BillValidationError, resolveBillSplits, serializeBill } from "@/lib/bills";
import { ArchivedEventError, assertEventNotArchived } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { billSchema } from "@/lib/validation/bill";

// Creates a bill with splits (system-design.md §5 "Bills", §6.3). The client
// may compute a preview, but the server always recomputes/reverifies the
// splits independently before persisting.
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
  try {
    assertEventNotArchived(event, "This event is archived and cannot have new bills");
  } catch (error) {
    if (error instanceof ArchivedEventError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
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
    const created = await tx.bill.create({
      data: {
        eventId,
        payerId: resolved.payerId,
        title: input.title,
        totalAmount: input.totalAmount,
        splitMethod: input.splitMethod,
        category: input.category,
        note: input.note,
        receiptUrl: input.receiptUrl ?? null,
      },
    });

    await tx.split.createMany({
      data: resolved.splits.map((s) => ({
        billId: created.id,
        memberId: s.memberId,
        shareAmount: s.shareAmount,
      })),
    });

    return tx.bill.findUniqueOrThrow({ where: { id: created.id }, include: { splits: true } });
  });

  return NextResponse.json({ bill: serializeBill(bill) }, { status: 201 });
}
