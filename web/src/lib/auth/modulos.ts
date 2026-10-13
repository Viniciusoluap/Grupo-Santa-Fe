import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { areaDoPerfil, podeAcessarAlgum, podeAdministrarSeguranca, primeiroModulo, type UsuarioAcesso } from "@/lib/perfis-acesso";

// 10 implementações, item 06 — acesso por módulo no servidor (telas e actions).
// Perfil, situação e permissões são lidos do banco a cada requisição: revogar
// uma permissão, desativar o usuário ou trocar o perfil vale na hora.

export { MODULOS_PAINEL, IDS_MODULOS_PAINEL } from "./modulos-lista";
import { MODULOS_PAINEL, IDS_MODULOS_PAINEL } from "./modulos-lista";

export type UsuarioDaSessao = UsuarioAcesso & { id: string; nome: string; corretorId: string | null };

function lerPermissoes(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Usuário atual com perfil/situação/permissões do banco (memorizado por requisição). */
export const usuarioAtual = cache(async (): Promise<UsuarioDaSessao | null> => {
  const session: Session | null = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const u = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nome: true, papel: true, ativo: true, permissoes: true, corretor: { select: { id: true, ativo: true } } },
  });
  if (!u) return null;
  return {
    id: u.id, nome: u.nome, perfil: u.papel, ativo: u.ativo,
    permissoes: lerPermissoes(u.permissoes),
    corretorId: u.papel === "corretor" && u.corretor?.ativo ? u.corretor.id : null,
  };
});

/** Rota inicial do usuário (área do perfil e, no painel, o primeiro módulo liberado). */
export function destinoDoUsuario(u: UsuarioAcesso | null): string {
  if (!u || !u.ativo) return "/login";
  const area = areaDoPerfil(u.perfil);
  if (area === "portal") return "/portal";
  if (area === "empreiteiro") return "/empreiteiro";
  if (area !== "painel" && area !== "corretor") return "/login";
  const modulo = primeiroModulo(u, IDS_MODULOS_PAINEL);
  return MODULOS_PAINEL.find((m) => m.id === modulo)?.rota ?? "/admin/sem-acesso";
}

/** Guardas a partir de uma fonte do usuário (o banco em produção; a sessão simulada nos testes). */
export function criarGuardas(obterUsuario: () => Promise<UsuarioDaSessao | null>) {
  /** Para páginas: sem acesso ao(s) módulo(s), volta ao destino do próprio usuário. */
  async function exigirModuloPagina(modulos: string | readonly string[]): Promise<UsuarioDaSessao> {
    const u = await obterUsuario();
    if (!u || !u.ativo) redirect("/login");
    if (!podeAcessarAlgum(u, typeof modulos === "string" ? [modulos] : modulos)) redirect(destinoDoUsuario(u));
    return u;
  }

  /**
   * Para actions/rotas de API: recusa com mensagem clara. `somenteEquipe` exclui o
   * corretor (ex.: alterar percentuais/pagamentos de comissão, que ele só consulta).
   */
  async function exigirModuloAcao(modulos: string | readonly string[], opcoes: { somenteEquipe?: boolean } = {}): Promise<UsuarioDaSessao> {
    const u = await obterUsuario();
    if (!u || !u.ativo) throw new Error("Não autorizado.");
    if (!podeAcessarAlgum(u, typeof modulos === "string" ? [modulos] : modulos)) throw new Error("Sem permissão para este módulo.");
    if (opcoes.somenteEquipe && u.perfil !== "admin" && u.perfil !== "colaborador") throw new Error("Sem permissão para esta operação.");
    return u;
  }

  /** Usuários, perfis, permissões e exclusões definitivas: só admin ativo. */
  async function exigirAdminAtivo(): Promise<UsuarioDaSessao> {
    const u = await obterUsuario();
    if (!u || !podeAdministrarSeguranca(u)) throw new Error("Não autorizado.");
    return u;
  }

  return { exigirModuloPagina, exigirModuloAcao, exigirAdminAtivo };
}

export const { exigirModuloPagina, exigirModuloAcao, exigirAdminAtivo } = criarGuardas(usuarioAtual);
