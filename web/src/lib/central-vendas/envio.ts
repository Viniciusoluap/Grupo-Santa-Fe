import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/envio.ts).
// Fila de envio e reprocessamento (central_vendas_fila). Toda mensagem automática passa por aqui: idempotência pela
// chave única, proteções (opt-out, modo de teste, janela 8h–20h, limite diário, intervalo aleatório) e nova
// tentativa com backoff. Nunca reenvia o que já saiu.
import type { CentralVendasFila } from "@/generated/prisma/client";
import type { ConfigCentral } from "./config";
import { MAX_TENTATIVAS, backoffMinutos, bloqueioEnvio, inicioDoDiaFortaleza, preencher, proximaAberturaJanela } from "./regras";
import {
  agora, avisarAdmins, carregarConfig, dadosDoLead, db, dependencias, erroSeguro, primeiroNome, registrarEvento,
  registroCentral, segredo, textoTemplate, type ResultadoEnvio,
} from "./base";

type Job = CentralVendasFila;
type PayloadMensagem = { texto: string; template?: string; ignorarOptOut?: boolean };

/** Põe na fila; a chave única garante uma vez só (devolve null se já existia). */
export async function enfileirar(p: { chave: string; tipo?: "mensagem" | "ia"; leadId: string | null; numero?: string | null; proativa?: boolean; payload: Record<string, unknown>; quando?: Date }) {
  const chave = p.chave.slice(0, 200);
  const r = await db().centralVendasFila.createMany({
    data: [{
      chave, tipo: p.tipo ?? "mensagem", leadId: p.leadId, numero: p.numero?.replace(/\D/g, "") ?? null,
      proativa: Boolean(p.proativa), payload: JSON.stringify(p.payload), proximaTentativaEm: p.quando ?? agora(), criadoEm: agora(), atualizadoEm: agora(),
    }],
    skipDuplicates: true,
  });
  if (!r.count) return null;
  return db().centralVendasFila.findUnique({ where: { chave } });
}

/** Monta o texto do template para o lead (nome, operador, documentos) e põe na fila. */
export async function enfileirarTemplate(p: { leadId: string; slug: string; chave: string; proativa: boolean; documentos?: string; ignorarOptOut?: boolean }) {
  const lead = await dadosDoLead(p.leadId);
  if (!lead || lead.excluidoEm) return null;
  const cv = await registroCentral(p.leadId);
  const modelo = await textoTemplate(p.slug);
  if (!modelo) {
    await registrarEvento({ tipo: "template_ausente", leadId: p.leadId, payload: { template: p.slug }, resultado: "erro" });
    return null;
  }
  const opId = cv?.operadorId ?? lead.responsavelId;
  const op = opId ? await db().usuario.findUnique({ where: { id: opId }, select: { nome: true } }) : null;
  const texto = preencher(modelo, { nome: primeiroNome(lead.nome), corretor: op?.nome?.split(/\s+/)[0] || "nossa equipe", documentos: p.documentos ?? "" })
    .replace(/^,\s*/, "").replace(/^([a-zà-ú])/, c => c.toUpperCase());
  return enfileirar({ chave: p.chave, leadId: p.leadId, numero: lead.telefone, proativa: p.proativa, payload: { texto, template: p.slug, ignorarOptOut: p.ignorarOptOut } satisfies PayloadMensagem });
}

/** Envio padrão: Logyca (se ligada para envio) ou a conexão Evolution (QR code) já existente. */
async function enviarPadrao(p: { numero: string; texto: string; conexaoId: string | null; config: ConfigCentral }): Promise<ResultadoEnvio> {
  const { logyca } = p.config;
  if (logyca.ativo && logyca.usarParaEnvio) {
    const token = segredo(p.config, "tokenLogycaEnvio");
    if (!logyca.endpointEnvio || !token) return { ok: false, externalId: null, conexaoId: null, erro: "Logyca sem endpoint/token de envio." };
    const { enviarLogyca } = await import("./logyca");
    const r = await enviarLogyca({ endpoint: logyca.endpointEnvio, token }, p.numero, p.texto);
    return { ok: r.ok, externalId: null, conexaoId: null, erro: r.erro };
  }
  const conns = await db().conexaoWhatsApp.findMany({ where: { provedor: "evolution", status: "conectado" }, orderBy: { criadoEm: "asc" } });
  const conn = conns.find(c => c.id === p.conexaoId) ?? conns[0];
  if (!conn?.instancia) return { ok: false, externalId: null, conexaoId: null, erro: "Nenhuma conexão de WhatsApp (QR code) conectada." };
  const { configEvolution } = await import("@/lib/whatsapp/evolution-config");
  const { enviarTextoEvolution } = await import("@/lib/evolution");
  const c = await configEvolution();
  if (!c) return { ok: false, externalId: null, conexaoId: conn.id, erro: "Servidor da Evolution não configurado." };
  const id = await enviarTextoEvolution(c, conn.instancia, p.numero, p.texto);
  return { ok: Boolean(id), externalId: id, conexaoId: conn.id, erro: id ? undefined : "A Evolution não aceitou a mensagem." };
}

async function enviadosHoje(numero: string): Promise<number> {
  return db().centralVendasFila.count({
    where: { tipo: "mensagem", status: "concluido", numero, concluidoEm: { gte: inicioDoDiaFortaleza(agora()) } },
  });
}

const adiar = (job: Job, quando: Date, motivo: string) => db().centralVendasFila.update({
  where: { id: job.id },
  data: { status: "pendente", tentativas: Math.max(0, job.tentativas - 1), proximaTentativaEm: quando, ultimoErro: motivo, atualizadoEm: agora() },
});

async function falhar(job: Job, erro: string) {
  if (job.tentativas >= MAX_TENTATIVAS) {
    await db().centralVendasFila.update({ where: { id: job.id }, data: { status: "falhou", ultimoErro: erro, atualizadoEm: agora() } });
    await registrarEvento({ tipo: `falha_${job.tipo}`, leadId: job.leadId, payload: { job: job.id, tentativas: job.tentativas }, resultado: "erro", erro, chave: `falha-fila:${job.id}` });
    await avisarAdmins("Central de Vendas: falha após várias tentativas", `Um envio automático falhou ${job.tentativas} vezes e parou. Veja a fila na Central de Vendas.`, job.leadId);
    if (job.tipo === "ia" && job.leadId) {
      const { transferirParaHumano } = await import("./ia");
      await transferirParaHumano(job.leadId, "ia_indisponivel");
    }
    return;
  }
  const quando = new Date(agora().getTime() + backoffMinutos(job.tentativas) * 60_000);
  await db().centralVendasFila.update({ where: { id: job.id }, data: { status: "pendente", proximaTentativaEm: quando, ultimoErro: erro, atualizadoEm: agora() } });
  await registrarEvento({ tipo: `reprocessar_${job.tipo}`, leadId: job.leadId, payload: { job: job.id, tentativa: job.tentativas }, resultado: "erro", erro });
}

async function processarMensagem(job: Job, config: ConfigCentral, aguardar: boolean): Promise<"enviada" | "adiada" | "descartada" | "falhou"> {
  const p = JSON.parse(job.payload || "{}") as PayloadMensagem;
  const cv = job.leadId ? await registroCentral(job.leadId) : null;
  const numero = job.numero ?? "";
  const bloqueio = bloqueioEnvio({
    ativo: config.ativo, optOut: Boolean(cv?.optOut), ignorarOptOut: p.ignorarOptOut, modoTeste: config.modoTeste,
    numerosTeste: config.numerosTeste, numero, proativa: job.proativa, agora: agora(), janela: config.janelaEnvio,
    enviadosHoje: await enviadosHoje(numero), limiteDiario: config.limiteDiarioPorNumero,
  });
  if (bloqueio === "desligado") { await adiar(job, new Date(agora().getTime() + 15 * 60_000), "Central desligada"); return "adiada"; }
  if (bloqueio === "fora_horario" || bloqueio === "limite_diario") {
    const espalhar = Math.floor(dependencias().aleatorio() * 30) * 60_000; // não sai tudo no mesmo minuto
    // Fora do horário: próxima abertura da janela. Limite do dia: abertura de amanhã (ou de hoje, se ainda não abriu).
    const abre = proximaAberturaJanela(agora(), config.janelaEnvio);
    await adiar(job, new Date(abre.getTime() + espalhar), bloqueio);
    await registrarEvento({ tipo: "envio_adiado", leadId: job.leadId, payload: { job: job.id, motivo: bloqueio }, resultado: "bloqueado" });
    return "adiada";
  }
  if (bloqueio) {
    await db().centralVendasFila.update({ where: { id: job.id }, data: { status: "descartado", ultimoErro: bloqueio, atualizadoEm: agora() } });
    await registrarEvento({ tipo: "envio_bloqueado", leadId: job.leadId, payload: { job: job.id, motivo: bloqueio, template: p.template ?? null }, resultado: "bloqueado" });
    return "descartada";
  }
  // Intervalo aleatório entre envios seguidos (reduz o risco de bloqueio do número; QR code não é a API oficial).
  if (aguardar) {
    const { intervaloMinSeg: min, intervaloMaxSeg: max } = config;
    await dependencias().dormir(Math.round((min + dependencias().aleatorio() * Math.max(0, max - min)) * 1000));
  }
  let r: ResultadoEnvio;
  try { r = await (dependencias().enviar ?? enviarPadrao)({ numero, texto: p.texto, conexaoId: cv?.conexaoId ?? null, config }); }
  catch (e) { r = { ok: false, externalId: null, conexaoId: null, erro: erroSeguro(e) }; }
  if (!r.ok) { await falhar(job, r.erro ?? "Falha no envio."); return "falhou"; }
  let mensagemId: string | null = null;
  if (r.conexaoId) {
    const lead = job.leadId ? await dadosDoLead(job.leadId) : null;
    const m = await db().mensagemWhatsapp.create({
      data: {
        conexaoId: r.conexaoId, leadId: job.leadId, destinatario: numero, nomeDestinatario: lead?.nome ?? null, mensagem: p.texto.slice(0, 4000),
        externalId: r.externalId, status: "enviada", direcao: "saida", lida: true, enviadaEm: agora(),
      },
      select: { id: true },
    });
    mensagemId = m.id;
  }
  await db().centralVendasFila.update({ where: { id: job.id }, data: { status: "concluido", mensagemId, concluidoEm: agora(), ultimoErro: null, atualizadoEm: agora() } });
  if (job.leadId) {
    await db().centralVendasLead.updateMany({
      where: { leadId: job.leadId },
      data: { ultimaMensagemEnviadaEm: agora(), ...(r.conexaoId && !cv?.conexaoId ? { conexaoId: r.conexaoId } : {}), atualizadoEm: agora() },
    });
    await db().centralVendasLead.updateMany({ where: { leadId: job.leadId, primeiraRespostaEm: null }, data: { primeiraRespostaEm: agora() } });
  }
  await registrarEvento({ tipo: "mensagem_enviada", leadId: job.leadId, payload: { job: job.id, template: p.template ?? "ia", proativa: job.proativa } });
  return "enviada";
}

async function reivindicar(ids?: number[]): Promise<Job | null> {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const cand = await db().centralVendasFila.findFirst({
      where: { status: "pendente", proximaTentativaEm: { lte: agora() }, ...(ids ? { id: { in: ids.length ? ids : [-1] } } : {}) },
      orderBy: [{ proximaTentativaEm: "asc" }, { id: "asc" }], select: { id: true },
    });
    if (!cand) return null;
    const r = await db().centralVendasFila.updateMany({
      where: { id: cand.id, status: "pendente" },
      data: { status: "processando", tentativas: { increment: 1 }, atualizadoEm: agora() },
    });
    if (r.count) return db().centralVendasFila.findUnique({ where: { id: cand.id } });
  }
  return null;
}

/**
 * Processa a fila (ou só `ids`). Intervalo aleatório entre envios (configurável) e limite de tempo para caber
 * na função da Vercel; o que sobrar fica para a próxima rodada.
 */
export async function processarFila(opcoes: { ids?: number[]; limiteMs?: number } = {}) {
  const inicio = Date.now();
  const config = await carregarConfig();
  const resumo = { enviadas: 0, adiadas: 0, descartadas: 0, falhas: 0, ia: 0 };
  let enviouAntes = false;
  for (let i = 0; i < 200; i++) {
    if (Date.now() - inicio > (opcoes.limiteMs ?? 40_000)) break;
    const job = await reivindicar(opcoes.ids);
    if (!job) break;
    try {
      if (job.tipo === "ia") {
        const { processarJobIA } = await import("./ia");
        await processarJobIA(job);
        await db().centralVendasFila.update({ where: { id: job.id }, data: { status: "concluido", concluidoEm: agora(), atualizadoEm: agora() } });
        resumo.ia++;
        continue;
      }
      const r = await processarMensagem(job, config, enviouAntes);
      if (r === "enviada") { resumo.enviadas++; enviouAntes = true; }
      else if (r === "adiada") resumo.adiadas++;
      else if (r === "descartada") resumo.descartadas++;
      else resumo.falhas++;
    } catch (e) {
      await falhar(job, erroSeguro(e));
      resumo.falhas++;
    }
  }
  return resumo;
}

/** Item que ficou "processando" (queda no meio do envio) vira "incerto": nunca é reenviado sozinho. */
export async function marcarIncertos() {
  const limite = new Date(agora().getTime() - 10 * 60_000);
  const presos = await db().centralVendasFila.findMany({ where: { status: "processando", atualizadoEm: { lt: limite } }, select: { id: true, leadId: true } });
  let n = 0;
  for (const j of presos) {
    const r = await db().centralVendasFila.updateMany({ where: { id: j.id, status: "processando" }, data: { status: "incerto", atualizadoEm: agora() } });
    if (!r.count) continue;
    n++;
    await registrarEvento({ tipo: "envio_incerto", leadId: j.leadId, payload: { job: j.id }, resultado: "erro", chave: `incerto:${j.id}` });
  }
  return n;
}

/** Cancela o que ainda não saiu para o lead (opt-out). */
export async function cancelarPendentes(leadId: string, motivo: string) {
  await db().centralVendasFila.updateMany({
    where: { leadId, status: "pendente", tipo: "mensagem" },
    data: { status: "descartado", ultimoErro: motivo, atualizadoEm: agora() },
  });
}
