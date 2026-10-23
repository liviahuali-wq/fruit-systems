import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./health";

const fixedNow = () => new Date("2026-10-23T00:00:00.000Z");
const base = { environment: "test", version: "abc1234", now: fixedNow };

describe("buildHealthReport", () => {
  it("reports ok when the database answers", async () => {
    const report = await buildHealthReport({ ...base, probeDatabase: async () => true });
    expect(report).toEqual({
      status: "ok",
      environment: "test",
      version: "abc1234",
      checks: { database: "ok" },
      checkedAt: "2026-10-23T00:00:00.000Z",
    });
  });

  it("reports degraded when the database gives a wrong answer", async () => {
    const report = await buildHealthReport({ ...base, probeDatabase: async () => false });
    expect(report.status).toBe("degraded");
    expect(report.checks.database).toBe("error");
  });

  it("reports degraded when the database check throws", async () => {
    const report = await buildHealthReport({
      ...base,
      probeDatabase: async () => {
        throw new Error("connection refused");
      },
    });
    expect(report.status).toBe("degraded");
  });

  it("reports degraded when the database is too slow", async () => {
    const report = await buildHealthReport({
      ...base,
      timeoutMs: 20,
      probeDatabase: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 200)),
    });
    expect(report.status).toBe("degraded");
  });
});
