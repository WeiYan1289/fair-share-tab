import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import {
  ArchivedEventError,
  assertEventNotArchived,
  getEventDetail,
  isRestoreOnlyEventPatch,
} from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { datesInOrder, updateEventSchema } from "@/lib/validation/event";

// GET: detail with members, bills, and computed balances (system-design.md
// §5 "Events", Screen Spec P4-01).
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

  const event = await getEventDetail(eventId, session.groupId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    event: { ...event, memberCount: event.members.length },
  });
}

// PATCH: rename, change dates, or archive. Editor-only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing || existing.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // The only permitted write on an archived event is a PATCH that restores
  // it: status:"active" and nothing else. Anything else -- a rename, a date
  // change, or even status:"active" bundled with a rename -- must 409, so
  // the archived check only skips over the helper for that exact shape.
  if (!isRestoreOnlyEventPatch(parsed.data)) {
    try {
      assertEventNotArchived(existing, "This event is archived and cannot be edited");
    } catch (error) {
      if (error instanceof ArchivedEventError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  // The schema's datesInOrder refine only catches an inverted range when both
  // dates are present in the SAME payload. A partial PATCH (e.g. only
  // startDate) merges against the already-stored date, so we must re-check
  // the effective range here -- the schema alone can't express this.
  const effectiveStart =
    parsed.data.startDate !== undefined
      ? parsed.data.startDate
      : (existing.startDate?.toISOString().slice(0, 10) ?? null);
  const effectiveEnd =
    parsed.data.endDate !== undefined
      ? parsed.data.endDate
      : (existing.endDate?.toISOString().slice(0, 10) ?? null);
  if (!datesInOrder({ startDate: effectiveStart, endDate: effectiveEnd })) {
    return NextResponse.json(
      {
        error: {
          formErrors: [],
          fieldErrors: { endDate: ["Start date must be on or before the end date"] },
        },
      },
      { status: 400 },
    );
  }

  // Currency is fixed for the lifetime of an event that holds any money.
  // Bill amounts are integers in the minor unit of THIS currency (CLAUDE.md
  // rule 1), so a switch would reinterpret every stored amount rather than
  // convert it -- 3000 means RM 30.00 under MYR and ¥3,000 under JPY, a 100x
  // error that writes cleanly and is undetectable afterwards. An event with
  // no bills has nothing to reinterpret, which is the only safe window.
  // Checked here and not just in the UI: hiding the picker is not the gate.
  if (parsed.data.currency !== undefined && parsed.data.currency !== existing.currency) {
    const billCount = await prisma.bill.count({ where: { eventId } });
    if (billCount > 0) {
      return NextResponse.json(
        { error: "This event already has bills, so its currency can no longer be changed" },
        { status: 409 },
      );
    }
  }

  const { name, startDate, endDate, currency, status } = parsed.data;
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(currency !== undefined && { currency }),
      ...(status !== undefined && {
        status,
        archivedAt: status === "archived" ? new Date() : null,
      }),
    },
  });

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      currency: event.currency,
      status: event.status,
    },
  });
}
