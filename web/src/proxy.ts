import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { areaDoPerfil, type AreaPerfil } from "@/lib/perfis-acesso";

function rotaDaArea(area: AreaPerfil | null): string {
  if (area === "portal") return "/portal";
  if (area === "empreiteiro") return "/empreiteiro";
  return area ? "/admin" : "/";
}

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

  // Item 02: login único. Quem já entrou vai direto para a área do seu perfil
  // (o painel escolhe o primeiro módulo liberado; as páginas revalidam no banco).
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL(rotaDaArea(areaDoPerfil(role)), req.nextUrl));
  }

  // D-05: empreiteiro e cliente nunca renderizam páginas do painel.
  if (pathname.startsWith("/admin") && (role === "empreiteiro" || role === "cliente")) {
    return NextResponse.redirect(new URL(rotaDaArea(areaDoPerfil(role)), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/auth).*)"],
};
