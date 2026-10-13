// 10 implementações, itens 02, 05 e 06 — perfis, destino após o login e acesso por módulo.
// Mesmo arquivo em Prospecta/shared/perfis-acesso.ts.
//
// Perfil + permissão + vínculo:
//  - admin: tudo.
//  - colaborador: só os módulos liberados pelo admin; dentro deles, todos os registros.
//  - corretor: só Imóveis, Agenda, WhatsApp e Minhas Comissões, e só os próprios registros.
//  - cliente: só o portal com os próprios serviços.
//  - empreiteiro: só a área do empreiteiro com as próprias obras.
// Usuário inativo não acessa nada. Administração de segurança (usuários,
// perfis, permissões) e exclusão definitiva são exclusivas do admin.

export const PERFIS = ["admin", "colaborador", "corretor", "cliente", "empreiteiro"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  corretor: "Corretor",
  cliente: "Cliente",
  empreiteiro: "Empreiteiro",
};

export function ehPerfil(valor: unknown): valor is Perfil {
  return typeof valor === "string" && (PERFIS as readonly string[]).includes(valor);
}

/** Módulos fixos do corretor (não dependem de permissão configurável). */
export const MODULOS_CORRETOR = ["imoveis", "agenda", "whatsapp", "comissoes"] as const;

/**
 * Área para onde cada perfil vai depois de entrar. Cada sistema decide a rota de
 * cada área (no Santa Fé o corretor usa o próprio painel com 4 módulos; na
 * Prospecta, o Portal do Corretor).
 */
export type AreaPerfil = "painel" | "corretor" | "portal" | "empreiteiro";

export function areaDoPerfil(perfil: string | null | undefined): AreaPerfil | null {
  switch (perfil) {
    case "admin":
    case "colaborador":
      return "painel";
    case "corretor":
      return "corretor";
    case "cliente":
      return "portal";
    case "empreiteiro":
      return "empreiteiro";
    default:
      return null;
  }
}

export interface UsuarioAcesso {
  perfil: string | null | undefined;
  ativo: boolean;
  /** Módulos liberados (só valem para colaborador). */
  permissoes: readonly string[];
}

/** O usuário pode abrir o módulo (tela e API)? */
export function podeAcessarModulo(u: UsuarioAcesso, modulo: string): boolean {
  if (!u.ativo) return false;
  if (u.perfil === "admin") return true;
  if (u.perfil === "colaborador") return u.permissoes.includes(modulo);
  if (u.perfil === "corretor") return (MODULOS_CORRETOR as readonly string[]).includes(modulo);
  return false;
}

/** Algum dos módulos liberado? (telas compartilhadas por mais de um módulo). */
export function podeAcessarAlgum(u: UsuarioAcesso, modulos: readonly string[]): boolean {
  return modulos.some((m) => podeAcessarModulo(u, m));
}

/** Gerenciar usuários, perfis, permissões e exclusões definitivas: só admin ativo. */
export function podeAdministrarSeguranca(u: Pick<UsuarioAcesso, "perfil" | "ativo">): boolean {
  return u.ativo && u.perfil === "admin";
}

/** Primeiro módulo liberado na ordem dada (destino inicial do painel). */
export function primeiroModulo(u: UsuarioAcesso, ordem: readonly string[]): string | null {
  return ordem.find((m) => podeAcessarModulo(u, m)) ?? null;
}

/** Permissões só são guardadas para colaborador; filtra itens desconhecidos e duplicados. */
export function normalizarPermissoes(perfil: string, valores: unknown, conhecidos: readonly string[]): string[] {
  if (perfil !== "colaborador" || !Array.isArray(valores)) return [];
  return Array.from(new Set(valores.filter((v): v is string => typeof v === "string" && conhecidos.includes(v))));
}
