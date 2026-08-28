import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { BillValidationError, resolveBillSplits, serializeBill } from "@/lib/bills";
import { ArchivedEventError, assertEventNotArchived } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { billSchema } from "@/lib/validation/bill";

async function loadBillForGroup(billId: string, groupId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { event: { select: { groupId: true, status: true } } },
  });
  if (!bill || bill.event.groupId !== groupId) return null;
  return bill;
}

// Loads one bill for the edit/view modal (the desktop workspace and event
// dashboard open editing in a modal rather than navigating to the standalone
// /bills/{id}/edit page). Mirrors that page's server logic: the same members
// set (active event members plus anyone this bill already references, even if
// deactivated -- CLAUDE.md rule 4), and the same `viewOnly` rule (settled, or
// not an editor). Read-only for any role, so no editor gate here.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { splits: true, event: { select: { groupId: true, currency: true } } },
  });
  if (!bill || bill.event.groupId !== session.groupId) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const eventMembers = await prisma.eventMember.findMany({
    where: { eventId: bill.eventId, member: { isActive: true } },
    include: { member: true },
    orderBy: { member: { createdAt: "asc" } },
  });

  const referencedIds = new Set([bill.payerId, ...bill.splits.map((s) => s.memberId)]);
  const activeIds = new Set(eventMembers.map((em) => em.memberId));
  const extraIds = [...referencedIds].filter((id) => !activeIds.has(id));
  const extraMembers = extraIds.length
    ? await prisma.member.findMany({ where: { id: { in: extraIds } } })
    : [];

  const members = [...eventMembers.map(({ member }) => member), ...extraMembers].map((m) => ({
    id: m.id,
    name: m.name,
    avatarColor: m.avatarColor,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({
    currency: bill.event.currency,
    viewOnly: bill.status === "settled" || session.role !== "editor",
    members,
    bill: {
      id: bill.id,
      title: bill.title,
      totalAmount: bill.totalAmount,
      payerId: bill.payerId,
      splitMethod: bill.splitMethod,
      status: bill.status,
      receiptUrl: bill.receiptUrl,
      splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
    },
  });
}

// Edits a bill. This is a full replace of title/amount/payer/split
// configuration, not a partial patch -- system-design.md §5 gives one shared
// body shape for create and edit, and every field is revalidated exactly as
// on create. Rejects settled bills outright (data-model.md invariant 8).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params;

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
  try {
    assertEventNotArchived(existing.event, "This event is archived and cannot be edited");
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
        // Full replace, not a patch: an absent receiptUrl means the bill
        // has no receipt. This is the removal path -- no DELETE endpoint.
        // The blob itself is left in storage (spec §3.3), which also means
        // removal cannot fail while Blob is unreachable.
        receiptUrl: input.receiptUrl ?? null,
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
    assertSameOrigin(request);
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
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
  try {
    assertEventNotArchived(existing.event, "This event is archived and cannot be deleted from");
  } catch (error) {
    if (error instanceof ArchivedEventError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  await prisma.bill.delete({ where: { id: billId } });

  return new NextResponse(null, { status: 204 });
}
