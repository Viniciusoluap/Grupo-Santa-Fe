import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/analise.ts).
// Retorno da análise. A decisão (pendente, aprovado, reprovado) é sempre de um humano: exige o usuário (admin ou
// analista da Central, ativo) e o banco recusa decisão sem `decisaoPor`. Cada decisão dispara a mensagem e o
// próximo passo automaticamente.
import type { DecisaoAnalise } from "./config";
import { agora, avisar, carregarConfig, dadosDoLead, db, registrarEvento, registrarInteracao, registroCentral } from "./base";
import { enfileirarTemplate, processarFila } from "./envio";
import { avancarEtapa } from "./ia";

export class DecisaoInvalida extends Error {}

/** Só admin ou analista marcado na Central, ativo, decide. */
export async function podeDecidir(userId: string): Promise<boolean> {
  if (typeof userId !== "string" || !userId) return false;
  const u = await db().usuario.findUnique({ where: { id: userId }, select: { id: true, papel: true, ativo: true } });
  if (!u || !u.ativo) return false;
  if (u.papel === "admin") return true;
  return u.papel === "colaborador" && (await carregarConfig()).analistas.includes(u.id);
}

export async function registrarDecisao(p: { leadId: string; decisao: DecisaoAnalise; pendencias?: string | null; motivoInterno?: string | null; userId: string }) {
  if (!(await podeDecidir(p.userId))) throw new DecisaoInvalida("Só o administrador ou um analista da Central registra a decisão.");
  const pendencias = p.pendencias?.trim() ?? "";
  if (p.decisao === "pendente" && pendencias.length < 3) throw new DecisaoInvalida("Descreva as pendências para o cliente.");
  const quando = agora();
  const r = await db().centralVendasLead.updateMany({
    where: { leadId: p.leadId, statusAnalise: { in: ["em_analise", "pendente"] } },
    data: {
      statusAnalise: p.decisao, decisaoPor: p.userId, decisaoEm: quando, pendenciasAnalise: p.decisao === "pendente" ? pendencias.slice(0, 2000) : null,
      ...(p.decisao === "pendente" ? { statusDocumental: "aguardando_documentos", docsSolicitadosEm: quando } : {}),
      ...(p.decisao === "reprovado" ? { statusAtendimento: "em_atendimento_humano", aguardandoHumanoDesde: quando, primeiraRespostaHumanaEm: null, motivoTransferencia: "reprovado" } : {}),
      // Motivo interno fica só com a equipe (registro da Central); nunca vai ao cliente pela automação.
      ...(p.decisao === "reprovado" && p.motivoInterno?.trim() ? { motivoReprovacao: p.motivoInterno.trim().slice(0, 2000) } : {}),
      atualizadoEm: quando,
    },
  });
  if (!r.count) throw new DecisaoInvalida("O lead não está em análise.");
  const cv = (await registroCentral(p.leadId))!;
  const lead = await dadosDoLead(p.leadId);
  const quem = await db().usuario.findUnique({ where: { id: p.userId }, select: { nome: true } });
  await registrarInteracao(p.leadId, `Análise: ${p.decisao}${p.decisao === "pendente" ? ` — ${pendencias}` : ""}.`, "nota", quem?.nome ?? "Equipe");
  if (p.decisao === "aprovado") {
    await avancarEtapa(p.leadId, "aprovado_follow_up");
    await db().lead.updateMany({ where: { id: p.leadId, temperatura: { not: "fechado" } }, data: { temperatura: "quente" } });
    await avisar([cv.operadorId], "Central de Vendas: cliente aprovado — follow-up comercial", `${lead?.nome ?? "Cliente"} foi aprovado na análise e entrou na fila de follow-up comercial.`, p.leadId);
  } else if (p.decisao === "reprovado") {
    await avisar([cv.operadorId], "Central de Vendas: análise reprovada — atendimento humano", `${lead?.nome ?? "Cliente"} teve a análise reprovada. A automação enviou só uma mensagem neutra; continue o atendimento.`, p.leadId);
  }
  await registrarEvento({ tipo: `analise_${p.decisao}`, leadId: p.leadId, origem: "humano", payload: { decididoPor: p.userId } });
  const slug = p.decisao === "pendente" ? "cv-analise-pendente" : p.decisao === "aprovado" ? "cv-analise-aprovado" : "cv-analise-reprovado";
  // Mensagem por iniciativa da empresa: respeita a janela 8h–20h (fora dela, sai na abertura seguinte).
  const job = await enfileirarTemplate({ leadId: p.leadId, slug, chave: `decisao:${p.leadId}:${p.decisao}:${quando.toISOString()}`, proativa: true, documentos: p.decisao === "pendente" ? pendencias : undefined });
  if (job) await processarFila({ ids: [job.id] });
  return { ok: true, decisao: p.decisao };
}
