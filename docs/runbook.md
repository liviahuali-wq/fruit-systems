# Runbook

How to release, check, approve and roll back Fruit Systems. Written for whoever is on duty,
including someone new to the project. Proven end to end on 26 October 2026 (task 4.1, Part E).

## Where things are

| What | Staging | Production |
|---|---|---|
| Website | https://fruit-systems-staging.vercel.app | https://fruit-systems.vercel.app |
| Health check | `/api/health` on the site above | `/api/health` on the site above |
| Vercel project | fruit-systems-staging | fruit-systems |
| Supabase project | fruit-systems-staging (Sydney) | fruit-systems-prod (Sydney) |
| Data | Fictional seed data, loaded once when the database was new | No seed data |

Releases run in GitHub: **Actions → Release**. Keys and passwords live only in GitHub and Vercel
settings, never in the repository or in chat.

## Which version is running

Every page ends with `Environment: <name> · Version: <commit>`. The health check says the same:

```json
{"status":"ok","environment":"production","version":"dc24ebe","checks":{"database":"ok"}}
```

The version is the first 7 characters of the commit on `main`. Compare it with the latest commit
on GitHub to see whether a site is up to date.

## Release a change

1. Make the change on a branch and open a pull request into `main`.
2. Wait for the checks: **App checks** and **Database checks** must pass, or GitHub refuses the
   merge. A **Preview link** comment shows the change on a private preview site.
3. Merge the pull request (squash). The branch is deleted automatically.
4. The **Release** run starts by itself:
   - checks again on `main`;
   - **Staging**: applies database changes, runs the tenant isolation tests,
     deploys, then runs the smoke tests against the new version;
   - **Production** waits for approval.
5. Approve production (next section). Production applies database changes (no seed data),
   deploys and runs the smoke tests.

If staging fails, production is skipped and nothing changes for users. Read the failed step's
log, fix it in a new pull request, and the next merge releases again.

## Approve production

1. Open the waiting run: **Actions → Release →** the newest run, or the link in GitHub's email.
2. Click **Review deployments** in the yellow banner.
3. Tick **production**, add a short comment, and click **Approve and deploy**.
4. When the run turns green, check the production footer shows the new version.

Approving only means "the staging result is good". Look at the staging site first.

## Smoke tests

`scripts/smoke-test.sh <url> <environment> [version]` checks that:

- `/api/health` answers 200 with the database `ok` and the right environment;
- the home page loads and its footer shows the right environment;
- the site is served from Sydney (`syd1`).

The release passes the commit it just deployed and the script waits up to a minute for that
version to be serving, so it never tests the previous deployment by mistake. The daily
**Keep-alive** run uses the same script without a version, which also stops the free Supabase
projects from pausing.

## Roll back

### Fast: Vercel Instant Rollback (seconds, no code change)

Use this first when production is broken after a release.

1. Go to https://vercel.com/dashboard and open the **fruit-systems** project (not staging).
2. On **Overview**, choose **Instant Rollback** (or, under **Deployments**, use **⋯** on the
   previous production deployment).
3. Pick the last good version and confirm.
4. Check the production footer and `/api/health` show the old version.

While rolled back, Vercel holds production on that version: **new approved releases do not go
live**. Once the fix is ready, undo the rollback (**Undo Rollback** on the banner, or **⋯ →
Promote** on the newest deployment) or release the fix and promote it.

Instant Rollback changes the app only, not the database. It is safe while the old version still
works with the current database, which is true when migrations only add things (see below).

### Proper: revert through a pull request

This puts `main` back in step with what should run, and the change passes every gate again.

1. On GitHub, open the merged pull request that caused the problem and click **Revert**. GitHub
   creates a branch and a new pull request that undoes it.
   From a terminal instead: `git checkout -b revert-<topic> origin/main`,
   `git revert <commit>`, push, and open a pull request.
2. Let the checks pass, merge, and approve production as for any release.
3. If an Instant Rollback is in place, undo it once the revert is live.

## Database changes

- Changes are numbered files in `supabase/migrations`, applied only by the pipeline. Nobody edits
  staging or production tables by hand.
- Migrations only move forward. To undo one, write a new migration that reverses it, and release
  it like any change.
- Hosted projects run `supabase/seed.sql` only once, when the database is new; a later change to
  the file is recorded but never run. Anything every environment needs, such as the standard
  roles, goes in a migration. The seed file holds fictional demo data only.
- Prefer changes that only add (new tables, new nullable columns). Remove or rename in a later
  release, once no running version uses the old shape. This keeps Instant Rollback safe.

## Demo people (staging)

The fictional growers' staff are created by `scripts/demo-people.mjs` (D-14). Run it from
**Actions → Demo people → Run workflow**; it is safe to run again.

- Fictional people (for example Priya Nair, Sales manager at Sunridge) get accounts on
  `@*.example` addresses with no password. They appear in lists and on records; nobody can sign
  in as them.
- The address in the staging secret `DEMO_ADMIN_EMAIL` gets a real invitation as Sunridge's
  tenant administrator. The free Supabase email service delivers only to the project's own team,
  so this must be a Supabase team member's address.
- It needs the staging environment secrets `SUPABASE_SECRET_KEY` and `DEMO_ADMIN_EMAIL`, and
  refuses to run against production.
- Locally: `pnpm db:reset`, then `pnpm demo:people` with `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `SITE_URL=http://localhost:3000` and any `DEMO_ADMIN_EMAIL`; the invitation lands in the local
  inbox at http://127.0.0.1:54324.

## Sign-in settings on hosted projects

Supabase keeps some sign-in settings in the dashboard, not in the repository. Each hosted project
needs, under **Authentication**:

| Setting | Value |
|---|---|
| Hooks → Customize Access Token | Postgres, `private.custom_access_token_hook` |
| Email → Minimum password length | 12 |
| Multi-Factor → TOTP | Enabled |
| URL Configuration → Site URL | the project's web address |
| URL Configuration → Redirect URLs | the web address + `/auth/confirm` |
| Emails → Invite user | the link in `supabase/templates/invite.html` |

Vercel needs `SUPABASE_SECRET_KEY` (Sensitive) in each project for adding and deactivating people.

## Backups

The Supabase free plan has **no automatic backups**: Supabase backs up Pro, Team and Enterprise
projects daily ([Supabase docs](https://supabase.com/docs/guides/platform/backups)). Today that is
acceptable: every database can be rebuilt from the migrations, staging data is fictional seed data,
and production holds no data yet.

Before any real data is stored, either move production to the Pro plan (7 days of daily backups)
or schedule regular exports with `supabase db dump`, kept off-site.

## When something is wrong

| Symptom | First step |
|---|---|
| Release failed at **Staging** | Read the failed step's log. Production was not touched. Fix through a pull request. |
| Production broken after a release | Instant Rollback, then revert or fix through a pull request. |
| `/api/health` shows `"database":"error"` | Check the project in the Supabase dashboard (paused, or an outage). |
| **Keep-alive** failed | Open the run: it names the site and the failed check. |
| Footer shows an old version | An Instant Rollback may be in place: check the Vercel project's banner. |
