import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Home · Fruit Systems" };

// The signed-in home page. Role dashboards replace this with the business modules.
export default function AppHome() {
  return (
    <main className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const user = await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{user.profile?.tenantName ?? "Fruit Systems"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {user.profile ? `Welcome, ${user.profile.fullName}` : "Signed in"}
          </h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
            Sign out
          </button>
        </form>
      </div>
      {user.profile ? (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-xl border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-zinc-500">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-zinc-500">Roles</dt>
          <dd>{user.profile.roles.length ? user.profile.roles.join(", ") : "None yet: ask your administrator"}</dd>
        </dl>
      ) : (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          Your sign-in works, but you have not been added to a grower&apos;s account yet. Ask your administrator to add you.
        </p>
      )}
    </div>
  );
}
