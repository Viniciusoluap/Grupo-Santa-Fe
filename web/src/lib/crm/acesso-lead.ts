import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type AtorCrm = { id: string; nome: string; papel: "admin" | "colaborador" | "corretor"; corretorId: string | null };

/** Identidade, papel e vínculo consultados no servidor; cliente nunca escolhe ator. */
export async function obterAtorCrm(): Promise<AtorCrm> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado.");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, nome: true, papel: true, ativo: true, corretor: { select: { id: true, ativo: true } } },
  });
  if (!usuario?.ativo || !["admin", "colaborador", "corretor"].includes(usuario.papel)) throw new Error("Não autorizado.");
  if (usuario.papel === "corretor" && !usuario.corretor?.ativo) throw new Error("Corretor sem vínculo ativo.");
  return { id: usuario.id, nome: usuario.nome, papel: usuario.papel as AtorCrm["papel"], corretorId: usuario.corretor?.id ?? null };
}

export function escopoLeadsDoAtor(ator: AtorCrm): Prisma.LeadWhereInput {
  if (ator.papel === "admin" || ator.papel === "colaborador") return {};
  if (ator.papel === "corretor" && ator.corretorId) return { corretorId: ator.corretorId };
  throw new Error("Não autorizado.");
}

export function autorizarLeadDoAtor(ator: AtorCrm, lead: { corretorId: string | null } | null): void {
  if (!lead || (ator.papel === "corretor" && (!ator.corretorId || lead.corretorId !== ator.corretorId))) throw new Error("Lead não encontrado ou acesso não autorizado.");
  if (!["admin", "colaborador", "corretor"].includes(ator.papel)) throw new Error("Não autorizado.");
}

export function exigirAtorInterno(ator: AtorCrm): void {
  if (ator.papel !== "admin" && ator.papel !== "colaborador") throw new Error("Ação disponível apenas para equipe interna.");
}
