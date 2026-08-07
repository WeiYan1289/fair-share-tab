import { afterEach, describe, expect, it, vi } from "vitest";
import { dedupedFetchJson } from "./dedupe-fetch";

function stubFetch(impl: () => Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
}

const ok = (body: unknown) =>
  ({ ok: true, json: () => Promise.resolve(body) }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dedupedFetchJson", () => {
  // The case this exists for: GroupHeader mounts both its layouts, so two
  // GroupOwnerBadges and two MemberAccountControls ask for the same URL in
  // the same tick -- doubled again by Strict Mode in dev.
  it("issues one request when several callers ask at once, and gives them all the body", async () => {
    let release: (value: Response) => void = () => {};
    const fetchSpy = stubFetch(() => new Promise<Response>((resolve) => (release = resolve)));

    const calls = [
      dedupedFetchJson<{ email: string }>("/api/auth/me"),
      dedupedFetchJson<{ email: string }>("/api/auth/me"),
      dedupedFetchJson<{ email: string }>("/api/auth/me"),
      dedupedFetchJson<{ email: string }>("/api/auth/me"),
    ];
    release(ok({ email: "a@b.com" }));

    expect(await Promise.all(calls)).toEqual([
      { email: "a@b.com" },
      { email: "a@b.com" },
      { email: "a@b.com" },
      { email: "a@b.com" },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps different URLs apart", async () => {
    const fetchSpy = stubFetch(() => Promise.resolve(ok({})));

    await Promise.all([
      dedupedFetchJson("/api/groups/g1/context"),
      dedupedFetchJson("/api/groups/g2/context"),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // Coalescing, not caching: freshness must be exactly what it was before.
  // A later mount -- a client-side navigation, a re-render after logout or
  // an ownership change -- has to hit the network again.
  it("refetches once the previous request has settled", async () => {
    const fetchSpy = stubFetch(() => Promise.resolve(ok({ n: 1 })));

    await dedupedFetchJson("/api/auth/me");
    await dedupedFetchJson("/api/auth/me");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("resolves to null on a non-OK response and does not strand the entry", async () => {
    const fetchSpy = stubFetch(() =>
      Promise.resolve({ ok: false, status: 401 } as unknown as Response),
    );

    expect(await dedupedFetchJson("/api/auth/me")).toBeNull();
    await dedupedFetchJson("/api/auth/me");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("resolves to null on a network error rather than rejecting", async () => {
    stubFetch(() => Promise.reject(new Error("offline")));

    await expect(dedupedFetchJson("/api/auth/me")).resolves.toBeNull();
  });
});
