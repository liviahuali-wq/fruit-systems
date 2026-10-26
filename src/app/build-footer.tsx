import { connection } from "next/server";
import { readBuildInfo } from "@/lib/build-info";

// Tells anyone looking which environment and version they are on. The smoke tests check it too.
export async function BuildFooter() {
  await connection(); // read per request, so a rollback shows the version actually serving

  const { environment, version } = readBuildInfo();
  return (
    <footer className="px-6 py-4 text-center text-xs text-zinc-500">
      {`Environment: ${environment} · Version: ${version}`}
    </footer>
  );
}
