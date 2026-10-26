// Which environment and code version is running, shown in the footer and /api/health.
// Read at request time: Vercel sets these per deployment, not per build.

export interface BuildInfo {
  environment: string;
  version: string;
}

export function readBuildInfo(env: Record<string, string | undefined> = process.env): BuildInfo {
  return {
    environment: env.APP_ENV || "unknown",
    version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
  };
}
