import { describe, expect, it } from "vitest";
import { holds, parsePersonForm } from "./permissions";

describe("holds", () => {
  const salesManager = ["customers.edit", "orders.approve", "reports.view"];

  it("grants the action held", () => {
    expect(holds(salesManager, "customers", "edit")).toBe(true);
  });

  it("grants the actions below the one held", () => {
    expect(holds(salesManager, "orders", "view")).toBe(true);
    expect(holds(salesManager, "orders", "edit")).toBe(true);
  });

  it("refuses an action above the one held", () => {
    expect(holds(salesManager, "customers", "approve")).toBe(false);
  });

  it("refuses a module not held", () => {
    expect(holds(salesManager, "users", "view")).toBe(false);
  });
});

function form(fields: Record<string, string | string[]>) {
  return {
    get: (name: string) => (Array.isArray(fields[name]) ? fields[name][0] : fields[name]) ?? null,
    getAll: (name: string) => [fields[name] ?? []].flat(),
  };
}

describe("parsePersonForm", () => {
  it("accepts a name, email and roles, tidying the email", () => {
    expect(parsePersonForm(form({ fullName: " Sam Sales ", email: "Sam@Sunridge.TEST", roleId: ["r1", "r2"] })))
      .toEqual({ ok: true, value: { fullName: "Sam Sales", email: "sam@sunridge.test", roleIds: ["r1", "r2"] } });
  });

  it("needs a name", () => {
    expect(parsePersonForm(form({ fullName: "", email: "a@b.test", roleId: "r1" })).ok).toBe(false);
  });

  it("needs a valid email", () => {
    expect(parsePersonForm(form({ fullName: "Sam", email: "not-an-email", roleId: "r1" })).ok).toBe(false);
  });

  it("needs at least one role", () => {
    expect(parsePersonForm(form({ fullName: "Sam", email: "a@b.test" }))).toEqual({ ok: false, error: "Choose at least one role." });
  });
});
