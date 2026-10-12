import { prisma } from "@/lib/db";
import { calcularProgresso, mesclarComPadrao } from "@/lib/financeiro/progresso";

// EPIC-020 Lote 4 (item 27) — leitura do progresso por incidência, no mesmo
// formato do `obraProgresso.obter` da Prospecta. Decimais viram texto.

export type ProgressoObraDados = {
  itens: { chave: string; incidencia: string; execucao: string }[];
  medido: boolean;
  /** Valor antigo digitado à mão (só exibido enquanto não houver medição). */
  progressoLegado: number;
  historico: { id: string; progresso: number; somaIncidencia: number; criadoEm: string; autor: string | null }[];
};

export async function carregarProgressoObra(obraId: string): Promise<ProgressoObraDados | null> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: {
      progresso: true,
      progressoItens: true,
      progressoHistorico: { orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 100 },
    },
  });
  if (!obra) return null;
  const autores = await prisma.usuario.findMany({
    where: { id: { in: obra.progressoHistorico.map((h) => h.criadoPorId).filter((x): x is string => !!x) } },
    select: { id: true, nome: true },
  });
  const nome = new Map(autores.map((a) => [a.id, a.nome]));
  const itens = mesclarComPadrao(
    obra.progressoItens.map((i) => ({ chave: i.chave, incidencia: i.incidencia.toString(), execucao: i.execucao.toString() }))
  );
  return {
    itens: itens.map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
    medido: obra.progressoItens.length > 0,
    progressoLegado: obra.progresso,
    historico: obra.progressoHistorico.map((h) => ({
      id: h.id,
      progresso: Number(h.progresso),
      somaIncidencia: Number(h.somaIncidencia),
      criadoEm: h.criadoEm.toISOString(),
      autor: h.criadoPorId ? nome.get(h.criadoPorId) ?? null : null,
    })),
  };
}

export function calculoDoProgresso(p: ProgressoObraDados) {
  return calcularProgresso(p.itens);
}
