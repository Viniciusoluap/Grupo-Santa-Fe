import { prisma } from "@/lib/db";

/**
 * Fotos e medições da obra para a galeria por medição (Editar Obra e Detalhes da
 * Obra — Lote 02, correção 02). Mesmos arquivos e metadados já gravados: as fotos
 * são servidas pela rota autenticada /api/obras/fotos/<id>, sem cópia.
 * Chamar só depois de conferir o acesso à obra.
 */
export async function carregarGaleriaObra(obraId: string) {
  const [fotos, medicoes] = await Promise.all([
    prisma.obraFoto.findMany({
      where: { obraId },
      orderBy: [{ tiradaEm: "desc" }, { criadoEm: "desc" }],
      select: { id: true, medicaoId: true, legenda: true, tiradaEm: true, incluirNoRelatorio: true },
    }),
    prisma.obraProgressoHistorico.findMany({ where: { obraId }, select: { id: true, progresso: true, criadoEm: true } }),
  ]);
  return {
    fotos: fotos.map(f => ({ id: f.id, medicaoId: f.medicaoId, url: `/api/obras/fotos/${f.id}`, legenda: f.legenda, tiradaEm: f.tiradaEm.toISOString(), incluirNoRelatorio: f.incluirNoRelatorio })),
    medicoes: medicoes.map(m => ({ id: m.id, progresso: Number(m.progresso), criadoEm: m.criadoEm.toISOString() })),
  };
}
