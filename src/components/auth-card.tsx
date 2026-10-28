import type { ReactNode } from "react";

// The frame around the sign-in screens.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-500">Fruit Systems</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
