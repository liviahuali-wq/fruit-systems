export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Fruit Systems
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          AI-enabled ERP for Australian fruit growers. This is a portfolio demo with fictional data;
          the first screens arrive with the foundation build.
        </p>
        <p className="text-sm text-zinc-500">
          Service status: <a className="underline" href="/api/health">/api/health</a>
        </p>
      </div>
    </main>
  );
}
