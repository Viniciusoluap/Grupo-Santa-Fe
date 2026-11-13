import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/documentos.ts).
// Documentação: checklist por produto/modalidade (editável em tela), lista de pendentes após a qualificação,
// classificação de cada mídia recebida (só metadados: o arquivo nunca sai do sistema), lembretes D+N pelo cron
// diário e o gatilho principal: checklist completo → análise, uma única vez.
// No Santa Fé o documento classificado entra no checklist de documentos do CRM (documentos_cliente +
// documentos_cliente_versoes + arquivos), do mesmo jeito que o upload feito pela equipe.
import { DOCUMENTOS_CLIENTE } from "@/lib/documentos-cliente-padrao";
import { lerItensChecklist, type ConfigCentral } from "./config";
import { classificarPorNome, pendentesDoChecklist, type ItemChecklistLite } from "./regras";
import { agora, avisar, carregarConfig, dadosDoLead, db, registrarEvento, registrarInteracao, registroCentral, usuariosAtivos, type RegistroCentral } from "./base";
import { enfileirarTemplate, processarFila } from "./envio";

const LIMIAR_DOCUMENTO = 0.7;

export async function checklistDoLead(cv: RegistroCentral, config: ConfigCentral): Promise<ItemChecklistLite[]> {
  let id = cv.checklistId;
  if (!id && cv.produtoId) {
    const p = await db().centralVendasProduto.findUnique({ where: { id: cv.produtoId }, select: { checklistId: true } });
    id = p?.checklistId ?? null;
  }
  id ??= config.checklistPadraoId;
  if (!id) return [];
  const c = await db().centralVendasChecklist.findFirst({ where: { id, ativo: true } });
  return c ? lerItensChecklist(c.documentos) : [];
}

/** Chaves do checklist já recebidas (arquivo ainda existe e segue no documento do CRM). "A conferir" conta: o fluxo não para. */
async function chavesRecebidas(leadId: string): Promise<string[]> {
  const docs = await db().centralVendasDocumento.findMany({ where: { leadId, chave: { not: null } }, select: { chave: true, arquivoId: true } });
  if (!docs.length) return [];
  const ids = docs.map(d => d.arquivoId);
  const [arquivos, atuais, versoes] = await Promise.all([
    db().arquivo.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    db().documentoCliente.findMany({ where: { leadId, arquivoId: { in: ids } }, select: { arquivoId: true } }),
    db().documentoClienteVersao.findMany({ where: { leadId, arquivoId: { in: ids } }, select: { arquivoId: true } }),
  ]);
  const existe = new Set(arquivos.map(a => a.id));
  const usado = new Set([...atuais.map(a => a.arquivoId), ...versoes.map(v => v.arquivoId)]);
  return docs.filter(d => existe.has(d.arquivoId) && usado.has(d.arquivoId)).map(d => d.chave!);
}

export const listaPorExtenso = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

export async function documentosPendentes(leadId: string) {
  const cv = await registroCentral(leadId);
  if (!cv) return { itens: [], pendentes: [] as ItemChecklistLite[] };
  const itens = await checklistDoLead(cv, await carregarConfig());
  return { itens, pendentes: pendentesDoChecklist(itens, await chavesRecebidas(leadId)) };
}

/** Envia a lista de documentos pendentes (após a qualificação ou após pendência da análise). */
export async function solicitarDocumentos(leadId: string, motivo: "qualificacao" | "pendencia") {
  const { itens, pendentes } = await documentosPendentes(leadId);
  const cv = await registroCentral(leadId);
  if (!cv) return;
  if (!itens.length) {
    await registrarEvento({ tipo: "sem_checklist", leadId, resultado: "erro", erro: "Nenhum checklist para o produto/modalidade do lead nem checklist padrão." });
    await avisar([cv.operadorId], "Central de Vendas: lead qualificado sem checklist", "Cadastre um checklist (Central de Vendas › Checklists) ou escolha o checklist padrão para enviar a lista de documentos.", leadId);
    return;
  }
  if (!pendentes.length) { await verificarDocumentacao(leadId); return; }
  const quando = agora();
  await db().centralVendasLead.updateMany({
    where: { leadId },
    data: {
      statusDocumental: pendentes.length < itens.filter(i => i.obrigatorio).length ? "parcial" : "aguardando_documentos",
      docsSolicitadosEm: quando, statusAtendimento: cv.statusAtendimento === "em_atendimento_humano" ? cv.statusAtendimento : "aguardando_cliente", atualizadoEm: quando,
    },
  });
  await registrarEvento({ tipo: "documentos_solicitados", leadId, payload: { motivo, pendentes: pendentes.map(p => p.chave) } });
  if (motivo === "qualificacao") {
    const job = await enfileirarTemplate({ leadId, slug: "cv-documentos-pendentes", chave: `docs:${leadId}:${quando.toISOString()}`, proativa: false, documentos: listaPorExtenso(pendentes.map(p => p.nome)) });
    if (job) await processarFila({ ids: [job.id] });
  }
}

/** Mídia recebida (já guardada em whatsapp_midias e copiada ao Drive) → documento do lead, classificado. */
export async function receberMidia(leadId: string, mensagemId: string) {
  const config = await carregarConfig();
  if (!config.automacoes.documentos) return null;
  const ja = await db().centralVendasDocumento.findUnique({ where: { mensagemId }, select: { id: true } });
  if (ja) return null;
  const m = await db().mensagemWhatsapp.findUnique({
    where: { id: mensagemId },
    select: { midiaNome: true, midiaMime: true, midiaTamanho: true, mensagem: true, midiaTipo: true, midia: { select: { conteudo: true } } },
  });
  if (!m || !m.midiaTipo || m.midiaTipo === "audio" || m.midiaTipo === "figurinha") return null;
  const cv = await registroCentral(leadId);
  if (!cv) return null;
  if (!m.midia?.conteudo?.length) {
    // O arquivo não chegou da Evolution (ou passou de 10 MB): sem bytes não há documento; a equipe confere.
    await registrarEvento({ tipo: "documento_sem_arquivo", leadId, resultado: "erro", erro: "Mídia sem arquivo guardado." });
    await avisar([cv.operadorId], "Central de Vendas: documento sem arquivo", "O cliente mandou um arquivo que não foi baixado do WhatsApp. Use \"tentar baixar de novo\" na conversa e confira no lead.", leadId);
    return null;
  }
  const itens = await checklistDoLead(cv, config);
  const recebidas = await chavesRecebidas(leadId);
  const candidatos = pendentesDoChecklist(itens, recebidas).length ? pendentesDoChecklist(itens, recebidas) : itens;
  // Legenda escrita pelo cliente (o texto gravado traz "[documento] nome-do-arquivo" antes dela).
  let legenda = m.mensagem.replace(/^\[(imagem|documento|vídeo)\]\s*/i, "");
  if (m.midiaNome && legenda.startsWith(m.midiaNome)) legenda = legenda.slice(m.midiaNome.length).trim();
  const texto = `${m.midiaNome ?? ""} ${legenda}`;
  let classe = classificarPorNome(texto, candidatos) ?? classificarPorNome(texto, itens);
  if (!classe) {
    const { classificarDocumentoIA } = await import("./ia");
    classe = await classificarDocumentoIA({ nome: m.midiaNome, mime: m.midiaMime, legenda }, candidatos, leadId);
  }
  const item = classe ? itens.find(i => i.chave === classe!.chave) : undefined;
  const aConferir = !item || (classe?.confianca ?? 0) < LIMIAR_DOCUMENTO;
  const tipo = item && DOCUMENTOS_CLIENTE.some(d => d.chave === item.tipo) ? item.tipo : "other";
  const conteudo = m.midia.conteudo;
  const vinculado = await db().$transaction(async tx => {
    // Reivindica a mensagem antes de gravar o documento: aviso repetido em paralelo não duplica.
    const arquivo = await tx.arquivo.create({ data: { nome: (m.midiaNome ?? `whatsapp-${mensagemId}`).slice(0, 200), mime: m.midiaMime ?? "application/octet-stream", tamanho: conteudo.length, dados: conteudo } });
    const r = await tx.centralVendasDocumento.createMany({
      data: [{ leadId, documentoClienteId: "", arquivoId: arquivo.id, mensagemId, chave: aConferir && !item ? null : item?.chave ?? null, confianca: (classe?.confianca ?? 0).toFixed(3), aConferir, criadoEm: agora() }],
      skipDuplicates: true,
    });
    if (!r.count) { await tx.arquivo.delete({ where: { id: arquivo.id } }); return null; }
    const doc = await tx.documentoCliente.upsert({ where: { leadId_tipo: { leadId, tipo } }, create: { leadId, tipo }, update: {} });
    await tx.documentoClienteVersao.create({ data: { leadId, tipoChecklist: "crm", itemId: doc.id, arquivoId: arquivo.id, enviadoEm: agora() } });
    if (doc.arquivoId) await tx.documentoClienteVersao.upsert({ where: { arquivoId: doc.arquivoId }, create: { leadId, tipoChecklist: "crm", itemId: doc.id, arquivoId: doc.arquivoId }, update: {} });
    await tx.documentoCliente.update({ where: { id: doc.id }, data: { arquivoId: arquivo.id, enviadoEm: agora() } });
    await tx.centralVendasDocumento.update({ where: { mensagemId }, data: { documentoClienteId: doc.id } });
    return { documentoClienteId: doc.id, arquivoId: arquivo.id };
  });
  if (!vinculado) return null;
  await registrarInteracao(leadId, `Documento recebido pelo WhatsApp${item ? `: ${item.nome}` : ""}${aConferir ? " (a conferir)" : ""}. Classificado pela Central de Vendas (confiança ${Math.round((classe?.confianca ?? 0) * 100)}%).`, "documento");
  await registrarEvento({ tipo: "documento_recebido", leadId, payload: { chave: item?.chave ?? null, confianca: classe?.confianca ?? 0, aConferir } });
  if (aConferir) await avisar([cv.operadorId], "Central de Vendas: documento a conferir", "Um documento recebido pelo WhatsApp não foi identificado com segurança. Confira no lead; o atendimento segue.", leadId);
  await verificarDocumentacao(leadId);
  return { ...vinculado, chave: item?.chave ?? null, aConferir };
}

/** Recalcula o status documental; checklist completo dispara o encaminhamento para análise. */
export async function verificarDocumentacao(leadId: string) {
  const cv = await registroCentral(leadId);
  if (!cv || cv.statusAnalise === "em_analise" || cv.statusAnalise === "aprovado" || cv.statusAnalise === "reprovado") return "sem_mudanca";
  const { itens, pendentes } = await documentosPendentes(leadId);
  if (!itens.length) return "sem_checklist";
  if (!pendentes.length) return (await encaminharParaAnalise(leadId)) ? "encaminhado" : "sem_mudanca";
  const recebidas = (await chavesRecebidas(leadId)).length;
  if (recebidas && cv.statusDocumental !== "parcial") await db().centralVendasLead.updateMany({ where: { leadId }, data: { statusDocumental: "parcial", atualizadoEm: agora() } });
  return "parcial";
}

/** Gatilho principal: exatamente uma vez por ciclo (UPDATE condicionado ao estado anterior). */
export async function encaminharParaAnalise(leadId: string): Promise<boolean> {
  const quando = agora();
  const r = await db().centralVendasLead.updateMany({
    where: { leadId, statusAnalise: { in: ["nao_enviado", "pendente"] } },
    data: { statusDocumental: "completo", statusAnalise: "em_analise", docsCompletosEm: quando, enviadoAnaliseEm: quando, atualizadoEm: quando },
  });
  if (!r.count) return false;
  const cv = (await registroCentral(leadId))!;
  const config = await carregarConfig();
  const lead = await dadosDoLead(leadId);
  const analistas = await usuariosAtivos(config.analistas);
  const [responsavel] = analistas.length ? analistas : await usuariosAtivos(cv.operadorId ? [cv.operadorId] : []);
  const quem = responsavel ?? await db().usuario.findFirst({ where: { papel: "admin", ativo: true }, orderBy: { criadoEm: "asc" }, select: { id: true, nome: true } });
  await db().tarefaCrm.create({
    data: {
      leadId, titulo: `Análise — ${lead?.nome ?? "lead"}`.slice(0, 255),
      descricao: "Documentação completa recebida pela Central de Vendas. Registre a decisão (pendente, aprovado ou reprovado) na Central de Vendas.",
      responsavelId: quem?.id ?? null, status: "pendente", prazo: new Date(quando.getTime() + 24 * 3600_000), criadoEm: quando,
    },
  });
  await registrarInteracao(leadId, "Documentação completa: encaminhado automaticamente para análise.");
  await avisar([...analistas.map(a => a.id), quem?.id], "Central de Vendas: novo cadastro para análise", `${lead?.nome ?? "Cliente"} completou a documentação.`, leadId);
  await registrarEvento({ tipo: "encaminhado_analise", leadId, payload: { responsavel: quem?.id ?? null } });
  const job = await enfileirarTemplate({ leadId, slug: "cv-confirmacao-analise", chave: `analise:${leadId}:${quando.toISOString()}`, proativa: false });
  if (job) await processarFila({ ids: [job.id] });
  return true;
}

/** Lembretes D+N (cron diário): só o maior prazo já vencido de cada pedido; nunca repete o mesmo. */
export async function agendarLembretes() {
  const config = await carregarConfig();
  if (!config.automacoes.lembretes || !config.lembretesDias.length) return 0;
  const linhas = await db().centralVendasLead.findMany({
    where: { statusDocumental: { in: ["aguardando_documentos", "parcial"] }, docsSolicitadosEm: { not: null }, optOut: false, statusAnalise: { in: ["nao_enviado", "pendente"] } },
  });
  let n = 0;
  const dias = [...config.lembretesDias].sort((a, b) => b - a);
  for (const cv of linhas) {
    const base = cv.docsSolicitadosEm!;
    const d = dias.find(x => base.getTime() + x * 86_400_000 <= agora().getTime());
    if (!d) continue;
    const { pendentes } = await documentosPendentes(cv.leadId);
    if (!pendentes.length) continue;
    const job = await enfileirarTemplate({ leadId: cv.leadId, slug: "cv-lembrete-documentos", chave: `lembrete:${cv.leadId}:${d}:${base.toISOString()}`, proativa: true, documentos: listaPorExtenso(pendentes.map(p => p.nome)) });
    if (job) n++;
  }
  return n;
}
