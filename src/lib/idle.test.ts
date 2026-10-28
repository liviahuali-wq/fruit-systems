import { describe, expect, it } from "vitest";
import { IDLE_LIMIT_MS, isIdle } from "./idle";

const now = Date.parse("2026-10-28T12:00:00Z");

describe("isIdle", () => {
  it("is not idle without a record, so the first request starts the clock", () => {
    expect(isIdle(undefined, now)).toBe(false);
  });

  it("is not idle within 12 hours", () => {
    expect(isIdle(String(now - IDLE_LIMIT_MS + 1000), now)).toBe(false);
  });

  it("is idle after 12 hours", () => {
    expect(isIdle(String(now - IDLE_LIMIT_MS - 1000), now)).toBe(true);
  });

  it("treats a tampered record as idle", () => {
    expect(isIdle("not-a-number", now)).toBe(true);
  });
});
