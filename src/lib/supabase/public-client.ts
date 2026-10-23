import { createClient } from "@supabase/supabase-js";

// A Supabase client using the publishable key: it can only do what row-level security
// allows an anonymous visitor to do. Sign-in aware clients arrive with task 4.2.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
