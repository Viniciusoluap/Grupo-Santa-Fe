import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/sequencias.ts).
// Sequências configuráveis em tela: follow-up comercial após a aprovação, cliente sem resposta e reativação de
// inativos. Cada passo vira um item da fila com chave única (lead, passo, marco de início): repetir a rodada nunca
// duplica; o cliente responder reinicia o ciclo.
import type { CentralVendasLead } from "@/generated/prisma/client";
import { lerPassos, type TipoSequencia } from "./config";
import { agora, atualizarCentral, carregarConfig, db } from "./base";
import { enfileirarTemplate } from "./envio";

type Linha = CentralVendasLead & { criadoEmLead: Date };

/** Marco de início de cada sequência para o lead (null = não se aplica agora). */
export function marcoSequencia(tipo: TipoSequencia, cv: Linha): Date | null {
  if (cv.optOut) return null;
  if (tipo === "followup_aprovado") return cv.statusAnalise === "aprovado" ? cv.decisaoEm : null;
  if (tipo === "sem_resposta") {
    if (!["em_atendimento_ia", "aguardando_cliente", "sem_resposta"].includes(cv.statusAtendimento) || !cv.ultimaMensagemEnviadaEm) return null;
    const cliente = cv.ultimaMensagemClienteEm ?? cv.criadoEmLead;
    return cv.ultimaMensagemEnviadaEm > cliente ? cliente : null;
  }
  // Reativação: ninguém em análise ou aprovado; conta da última mensagem do cliente (ou da entrada).
  if (["em_analise", "aprovado"].includes(cv.statusAnalise) || cv.statusAtendimento === "em_atendimento_humano") return null;
  return cv.ultimaMensagemClienteEm ?? cv.criadoEmLead;
}

export async function agendarSequencias() {
  const config = await carregarConfig();
  const seqs = (await db().centralVendasSequencia.findMany({ where: { ativo: true } }))
    .filter(s => (s.tipo === "reativacao" ? config.automacoes.reativacao : config.automacoes.followup));
  if (!seqs.length) return 0;
  const rows = await db().centralVendasLead.findMany({
    where: { optOut: false, statusAtendimento: { notIn: ["encerrado"] }, lead: { excluidoEm: null } },
    include: { lead: { select: { criadoEm: true } } },
  });
  let n = 0;
  for (const s of seqs) {
    const passos = lerPassos(s.passos);
    if (!passos.length) continue;
    for (const { lead, ...cv } of rows) {
      const marco = marcoSequencia(s.tipo as TipoSequencia, { ...cv, criadoEmLead: lead.criadoEm });
      if (!marco) continue;
      // Só o passo mais avançado já vencido (se a rodada atrasou, não manda os anteriores em rajada).
      let idx = -1;
      passos.forEach((p, i) => { if (marco.getTime() + p.aposDias * 86_400_000 <= agora().getTime()) idx = i; });
      if (idx < 0) continue;
      const job = await enfileirarTemplate({ leadId: cv.leadId, slug: passos[idx].templateSlug, chave: `seq:${s.id}:${cv.leadId}:${idx}:${marco.toISOString()}`, proativa: true });
      if (!job) continue;
      n++;
      if (s.tipo === "sem_resposta" && cv.statusAtendimento !== "sem_resposta") await atualizarCentral(cv.leadId, { statusAtendimento: "sem_resposta" });
    }
  }
  return n;
}
