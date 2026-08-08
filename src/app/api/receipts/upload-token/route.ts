import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { handleReceiptUpload } from "@/lib/receipts/storage";

// Mints a scoped client-upload token for a receipt image. Gated exactly
// like every other mutating endpoint: same-origin plus an editor session.
// Rule 9 -- hiding the field in the UI is not access control.
export async function POST(request: Request) {
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

  try {
    return await handleReceiptUpload(request, session.groupId);
  } catch {
    // Covers a bad pathname, a missing BLOB_READ_WRITE_TOKEN, and Blob
    // being unreachable or over quota. The client treats all of them the
    // same way: show the retry notice, leave Save enabled.
    return NextResponse.json({ error: "Couldn't start the receipt upload" }, { status: 400 });
  }
}
