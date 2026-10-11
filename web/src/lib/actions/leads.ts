"use server";
import { obterAtorCrm, autorizarLeadDoAtor, exigirAtorInterno } from "@/lib/crm/acesso-lead";
import { registrarMudancaEtapa } from "@/lib/crm/pipeline-transicao";
import { criarVisita } from "@/lib/actions/agenda";
import { isLeadStage, leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { LEAD_STATUS_CONFIG, INTERACTION_CONFIG } from "@/lib/types/crm";

import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  propagarDadosClienteDoLead,
  resolverResponsavelId,
  sincronizarServicosDoLead,
  transacaoCRM,
  bloquearLead,
  adicionarOperacaoDoLead,
} from "@/lib/crm/vinculo-lead";
import { SERVICOS_LEAD, parseServicosLead } from "@/lib/crm/servicos-lead";

function validarServicos(raw: FormDataEntryValue[], legados: string[] = []) {
  const servicos = [...new Set(raw.map(String))];
  if (!servicos.length || servicos.some((s) => !SERVICOS_LEAD.includes(s as typeof SERVICOS_LEAD[number]) && !legados.includes(s))) throw new Error("Selecione serviços válidos.");
  return servicos;
}

function texto(formData: FormData, campo: string, max = 255) {
  const valor = String(formData.get(campo) ?? "").trim();
  if (valor.length > max) throw new Error(`Campo ${campo} excede o tamanho permitido.`);
  return valor;
}

function orcamentoDoFormulario(formData: FormData) {
  const raw = texto(formData, "orcamento", 40);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("Orçamento inválido.");
  return n;
}

export async function criarLead(formData: FormData) {
  const ator = await obterAtorCrm();
  const servicos = validarServicos(formData.getAll("servicos"));
  const nome = texto(formData, "nome");
  const telefone = texto(formData, "telefone", 40);
  if (!nome) throw new Error("Informe o nome do cliente.");
  const requestKey = texto(formData, "requestKey", 100);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) throw new Error("Recarregue o formulário antes de cadastrar.");

  const senhaRaw = (formData.get("senha") as string) || null;
  const senhaHash = senhaRaw ? await bcrypt.hash(senhaRaw, 10) : null;

  // Responsável = usuário real do sistema; sem escolha explícita, quem cadastrou.
  const responsavelId =
    (await resolverResponsavelId(formData.get("responsavelId") as string)) ??
    (await resolverResponsavelId(ator.id));

  await transacaoCRM(async (tx) => {
    const existente = await tx.lead.findUnique({ where: { creationRequestKey: `${ator.id}:${requestKey}` } });
    if (existente) { autorizarLeadDoAtor(ator, existente); return existente; }
    const criado = await tx.lead.create({
    data: {
      nome,
      telefone,
      email: (formData.get("email") as string) || undefined,
      servico: JSON.stringify(servicos),
      etapaOperacional: "novo_lead",
      creationRequestKey: `${ator.id}:${requestKey}`,
      origem: (formData.get("origem") as string) || "site",
      orcamento: orcamentoDoFormulario(formData),
      notas: (formData.get("notas") as string) || "",
      corretorId: ator.papel === "corretor" ? ator.corretorId : (formData.get("corretorId") as string) || undefined,
      responsavelId,
      senhaAcesso: senhaHash,
    },
    });
    await sincronizarServicosDoLead(criado.id, tx);
    await tx.interacao.create({ data: { leadId: criado.id, tipo: "nota", descricao: "Lead cadastrado na etapa NOVO LEAD; serviços persistidos no mesmo commit.", criadoPor: ator.nome } });
    return criado;
  });

  // Vínculo real (EPIC-007): cada serviço operacional marcado ganha um registro
  // no módulo correspondente, já com os dados do cliente copiados do lead.

  await notificarAdmins("novo_lead", "Novo lead cadastrado", `${nome} — ${JSON.stringify(servicos)}`, "/admin/leads").catch(() => {});
  revalidarModulosVinculados();
  // O lead foi salvo, mas algum serviço ficou sem registro operacional: em vez
  // de fingir sucesso, abre o lead com o aviso (salvar de novo tenta outra vez).
  redirect("/admin/leads");
}

function revalidarModulosVinculados() {
  for (const rota of ["/admin/leads", "/admin", "/admin/financiamentos", "/admin/obras", "/admin/projetos", "/admin/regularizacao", "/admin/avaliacoes"]) {
    revalidatePath(rota);
  }
}

// Formulário público de /contato — não autenticado por natureza (visitante do
// site, não usuário do CRM). NÃO adicionar checagem de sessão aqui.
export async function enviarContato(formData: FormData) {
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;
  const email = (formData.get("email") as string) || undefined;
  const servicos = formData.getAll("servicos") as string[];
  const mensagem = (formData.get("mensagem") as string) || "";

  if (!nome || !telefone || servicos.length === 0) return;

  await prisma.lead.create({
    data: {
      nome, telefone, email,
      servico: JSON.stringify(servicos),
      origem: "site",
      etapaOperacional: "novo_lead",
      notas: mensagem,
    },
  });
  await notificarAdmins("novo_lead", "Novo contato do site", `${nome} — ${servicos.join(", ")}`, "/admin/leads").catch(() => {});

  const { notifyAdminByEmail } = await import("@/lib/email");
  await notifyAdminByEmail({
    titulo: "Nova mensagem recebida pelo site (Contato)",
    linhas: [
      { label: "Nome", valor: nome },
      { label: "Telefone", valor: telefone },
      { label: "Email", valor: email || "" },
      { label: "Serviços", valor: servicos.join(", ") },
      { label: "Mensagem", valor: mensagem },
    ],
  }).catch(() => {});

  revalidatePath("/admin/leads");
  redirect("/contato?enviado=1");
}

export async function editarLead(formData: FormData) {
  const ator = await obterAtorCrm();
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, id);
    const atual = await tx.lead.findUniqueOrThrow({ where: { id } });
    autorizarLeadDoAtor(ator, atual);
    if (atual.excluidoEm || atual.arquivadoEm) throw new Error("Restaure o lead antes de editar.");
    if (String(formData.get("atualizadoEm")) !== atual.atualizadoEm.toISOString() || String(formData.get("etapaAnterior") ?? "") !== (atual.etapaOperacional ?? "")) throw new Error("Este lead foi atualizado. Recarregue antes de salvar.");
    const servicos = validarServicos(formData.getAll("servicos"), parseServicosLead(atual.servico));
    const etapa = texto(formData, "etapaOperacional", 50);
    if (etapa && etapa !== atual.etapaOperacional) await registrarMudancaEtapa(tx, atual, etapa, ator.nome);
    const nome = texto(formData, "nome");
    if (!nome) throw new Error("Informe o nome do cliente.");
    const lead = await tx.lead.update({
    where: { id },
    data: {
      nome,
      telefone: texto(formData, "telefone", 40),
      email: (formData.get("email") as string) || null,
      servico: JSON.stringify(servicos),
      origem: (formData.get("origem") as string) || "site",
      orcamento: orcamentoDoFormulario(formData),
      notas: (formData.get("notas") as string) || "",
      // "Sem corretor" precisa desvincular de verdade (antes `undefined` mantinha o antigo).
      corretorId: ator.papel === "corretor" ? ator.corretorId : (formData.get("corretorId") as string) || null,
      responsavelId: await resolverResponsavelId(formData.get("responsavelId") as string),
    },
    select: { id: true, nome: true, telefone: true, email: true },
    });

  // Lead é a fonte única dos dados do cliente: reflete a edição nos registros
  // vinculados e cria os registros dos serviços recém-marcados.
    await propagarDadosClienteDoLead(lead, tx);
    await sincronizarServicosDoLead(lead.id, tx);
  });

  revalidarModulosVinculados();
  revalidatePath(`/admin/leads/${id}`);
  // Com falha, o detalhe do lead mostra quais serviços ficaram sem registro.
  redirect(`/admin/leads/${id}`);
}

/** Nova operação legítima do mesmo tipo só nasce de uma intenção explícita no CRM. */
export async function adicionarOperacaoLead(leadId: string, servico: string, requestKey: string) {
  const ator = await obterAtorCrm();
  exigirAtorInterno(ator);
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, leadId);
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    autorizarLeadDoAtor(ator, lead);
    if (lead.excluidoEm || lead.arquivadoEm || ["perdido", "arquivado", "excluido"].includes(lead.status)) throw new Error("Selecione um lead ativo.");
    const registro = await adicionarOperacaoDoLead(tx, leadId, servico, requestKey);
    // Reenvios são idempotentes também na trilha de auditoria.
    const descricao = `Operação vinculada pelo CRM: ${servico} (${registro.id}).`;
    if (!await tx.interacao.findFirst({ where: { leadId, descricao } })) await tx.interacao.create({ data: { leadId, tipo: "nota", descricao, criadoPor: ator.nome } });
  });
  revalidarModulosVinculados();
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function excluirLead(id: string) {
  const ator = await obterAtorCrm();
  exigirAtorInterno(ator);
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, id);
    const lead = await tx.lead.findUnique({ where: { id } });
    autorizarLeadDoAtor(ator, lead);
    if (!lead || lead.excluidoEm) return;
    await tx.lead.update({ where: { id }, data: { excluidoEm: new Date() } });
    await tx.interacao.create({ data: { leadId: id, tipo: "nota", descricao: "Lead excluído da operação. Cadastro, histórico e serviços vinculados preservados.", criadoPor: ator.nome } });
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
}

export async function arquivarLead(id: string, arquivar: boolean) {
  if (typeof arquivar !== "boolean") throw new Error("Situação inválida.");
  const ator = await obterAtorCrm();
  exigirAtorInterno(ator);
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, id);
    const lead = await tx.lead.findUnique({ where: { id } });
    autorizarLeadDoAtor(ator, lead);
    if (!lead || lead.excluidoEm) throw new Error("Lead excluído.");
    if (!!lead.arquivadoEm === arquivar) return;
    await tx.lead.update({ where: { id }, data: { arquivadoEm: arquivar ? new Date() : null } });
    await tx.interacao.create({ data: { leadId: id, tipo: "nota", descricao: arquivar ? "Lead arquivado; etapa e status comercial preservados." : "Arquivamento removido; etapa e status comercial preservados.", criadoPor: ator.nome } });
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
}

export async function alterarEtapaLead(leadId: string, etapa: string, etapaAnterior: string | null, atualizadoEm: string) {
  if (!isLeadStage(etapa) || (etapaAnterior !== null && !isLeadStage(etapaAnterior))) throw new Error("Etapa operacional inválida.");
  if (!atualizadoEm || Number.isNaN(new Date(atualizadoEm).getTime())) throw new Error("Versão do lead inválida.");
  const ator = await obterAtorCrm();
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, leadId);
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    autorizarLeadDoAtor(ator, lead);
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.etapaOperacional !== etapaAnterior || lead.atualizadoEm.getTime() !== new Date(atualizadoEm).getTime()) throw new Error("Este lead foi atualizado por outra pessoa. Recarregue e tente novamente.");
    await registrarMudancaEtapa(tx, lead, etapa, ator.nome);
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

// Compatibilidade com consumidores legados: os estados comerciais continuam
// separados das etapas operacionais e cada alteração tem histórico transacional.
export async function alterarStatusLead(leadId: string, status: string) {
  if (!Object.prototype.hasOwnProperty.call(LEAD_STATUS_CONFIG, status)) throw new Error("Status comercial inválido.");
  const ator = await obterAtorCrm();
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, leadId);
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    autorizarLeadDoAtor(ator, lead);
    if (!lead || lead.excluidoEm || lead.arquivadoEm) throw new Error("Lead indisponível para alteração.");
    if (lead.status === status) return;
    const result = await tx.lead.updateMany({ where: { id: leadId, atualizadoEm: lead.atualizadoEm, status: lead.status }, data: { status } });
    if (result.count !== 1) throw new Error("Este lead foi atualizado. Recarregue e tente novamente.");
    await tx.interacao.create({ data: { leadId, tipo: "nota", descricao: `Status comercial: ${lead.status} → ${status}. Etapa operacional preservada.`, criadoPor: ator.nome } });
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function adicionarInteracao(formData: FormData) {
  const ator = await obterAtorCrm();
  const leadId = String(formData.get("leadId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!Object.prototype.hasOwnProperty.call(INTERACTION_CONFIG, tipo) || !descricao || descricao.length > 10000) throw new Error("Informe um tipo e uma descrição de interação válidos.");
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, leadId);
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    autorizarLeadDoAtor(ator, lead);
    if (!lead || lead.excluidoEm) throw new Error("Lead indisponível para alteração.");
    await tx.interacao.create({ data: { leadId, tipo, descricao, criadoPor: ator.nome } });
  });
  revalidatePath(`/admin/leads/${leadId}`);
}

/** Agendamento iniciado pelo CRM sempre resolve e autoriza o lead no servidor. */
export async function agendarVisitaDoLead(formData: FormData) {
  const ator = await obterAtorCrm();
  const leadId = texto(formData, "leadId", 100);
  const data = texto(formData, "agendadaPara", 50);
  if (!leadId || !data || Number.isNaN(new Date(data).getTime())) throw new Error("Informe lead e data válidos.");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  autorizarLeadDoAtor(ator, lead);
  if (!lead || !leadNoPipelineAtivo(lead)) throw new Error("Agendamento disponível somente para lead ativo.");
  const campos = new FormData();
  campos.set("leadId", leadId);
  campos.set("agendadaPara", data);
  campos.set("notas", texto(formData, "notas", 10000));
  if (ator.corretorId) campos.set("corretorId", ator.corretorId);
  else campos.set("colaboradorNome", ator.nome);
  await criarVisita(campos);
}
