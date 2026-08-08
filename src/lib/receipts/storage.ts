import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_RECEIPT_BYTES } from "@/lib/receipts/compress";

/**
 * The only server-side @vercel/blob importer in the app. Everything else
 * talks to this, so swapping storage providers is this file plus env vars.
 *
 * Mints a short-lived, single-upload token so the browser can PUT bytes
 * straight to Blob. BLOB_READ_WRITE_TOKEN never leaves the server, and the
 * image never passes through a function -- which is also why the 4.5 MB
 * function body limit does not apply here.
 */
export async function handleReceiptUpload(request: Request, groupId: string): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  const json = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      // handleUpload mints the token for the pathname the CLIENT asked
      // for -- the SDK's return type has no pathname field, so it cannot be
      // rewritten here. Validate it instead: a client must not be able to
      // write into another group's prefix.
      if (!pathname.startsWith(`receipts/${groupId}/`)) {
        throw new Error("Receipt pathname outside this group");
      }
      return {
        // compressReceipt guarantees the client only ever produces JPEG.
        allowedContentTypes: ["image/jpeg"],
        maximumSizeInBytes: MAX_RECEIPT_BYTES,
        addRandomSuffix: true,
        // Receipts are immutable once written, so cache hard. Cache HITs
        // are not billed as Simple Operations.
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      };
    },
    // Fires from Vercel's servers, so it carries no session cookie, and it
    // never fires on localhost. We do not need it: the client reads the URL
    // from upload()'s return value. Deliberate no-op.
    onUploadCompleted: async () => {},
  });

  return Response.json(json);
}
