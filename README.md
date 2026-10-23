# Fruit Systems

An AI-enabled, multi-tenant SaaS ERP for Australian fruit growers, built as a portfolio project.
It is a demo run with production practices: three environments, automatic checks, a release
approval before production, backups and monitoring. **All data is fictional.** The reference
grower, Sunridge Orchards, does not exist.

## Stack

| Part | Choice | Decision |
|---|---|---|
| App | Next.js and TypeScript, hosted on Vercel | D-04, D-06 |
| Database, sign-in, files | Supabase (PostgreSQL), Sydney region | D-03, D-04 |
| Tenant isolation | One shared database with row-level security on every table | D-05 |
| AI | Claude, behind one provider adapter | D-07, D-09 |
| Integrations | Public API and webhooks for Power Automate; one C# Azure Function | D-02, D-08 |

## Run it on your computer

You need Node 24, pnpm, Docker Desktop and the Supabase CLI.

```bash
pnpm install
pnpm db:start             # starts a private copy of Supabase in Docker
cp .env.example .env.local  # then paste the publishable key from `supabase status`
pnpm dev                  # http://localhost:3000
```

## Checks

```bash
pnpm check    # lint, type check and unit tests
pnpm db:test  # database tests, including tenant isolation
pnpm db:reset # rebuild the local database from migrations and seed data
```

## How changes reach production

1. Work happens on a branch and arrives through a pull request. `main` is protected.
2. Every pull request runs the checks and gets its own preview link.
3. Merging to `main` deploys to staging and runs the tenant isolation and smoke tests.
4. Production waits for an approval in GitHub, then deploys with one-click rollback.

Database changes are numbered files in `supabase/migrations` and are applied only by the
pipeline. Nobody edits production by hand.

## Licence

No licence is granted. The code is published to show the work; all rights are reserved.
