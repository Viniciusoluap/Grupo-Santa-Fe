import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { obterAtorCrm, type AtorCrm } from "./acesso-lead";

export function escopoFinanciamentosDoAtor(ator: AtorCrm): Prisma.FinanciamentoWhereInput {
  if (ator.papel === "admin" || ator.papel === "colaborador") return {};
  if (!ator.corretorId) throw new Error("Não autorizado.");
  return { OR: [{ corretorId: ator.corretorId }, { leadVinculado: { corretorId: ator.corretorId } }] };
}

export async function financiamentoDoAtor(id: string) {
  const ator = await obterAtorCrm();
  const financiamento = await prisma.financiamento.findFirst({ where: { id, ...escopoFinanciamentosDoAtor(ator) } });
  if (!financiamento) throw new Error("Financiamento não encontrado ou acesso não autorizado.");
  return financiamento;
}
