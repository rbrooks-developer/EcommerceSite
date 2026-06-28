import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateMap = new Map<string, { count: number; resetAt: number }>();

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit POST submissions to auth pages
  if (request.method === "POST" && AUTH_PATHS.includes(pathname)) {
    const ip = (
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      "unknown"
    ).trim();
    const key = `${ip}:${pathname}`;
    const now = Date.now();
    if (rateMap.size > 5000) {
      for (const [k, v] of rateMap) if (now > v.resetAt) rateMap.delete(k);
    }
    const rec = rateMap.get(key);
    if (!rec || now > rec.resetAt) {
      rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    } else if (rec.count >= RATE_MAX) {
      return new NextResponse("Too many requests. Please try again in a minute.", {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain" },
      });
    } else {
      rec.count++;
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes — must be logged in AND have admin role
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if ((profile as { role: string } | null)?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Protect checkout and account routes — must be logged in
  if (pathname.startsWith("/checkout") || pathname.startsWith("/account")) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect logged-in users away from auth pages (except reset-password — always accessible)
  const authOnlyPaths = ["/login", "/register", "/forgot-password"];
  if (authOnlyPaths.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
