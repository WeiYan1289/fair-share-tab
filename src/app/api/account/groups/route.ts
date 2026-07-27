import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { listUserGroups } from "@/lib/account";

export async function GET() {
  let session;
  try {
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const groups = await listUserGroups(session.userId);
  return NextResponse.json({ groups });
}
