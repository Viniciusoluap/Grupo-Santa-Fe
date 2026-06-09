import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  // Canonical domain: redirect non-www → www so the HostGator chat widget renders
  const host = req.headers.get("host") || "";
  if (host === "gruposantafee.com.br") {
    const www = new URL(req.url);
    www.host = "www.gruposantafee.com.br";
    www.protocol = "https:";
    return NextResponse.redirect(www, { status: 308 });
  }

  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
