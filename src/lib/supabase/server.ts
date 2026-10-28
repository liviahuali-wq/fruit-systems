import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

// A Supabase client acting as the signed-in user, for Server Components and Server Functions.
// Row-level security applies exactly as for that user; the session lives in cookies.
export async function createServerSupabase() {
  // Session checks compare token expiry with the clock, which Next.js refuses while prerendering;
  // anything signed-in renders at request time.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session on every
          // request, so a refresh missed here is not lost.
        }
      },
    },
  });
}

export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set");
  return url;
}

export function supabaseKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set");
  return key;
}
