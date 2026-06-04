import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (isAdminRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
