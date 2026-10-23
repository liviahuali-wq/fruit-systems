// Builds the answer for /api/health. Kept free of Next.js and Supabase so it can be unit tested.

export type CheckResult = "ok" | "error";

export interface HealthReport {
  status: "ok" | "degraded";
  environment: string;
  version: string;
  checks: { database: CheckResult };
  checkedAt: string;
}

export interface HealthInputs {
  environment: string;
  version: string;
  // Resolves true when the database answered correctly; may throw or time out.
  probeDatabase: () => Promise<boolean>;
  timeoutMs?: number;
  now?: () => Date;
}

export async function buildHealthReport(inputs: HealthInputs): Promise<HealthReport> {
  const { environment, version, probeDatabase, timeoutMs = 3000, now = () => new Date() } = inputs;

  const database = await withTimeout(probeDatabase, timeoutMs)
    .then((ok): CheckResult => (ok ? "ok" : "error"))
    .catch((): CheckResult => "error");

  return {
    status: database === "ok" ? "ok" : "degraded",
    environment,
    version,
    checks: { database },
    checkedAt: now().toISOString(),
  };
}

function withTimeout<T>(task: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([task(), timeout]).finally(() => clearTimeout(timer));
}
