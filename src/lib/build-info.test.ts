import { describe, expect, it } from "vitest";
import { readBuildInfo } from "./build-info";

describe("readBuildInfo", () => {
  it("shows the environment and the short commit of a deployment", () => {
    const info = readBuildInfo({
      APP_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "be96c37d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    });
    expect(info).toEqual({ environment: "production", version: "be96c37" });
  });

  it("falls back when running outside Vercel", () => {
    expect(readBuildInfo({})).toEqual({ environment: "unknown", version: "local" });
  });
});
