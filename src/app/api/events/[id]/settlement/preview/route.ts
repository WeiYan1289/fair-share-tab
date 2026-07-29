import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { computeSettlementPreview, SettlementValidationError } from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";

// Computes net balances and simplified transfers for a chosen set of bills.
// Read-only -- does not persist anything, so any valid session (editor or
// viewer) can preview (system-design.md §5 "Settlement"). Strictly
// event-scoped: a settlement always covers exactly one event's bills.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    assertSameOrigin(request);
    session = await requireSession();
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

  const body = await request.json().catch(() => null);
  const parsed = settlementBillsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { netBalances, transfers } = await computeSettlementPreview(
      parsed.data.billIds,
      eventId,
    );
    return NextResponse.json({ netBalances, transfers });
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
