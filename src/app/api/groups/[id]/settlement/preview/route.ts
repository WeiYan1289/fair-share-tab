import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { computeSettlementPreview, SettlementValidationError } from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";

// Computes net balances and simplified transfers for a chosen set of bills.
// Read-only -- does not persist anything, so any valid session (editor or
// viewer) can preview (system-design.md §5 "Settlement").
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

  let session;
  try {
    session = await requireSession();
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

  try {
    const { netBalances, transfers } = await computeSettlementPreview(
      parsed.data.billIds,
      groupId,
    );
    return NextResponse.json({ netBalances, transfers });
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
