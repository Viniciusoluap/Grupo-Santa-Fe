import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  // Canonical domain: redirect non-www → www so the HostGator chat widget renders
  const host = req.headers.get("host") || "";
  if (host === "gruposantafee.com.br") {
    const url = req.nextUrl.clone();
    url.host = "www.gruposantafee.com.br";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  if (pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  // Corretor cannot access admin-only sections
  const adminOnlyPaths = [
    "/admin/corretores",
    "/admin/obras",
    "/admin/projetos",
    "/admin/regularizacao",
    "/admin/relatorios",
    "/admin/feeds",
    "/admin/contratos",
    "/admin/configuracoes",
    "/admin/agregador",
  ];
  if (
    role === "corretor" &&
    adminOnlyPaths.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/auth).*)"],
};
