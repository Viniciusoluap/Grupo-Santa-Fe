// Central de Vendas (13/11) — nota: os vi.mock ficam em cada arquivo de teste (o vitest os eleva ao topo do
// arquivo); este módulo só reúne o que eles usam.
import { harness } from "./central-vendas-harness";
type P = { whatsappMidia: { upsert: (a: unknown) => Promise<unknown> } };
/** "Download" simulado da mídia da Evolution: grava bytes no banco (sem rede, sem Drive). */
export async function baixarEGuardarMidiaSimulada(mensagemId: string) {
  await (harness.prisma as P).whatsappMidia.upsert({ where: { mensagemId }, create: { mensagemId, conteudo: Buffer.from("%PDF-1.4 simulado") }, update: {} });
  return { ok: true };
}
