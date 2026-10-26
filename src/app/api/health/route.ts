import { connection } from "next/server";
import { readBuildInfo } from "@/lib/build-info";
import { buildHealthReport } from "@/lib/health";
import { createPublicClient } from "@/lib/supabase/public-client";

// Checked every 5 minutes by the uptime monitor and after every deployment by the smoke tests.
export async function GET() {
  await connection(); // always answer live, never from a build-time copy

  const report = await buildHealthReport({
    ...readBuildInfo(),
    probeDatabase: async () => {
      const { data, error } = await createPublicClient().rpc("health");
      return !error && (data as { database?: string } | null)?.database === "ok";
    },
  });

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
