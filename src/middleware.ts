/**
 * Middleware: refresh the Supabase session cookie and protect
 * authenticated areas. Public routes: /verify/*, /auth/*, and the
 * public status API.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canonicalRequestUrl } from "@/lib/app-url";

const PUBLIC_PREFIXES = ["/verify", "/auth", "/api/public", "/_next", "/favicon"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OAuth PKCE cookies are host-scoped. Force production traffic onto the
  // configured public origin before authentication begins so callbacks and
  // invitation links cannot strand sessions on a Vercel deployment hostname.
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_ENV === "production" && configuredUrl) {
    const canonicalUrl = canonicalRequestUrl(request.url, configuredUrl);
    if (canonicalUrl) return NextResponse.redirect(canonicalUrl, 308);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — required for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
