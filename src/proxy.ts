import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
// Supabase SSR guide checked 2026-09-17. Never trust an unverified cookie session.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  if (config) {
    const db = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await db.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
export const config = {
  matcher: [
    "/workspace/:path*",
    "/onboarding",
    "/login",
    "/auth/:path*",
    "/api/social/:path*",
    "/invite/:path*",
  ],
};
