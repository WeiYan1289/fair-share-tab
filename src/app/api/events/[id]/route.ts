import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { computeNetBalances } from "@/lib/settlement";
import { updateEventSchema } from "@/lib/validation/event";

// GET: detail with members, bills, and computed balances (system-design.md
// §5 "Events", Screen Spec P4-01). Balances are netted over unsettled bills
// only -- a settled bill's debts are already resolved via its transfers, so
// it shouldn't keep contributing to an ongoing "you owe" figure.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventMembers: { include: { member: true } },
      bills: { include: { splits: true } },
    },
  });

  if (!event || event.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const unsettledBills = event.bills.filter((bill) => bill.status === "unsettled");
  const balances = computeNetBalances(
    unsettledBills.map((bill) => ({
      payerId: bill.payerId,
      totalAmount: bill.totalAmount,
      splits: bill.splits.map((split) => ({
        memberId: split.memberId,
        shareAmount: split.shareAmount,
      })),
    })),
  );

  return NextResponse.json({
    event: {
      id: event.id,
      groupId: event.groupId,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      memberCount: event.eventMembers.length,
      totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      members: event.eventMembers.map(({ member }) => ({
        id: member.id,
        name: member.name,
        avatarColor: member.avatarColor,
        isActive: member.isActive,
        balance: balances.get(member.id) ?? 0,
      })),
      bills: event.bills.map((bill) => ({
        id: bill.id,
        title: bill.title,
        payerId: bill.payerId,
        splitCount: bill.splits.length,
        totalAmount: bill.totalAmount,
        status: bill.status,
      })),
    },
  });
}

// PATCH: rename, change dates, or archive. Editor-only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing || existing.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { name, startDate, endDate, status } = parsed.data;
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status !== undefined && { status }),
    },
  });

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
    },
  });
}
