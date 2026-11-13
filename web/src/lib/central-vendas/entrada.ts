import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/entrada.ts).
// Serviço único de entrada de leads (WhatsApp, site e Logyca), com deduplicação pela chave do telefone (DDD + 8
// últimos dígitos) e pela origem + ID externo, e origem pela campanha ([ref:...]). A reivindicação do telefone
// (central_vendas_contatos) garante um lead só, mesmo com avisos simultâneos.
import { chaveTelefone } from "@/lib/whatsapp/conversas";
import { leadDoVinculo, leadPorTelefone } from "@/lib/whatsapp/webhook-evolution";
import { ehOptOut, extrairRef, numeroAutorizado, origemDoRef } from "./regras";
import { agora, atualizarCentral, carregarConfig, db, erroSeguro, registrarEvento, registrarInteracao, registroCentral } from "./base";
import { atribuirOperador } from "./distribuicao";
import { cancelarPendentes, enfileirar, enfileirarTemplate, processarFila } from "./envio";

export type OrigemContato = "whatsapp" | "site" | "logyca";
export type Contato = {
  origem: OrigemContato; telefone: string; nome?: string | null; texto?: string | null; idExterno?: string | null;
  campanha?: string | null; email?: string | null; cidade?: string | null; conexaoId?: string | null;
};
export type ResultadoEntrada = { leadId: string | null; criado: boolean; motivo?: string };

const nomePadrao = (digitos: string) => `WhatsApp ${digitos}`;
const digitosSem55 = (t: string) => t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

/** Mesma regra do webhook da Evolution: vínculo manual da conversa primeiro, depois o telefone. */
async function leadAtivoPorTelefone(telefone: string, conexaoId?: string | null): Promise<string | null> {
  if (conexaoId) {
    const v = await leadDoVinculo(conexaoId, telefone);
    if (v) return v.id;
  }
  return (await leadPorTelefone(telefone))?.id ?? null;
}

/** Lead que já existia no CRM entra na Central em atendimento humano (a IA só atende quem chegou pela Central). */
async function garantirRegistro(leadId: string, c: Contato) {
  const l = await db().lead.findUnique({ where: { id: leadId }, select: { responsavelId: true, nome: true } });
  const criado = await db().centralVendasLead.createMany({
    data: [{
      leadId, origem: "crm", statusAtendimento: "em_atendimento_humano", operadorId: l?.responsavelId ?? null,
      atribuidoEm: l?.responsavelId ? agora() : null, conexaoId: c.conexaoId ?? null, criadoEm: agora(), atualizadoEm: agora(),
    }],
    skipDuplicates: true,
  });
  if (criado.count) await registrarEvento({ tipo: "lead_existente_vinculado", leadId, origem: c.origem });
  // Fonte oficial é o Santa Fé: dado divergente vindo da Logyca não sobrescreve, só é registrado.
  if (c.origem === "logyca" && c.nome && l?.nome && !/^whatsapp\s/i.test(l.nome) && c.nome.trim().toLowerCase() !== l.nome.trim().toLowerCase()) {
    await registrarEvento({ tipo: "conflito_logyca", leadId, origem: "logyca", payload: { campos: ["nome"], prevalece: "santa_fe" }, resultado: "ignorado" });
  }
}

export async function receberContato(c: Contato): Promise<ResultadoEntrada> {
  const config = await carregarConfig();
  if (!config.ativo) return { leadId: null, criado: false, motivo: "desligado" };
  const phoneKey = chaveTelefone(c.telefone);
  if (phoneKey.length < 10) return { leadId: null, criado: false, motivo: "telefone_invalido" };
  if (config.modoTeste && !numeroAutorizado(c.telefone, config.numerosTeste)) {
    await registrarEvento({ tipo: "ignorado_modo_teste", origem: c.origem, resultado: "ignorado" });
    return { leadId: null, criado: false, motivo: "modo_teste" };
  }
  const idExterno = c.idExterno?.trim().slice(0, 160) || null;
  if (idExterno) {
    const ja = await db().centralVendasLead.findFirst({ where: { origem: c.origem, idExterno }, select: { leadId: true } });
    if (ja) return { leadId: ja.leadId, criado: false, motivo: "id_externo_repetido" };
  }
  const existente = await leadAtivoPorTelefone(c.telefone, c.conexaoId);
  if (existente) { await garantirRegistro(existente, c); return { leadId: existente, criado: false }; }

  // Reivindica o telefone: só quem reivindicar cria o lead (avisos repetidos/simultâneos não duplicam).
  let reivindicado = (await db().centralVendasContato.createMany({ data: [{ chaveTelefone: phoneKey, criadoEm: agora() }], skipDuplicates: true })).count > 0;
  if (!reivindicado) {
    const ct = await db().centralVendasContato.findUnique({ where: { chaveTelefone: phoneKey } });
    const ativo = ct?.leadId ? await db().lead.findFirst({ where: { id: ct.leadId, excluidoEm: null }, select: { id: true } }) : null;
    if (ativo) { await garantirRegistro(ativo.id, c); return { leadId: ativo.id, criado: false }; }
    if (!ct?.leadId) return { leadId: null, criado: false, motivo: "em_processamento" };
    // O lead antigo deste telefone foi excluído: libera a reivindicação uma única vez.
    reivindicado = (await db().centralVendasContato.updateMany({ where: { chaveTelefone: phoneKey, leadId: ct.leadId }, data: { leadId: null } })).count > 0;
    if (!reivindicado) return { leadId: null, criado: false, motivo: "em_processamento" };
  }

  const ref = extrairRef(c.texto) ?? (c.campanha ? c.campanha.trim().toLowerCase() : null);
  const [campanhas, produtos] = await Promise.all([
    db().centralVendasCampanha.findMany({ where: { ativo: true }, select: { codigo: true, canal: true, produtoId: true } }),
    db().centralVendasProduto.findMany({ where: { ativo: true }, select: { id: true, slug: true, checklistId: true } }),
  ]);
  const origem = origemDoRef(ref, campanhas, produtos);
  const digitos = digitosSem55(c.telefone);
  const lead = await db().lead.create({
    data: {
      nome: c.nome?.trim().slice(0, 255) || nomePadrao(digitos), telefone: digitos.slice(0, 20), email: c.email?.trim().slice(0, 320) || null,
      servico: "[]", origem: (origem.canal ?? c.origem).slice(0, 100), status: "novo", etapaOperacional: "novo_lead", criadoEm: agora(),
    },
    select: { id: true },
  });
  await db().centralVendasContato.updateMany({ where: { chaveTelefone: phoneKey }, data: { leadId: lead.id } });
  const produto = produtos.find(p => p.id === origem.produtoId);
  await db().centralVendasLead.createMany({
    data: [{
      leadId: lead.id, origem: c.origem, idExterno, campanha: origem.campanha, produtoId: origem.produtoId, checklistId: produto?.checklistId ?? null,
      conexaoId: c.conexaoId ?? null, cidade: c.cidade?.trim().slice(0, 100) || null,
      primeiraMensagemEm: c.texto ? agora() : null, ultimaMensagemClienteEm: c.texto ? agora() : null, criadoEm: agora(), atualizadoEm: agora(),
    }],
    skipDuplicates: true,
  });
  await registrarInteracao(lead.id, `Lead criado automaticamente pela Central de Vendas (origem: ${origem.canal ?? c.origem}${origem.campanha ? `, campanha ${origem.campanha}` : ""}).`);
  await registrarEvento({ tipo: "lead_criado", leadId: lead.id, origem: c.origem, payload: { canal: origem.canal, campanha: origem.campanha, produtoId: origem.produtoId } });
  await atribuirOperador(lead.id);
  return { leadId: lead.id, criado: true };
}

const STATUS_DA_IA = new Set(["novo", "em_atendimento_ia", "aguardando_cliente", "sem_resposta"]);

/**
 * Gancho do webhook da Evolution, chamado depois de gravar a mensagem recebida (e a mídia). Nunca lança:
 * a falha fica na auditoria e o aviso da Evolution continua respondendo 200.
 */
export async function aoReceberMensagemWhatsapp(m: { conexaoId: string; mensagemId: string; numero: string; nome?: string | null; texto: string; temMidia: boolean; leadIdDaMensagem: string | null }) {
  try {
    const config = await carregarConfig();
    if (!config.ativo) return { r: "desligado" };
    const entrada = await receberContato({ origem: "whatsapp", telefone: m.numero, nome: m.nome, texto: m.texto, conexaoId: m.conexaoId });
    if (!entrada.leadId) return { r: entrada.motivo ?? "sem-lead" };
    const leadId = entrada.leadId;
    if (m.leadIdDaMensagem !== leadId) await db().mensagemWhatsapp.update({ where: { id: m.mensagemId }, data: { leadId } });
    const cv = await registroCentral(leadId);
    if (!cv) return { r: "sem-registro" };
    const voltaParaIA = cv.statusAtendimento === "sem_resposta" || cv.statusAtendimento === "aguardando_cliente";
    await db().centralVendasLead.updateMany({
      where: { leadId },
      data: { ultimaMensagemClienteEm: agora(), conexaoId: cv.conexaoId ?? m.conexaoId, ...(voltaParaIA ? { statusAtendimento: "em_atendimento_ia" } : {}), atualizadoEm: agora() },
    });
    await db().centralVendasLead.updateMany({ where: { leadId, primeiraMensagemEm: null }, data: { primeiraMensagemEm: agora() } });

    if (ehOptOut(m.texto)) {
      if (!cv.optOut) {
        await atualizarCentral(leadId, { optOut: true, optOutEm: agora() });
        await cancelarPendentes(leadId, "opt_out");
        await registrarEvento({ tipo: "opt_out", leadId, origem: "whatsapp" });
        const job = await enfileirarTemplate({ leadId, slug: "cv-optout-confirmacao", chave: `optout:${leadId}:${m.mensagemId}`, proativa: false, ignorarOptOut: true });
        if (job) await processarFila({ ids: [job.id] });
      }
      return { r: "opt_out" };
    }
    if (cv.optOut) return { r: "opt_out_ativo" };

    if (m.temMidia) {
      const { receberMidia } = await import("./documentos");
      await receberMidia(leadId, m.mensagemId);
      return { r: "midia" };
    }
    if (!STATUS_DA_IA.has(cv.statusAtendimento)) return { r: "humano" };
    if (!config.automacoes.ia) {
      const { transferirParaHumano } = await import("./ia");
      await transferirParaHumano(leadId, "ia_desligada");
      return { r: "ia_desligada" };
    }
    const job = await enfileirar({ chave: `ia:${m.mensagemId}`, tipo: "ia", leadId, payload: { messageId: m.mensagemId } });
    if (job) await processarFila({ ids: [job.id] });
    return { r: "ia" };
  } catch (e) {
    await registrarEvento({ tipo: "erro_entrada_whatsapp", origem: "whatsapp", resultado: "erro", erro: erroSeguro(e) }).catch(() => undefined);
    return { r: "erro" };
  }
}
