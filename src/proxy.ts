import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IDLE_COOKIE, isIdle } from "@/lib/idle";

// Runs before every page: refreshes the Supabase session, signs out after 12 hours idle, and
// keeps signed-out or single-factor visitors away from the app. Pages and Server Functions
// check again themselves; this is the first gate, not the only one.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Verifies the token and refreshes it when needed. Do not put code between this and createServerClient.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const now = Date.now();

  // Carries refreshed session cookies over to a redirect.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (claims && isIdle(request.cookies.get(IDLE_COOKIE)?.value, now)) {
    await supabase.auth.signOut({ scope: "local" });
    const redirect = redirectTo("/sign-in?reason=idle");
    redirect.cookies.delete(IDLE_COOKIE);
    return redirect;
  }

  const path = request.nextUrl.pathname;
  const inApp = path === "/app" || path.startsWith("/app/");
  if (inApp && !claims) return redirectTo("/sign-in");
  if (inApp && claims?.aal !== "aal2") return redirectTo("/mfa");

  if (claims) {
    response.cookies.set(IDLE_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}

export const config = {
  // Everything except static files and the health check, which must answer without a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
