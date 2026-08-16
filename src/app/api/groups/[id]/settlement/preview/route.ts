import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { computeGroupSettlementPreview, SettlementValidationError } from "@/lib/settlement-service";
import { settlementBillsSchema } from "@/lib/validation/settlement";

// Cross-event settlement preview: nets a chosen set of bills spanning several
// same-currency events in this group. Read-only -- any valid session may
// preview. The group/currency/archived guards live in the service, not here
// (CLAUDE.md rules 1, 7, 11). Mirrors the event preview route.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

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

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settlementBillsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { netBalances, transfers } = await computeGroupSettlementPreview(parsed.data.billIds, groupId);
    return NextResponse.json({ netBalances, transfers });
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
