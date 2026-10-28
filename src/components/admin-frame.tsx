import Link from "next/link";
import type { ReactNode } from "react";

// The frame around the administration pages.
export function AdminFrame({ title, back, children }: { title: string; back?: { href: string; label: string }; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link href={back?.href ?? "/app"} className="text-sm text-zinc-500 underline">
            ← {back?.label ?? "Home"}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  invited: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  deactivated: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.deactivated}`}>
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
