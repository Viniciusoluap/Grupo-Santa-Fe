"use server";

import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { prisma } from "@/lib/db";
import { dueDiligenceSchema, lerDueDiligence, type DueDiligence } from "@/lib/incorporacao/due-diligence";
import { revalidatePath } from "next/cache";

async function salvarDueDiligenceImpl(estudoId: string, esperado: string | null, proximo: DueDiligence) {
  await exigirModuloAcao("incorporacao");
  if (!estudoId || estudoId.length > 100 || (esperado && esperado.length > 500_000))
    throw new Error("Estudo ou versão inválida.");
  const valido = dueDiligenceSchema.parse(proximo);
  if (valido.versao !== lerDueDiligence(esperado).versao + 1)
    throw new Error("Versão inválida da Due Diligence.");
  const json = JSON.stringify(valido);
  if (json.length > 500_000) throw new Error("Due Diligence muito extensa.");
  const result = await prisma.estudoIncorporacao.updateMany({
    where: { id: estudoId, dueDiligenceJson: esperado },
    data: { dueDiligenceJson: json },
  });
  if (result.count !== 1) throw new Error("O estudo foi alterado em outra sessão. Recarregue antes de salvar.");
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return json;
}

export async function salvarDueDiligence(estudoId: string, esperado: string | null, proximo: DueDiligence) {
  return capturarErroAcao(() => salvarDueDiligenceImpl(estudoId, esperado, proximo));
}
