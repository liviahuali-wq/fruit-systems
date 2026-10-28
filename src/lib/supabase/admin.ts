import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/server";

// The all-access client. It bypasses row-level security, so it is used only for what a user's
// own session cannot do (sign-in accounts, adding and deactivating people), only after a
// permission check, and always with the tenant set explicitly (Solution Design, Security).
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY must be set on the server");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
