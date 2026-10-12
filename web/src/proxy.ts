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
    return NextResponse.redirect(new URL(role === "empreiteiro" ? "/empreiteiro" : "/admin", req.nextUrl));
  }

  // D-05: empreiteiro nunca renderiza páginas do painel (evita que ações do
  // CRM rodem e registrem "Não autorizado." antes do redirecionamento).
  if (role === "empreiteiro" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/empreiteiro", req.nextUrl));
  }

  // Corretor cannot access admin-only sections
  const adminOnlyPaths = [
    "/admin/corretores",
    "/admin/obras",
    "/admin/projetos",
    "/admin/regularizacao",
    "/admin/configuracoes",
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
