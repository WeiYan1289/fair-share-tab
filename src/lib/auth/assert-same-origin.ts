export class CsrfError extends Error {
  status = 403 as const;

  constructor() {
    super("Cross-site request blocked");
  }
}

/**
 * Defense-in-depth against CSRF: cookies alone are `sameSite: "lax"`, which
 * still permits a top-level cross-site GET to carry them (system-design.md
 * §3.3 has no CSRF token, so this is the only mitigation for a
 * state-changing GET or a same-site-lax-exempt request). Call at the top of
 * every mutating route handler, alongside requireSession()/requireUserSession().
 *
 * Sec-Fetch-Site is sent by all current browsers and is the reliable
 * signal: "same-origin" or "none" (a direct address-bar navigation) is
 * allowed, anything else ("cross-site", "same-site") is rejected. Only
 * when a client omits it entirely do we fall back to comparing the Origin
 * header against this request's own origin -- and if neither header is
 * present, the request is rejected rather than assumed safe.
 */
export function assertSameOrigin(request: Request): void {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite !== null) {
    if (secFetchSite === "same-origin" || secFetchSite === "none") return;
    throw new CsrfError();
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new CsrfError();
  }
}
