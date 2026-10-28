// Creates the demo people for the fictional growers (D-14). Safe to run again: anything that
// already exists is left alone.
//
// - Fictional people get sign-in accounts without passwords on @*.example addresses, which never
//   receive mail, so they appear in lists and on records but nobody can sign in as them.
// - DEMO_ADMIN_EMAIL gets a real invitation as Sunridge's tenant administrator, so a person can
//   sign in to staging. Supabase's free email reaches only the project's own team.
//
// Runs locally (`pnpm demo:people` with .env.local values) and on staging through the
// "Demo people" workflow. Never on production. Logs never print the invited address,
// because workflow logs on a public repository are public.
//
// Needs: SUPABASE_URL, SUPABASE_SECRET_KEY, SITE_URL, DEMO_ADMIN_EMAIL; optional DEMO_ADMIN_NAME.

import { createClient } from "@supabase/supabase-js";

const SUNRIDGE = "00000000-0000-4000-8000-000000000001";
const BLUEGUM = "00000000-0000-4000-8000-000000000002";

// Fictional people. Any resemblance to real people is accidental.
const PEOPLE = [
  { tenant: SUNRIDGE, name: "Priya Nair", email: "priya.nair@sunridge.example", roles: ["sales_manager"] },
  { tenant: SUNRIDGE, name: "Tom Fletcher", email: "tom.fletcher@sunridge.example", roles: ["sales_admin"] },
  { tenant: SUNRIDGE, name: "Grace Liu", email: "grace.liu@sunridge.example", roles: ["credit_officer"] },
  { tenant: SUNRIDGE, name: "Mick O'Brien", email: "mick.obrien@sunridge.example", roles: ["packhouse_supervisor"] },
  { tenant: SUNRIDGE, name: "Jess Walker", email: "jess.walker@sunridge.example", roles: ["dispatch_coordinator"] },
  { tenant: SUNRIDGE, name: "Anna Kovac", email: "anna.kovac@sunridge.example", roles: ["qa_compliance_manager"] },
  { tenant: SUNRIDGE, name: "Ben Harris", email: "ben.harris@sunridge.example", roles: ["accounts_officer"] },
  { tenant: SUNRIDGE, name: "Sarah Mitchell", email: "sarah.mitchell@sunridge.example", roles: ["finance_manager"] },
  { tenant: SUNRIDGE, name: "David Rossi", email: "david.rossi@sunridge.example", roles: ["executive"] },
  { tenant: BLUEGUM, name: "Kate Morgan", email: "kate.morgan@bluegum.example", roles: ["tenant_admin"] },
  { tenant: BLUEGUM, name: "Liam Chen", email: "liam.chen@bluegum.example", roles: ["sales_admin"] },
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return value;
}

const url = required("SUPABASE_URL");
const key = required("SUPABASE_SECRET_KEY");
const siteUrl = required("SITE_URL").replace(/\/$/, "");
const adminEmail = required("DEMO_ADMIN_EMAIL").toLowerCase();
const adminName = process.env.DEMO_ADMIN_NAME?.trim() || "Demo Administrator";

if (process.env.APP_ENV === "production" || siteUrl === "https://fruit-systems.vercel.app") {
  console.error("Refusing to create demo people on production.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function check(result, what) {
  const { data, error } = await result;
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

// Every sign-in account, by email.
async function existingAccounts() {
  const byEmail = new Map();
  for (let page = 1; ; page++) {
    const { users } = await check(supabase.auth.admin.listUsers({ page, perPage: 200 }), "Listing accounts");
    users.forEach((user) => byEmail.set(user.email?.toLowerCase(), user));
    if (users.length < 200) return byEmail;
  }
}

const tenants = await check(supabase.from("tenant").select("id").in("id", [SUNRIDGE, BLUEGUM]), "Reading tenants");
if (tenants.length !== 2) {
  console.error("The demo tenants are missing. Is this the staging or local database?");
  process.exit(1);
}

const roles = await check(supabase.from("role").select("id, tenant_id, key"), "Reading roles");
const roleId = (tenant, roleKey) => roles.find((r) => r.tenant_id === tenant && r.key === roleKey)?.id;

const accounts = await existingAccounts();
const profiles = new Set(
  (await check(supabase.from("app_user").select("id"), "Reading people")).map((p) => p.id),
);

async function addProfile(id, tenant, name, email, status, roleKeys) {
  if (!profiles.has(id)) {
    await check(
      supabase.from("app_user").insert({ id, tenant_id: tenant, full_name: name, email, status }),
      `Adding ${name}`,
    );
  }
  const rows = roleKeys.map((roleKey) => ({ tenant_id: tenant, user_id: id, role_id: roleId(tenant, roleKey) }));
  await check(
    supabase.from("user_role").upsert(rows, { onConflict: "user_id,role_id", ignoreDuplicates: true }),
    `Giving ${name} their roles`,
  );
}

let created = 0;
for (const person of PEOPLE) {
  let account = accounts.get(person.email);
  if (!account) {
    ({ user: account } = await check(
      supabase.auth.admin.createUser({ email: person.email, email_confirm: true, user_metadata: { full_name: person.name } }),
      `Creating ${person.name}`,
    ));
    created++;
  }
  await addProfile(account.id, person.tenant, person.name, person.email, "active", person.roles);
}
console.log(`Fictional people: ${PEOPLE.length} in place (${created} new).`);

// The one real person: invited, so they choose their own password and authenticator app.
let admin = accounts.get(adminEmail);
if (!admin) {
  ({ user: admin } = await check(
    supabase.auth.admin.inviteUserByEmail(adminEmail, {
      redirectTo: `${siteUrl}/auth/confirm`,
      data: { full_name: adminName },
    }),
    "Sending the administrator's invitation",
  ));
  await addProfile(admin.id, SUNRIDGE, adminName, adminEmail, "invited", ["tenant_admin", "executive"]);
  console.log("Administrator: invitation sent. Check the inbox of DEMO_ADMIN_EMAIL.");
} else {
  await addProfile(admin.id, SUNRIDGE, adminName, adminEmail, "invited", ["tenant_admin", "executive"]);
  console.log(
    admin.last_sign_in_at
      ? "Administrator: already set up; nothing sent."
      : "Administrator: already invited; nothing sent. Ask Claude to resend if the email is lost or expired.",
  );
}
