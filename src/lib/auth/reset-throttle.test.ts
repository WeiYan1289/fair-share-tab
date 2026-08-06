import { describe, expect, it } from "vitest";
import {
  RESET_DAILY_CAP,
  RESET_DAILY_WINDOW_MS,
  isResetRequestThrottled,
} from "./reset-throttle";

const NOW = new Date("2026-08-05T10:00:00.000Z");
const agoMs = (ms: number) => new Date(NOW.getTime() - ms);
const SECOND = 1000;

describe("isResetRequestThrottled", () => {
  it("allows a request when the account has never requested a reset", () => {
    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts: [] })).toBe(false);
  });

  it("throttles a second request inside the cooldown", () => {
    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts: [agoMs(30 * SECOND)] })).toBe(true);
  });

  it("allows a request once the cooldown has elapsed", () => {
    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts: [agoMs(61 * SECOND)] })).toBe(false);
  });

  it("allows a request at exactly the cooldown boundary", () => {
    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts: [agoMs(60 * SECOND)] })).toBe(false);
  });

  it("throttles once the daily cap is reached, even outside the cooldown", () => {
    const tokenCreatedAts = Array.from({ length: RESET_DAILY_CAP }, (_, i) =>
      agoMs((i + 2) * 60 * SECOND),
    );

    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts })).toBe(true);
  });

  it("allows a request just below the daily cap", () => {
    const tokenCreatedAts = Array.from({ length: RESET_DAILY_CAP - 1 }, (_, i) =>
      agoMs((i + 2) * 60 * SECOND),
    );

    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts })).toBe(false);
  });

  it("ignores requests older than the daily window when counting toward the cap", () => {
    const tokenCreatedAts = Array.from({ length: RESET_DAILY_CAP }, () =>
      agoMs(RESET_DAILY_WINDOW_MS + 60 * SECOND),
    );

    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts })).toBe(false);
  });

  it("does not depend on the order timestamps arrive in", () => {
    const tokenCreatedAts = [agoMs(10 * 60 * SECOND), agoMs(30 * SECOND), agoMs(5 * 60 * SECOND)];

    expect(isResetRequestThrottled({ now: NOW, tokenCreatedAts })).toBe(true);
  });
});
