import { DOCUMENTOS_FINANCIAMENTO } from "@/lib/documentos-cliente-padrao";
import { prisma } from "@/lib/db";
import { exigirModuloDoServico } from "@/lib/crm/modulo-do-servico";
import type { Prisma, Financiamento } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { dadosClienteDoLead, moduloDoServico, parseServicosLead, servicoDoModulo, type ModuloServico, type ServicoOperacional } from "./servicos-lead";
import { PAPEIS_RESPONSAVEL, podeSerResponsavel } from "./responsavel";

// Helpers internos: nenhuma função deste arquivo é uma server action pública.
export type TransacaoCRM = Prisma.TransactionClient;

/** Retry cobre somente conflitos de serialização, nunca falhas de aplicação. */
export async function transacaoCRM<T>(operacao: (tx: TransacaoCRM) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await prisma.$transaction(operacao, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    } catch (erro) {
      if ((erro as { code?: string })?.code !== "P2034" || tentativa >= 3) throw erro;
    }
  }
}

/** Serializa alterações do cliente e a materialização de suas demandas. */
export async function bloquearLead(tx: TransacaoCRM, leadId: string) {
  const linhas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
  if (!linhas.length) throw new Error("Lead não encontrado.");
}

export const CHECKLIST_FINANCIAMENTO_PADRAO = DOCUMENTOS_FINANCIAMENTO.map(item => ({ grupo: "Financiamento e imóvel", item }));

/** Migração de apresentação aditiva: arquivos e itens antigos continuam no histórico. */
export async function atualizarChecklistFinanciamento(financiamentoId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM financiamentos WHERE id = ${financiamentoId} FOR UPDATE`;
    const itens = await tx.checklistItem.findMany({where: {financiamentoId}});
    for (const item of DOCUMENTOS_FINANCIAMENTO) {
      const existente = itens.find(i => i.item === item);
      if (existente) await tx.checklistItem.update({where:{id:existente.id},data:{legado:false}});
      else await tx.checklistItem.create({data:{financiamentoId,grupo:"Financiamento e imóvel",item}});
    }
    await tx.checklistItem.updateMany({where:{financiamentoId,item:{notIn:[...DOCUMENTOS_FINANCIAMENTO]}},data:{legado:true}});
  });
}



type DadosFinanciamento = Parameters<typeof prisma.financiamento.create>[0]["data"];
export async function criarFinanciamentoComChecklist(data: DadosFinanciamento, tx?: TransacaoCRM): Promise<Financiamento> {
  if (!tx) return transacaoCRM((t) => criarFinanciamentoComChecklist(data, t));
  const fin = await tx.financiamento.create({ data });
  await tx.checklistItem.createMany({ data: CHECKLIST_FINANCIAMENTO_PADRAO.map((c) => ({ financiamentoId: fin.id, ...c })) });
  return fin;
}

export async function garantirChecklistDosFinanciamentos(leadId: string, tx?: TransacaoCRM): Promise<number> {
  if (!tx) return transacaoCRM(async (t) => { await bloquearLead(t, leadId); return garantirChecklistDosFinanciamentos(leadId, t); });
  const semChecklist = await tx.financiamento.findMany({ where: { leadId, checklist: { none: {} } }, select: { id: true } });
  for (const fin of semChecklist) await tx.checklistItem.createMany({ data: CHECKLIST_FINANCIAMENTO_PADRAO.map((c) => ({ financiamentoId: fin.id, ...c })) });
  return semChecklist.length;
}

type ClienteLead = { id: string; nome: string; telefone: string; email: string | null; cpf?: string | null; responsavelId?: string | null };
async function criarRegistro(tx: TransacaoCRM, lead: ClienteLead, op: ServicoOperacional, servicoLeadId: string) {
  const cliente = dadosClienteDoLead(lead);
  const vinculo = { leadId: lead.id, servicoLeadId };
  switch (op.modulo) {
    case "financiamento":
      return criarFinanciamentoComChecklist({ ...cliente, clienteCpf: lead.cpf ?? null, ...vinculo, tipo: op.tipoFinanciamento!, status: "aguardando_configuracao" }, tx);
    case "obra":
      return tx.obra.create({ data: { ...vinculo, nome: `Obra — ${cliente.clienteNome}`, clienteNome: cliente.clienteNome, clienteTel: cliente.clienteTel, status: "aguardando_configuracao" } });
    case "projeto":
      return tx.projeto.create({ data: { ...vinculo, nome: `Projeto — ${cliente.clienteNome}`, clienteNome: cliente.clienteNome, clienteTel: cliente.clienteTel, status: "aguardando_configuracao" } });
    case "regularizacao":
      return tx.regularizacao.create({ data: { ...vinculo, nome: `Regularização — ${cliente.clienteNome}`, clienteNome: cliente.clienteNome, clienteTel: cliente.clienteTel, status: "aguardando_configuracao" } });
    case "avaliacao":
      // Identificador longo evita colisões e não exige recuperar uma transação abortada.
      return tx.avaliacao.create({ data: { ...cliente, ...vinculo, numero: `AVL-${randomUUID()}`, tipo: "mercado", finalidade: "compra_venda", endereco: "A definir", bairro: "A definir", avaliador: "A definir" } });
    case "tarefa":
      return tx.tarefaCrm.create({ data: { ...vinculo, titulo: `Atender ${lead.nome}`,
        responsavelId: lead.responsavelId ?? null } });
  }
}

/** Reconcilia exclusivamente chaves estrangeiras já existentes; nunca nomes. */
async function reconciliarLegados(tx: TransacaoCRM, leadId: string) {
  const grupos = await Promise.all([
    tx.financiamento.findMany({ where: { leadId, servicoLeadId: null }, select: { id: true, tipo: true } }),
    tx.obra.findMany({ where: { leadId, servicoLeadId: null }, select: { id: true } }),
    tx.projeto.findMany({ where: { leadId, servicoLeadId: null }, select: { id: true } }),
    tx.regularizacao.findMany({ where: { leadId, servicoLeadId: null }, select: { id: true } }),
    tx.avaliacao.findMany({ where: { leadId, servicoLeadId: null }, select: { id: true } }),
  ]);
  const modulos = ["financiamento", "obra", "projeto", "regularizacao", "avaliacao"] as const;
  for (let i = 0; i < grupos.length; i++) for (const registro of grupos[i]) {
    const modulo = modulos[i];
    const demanda = await tx.servicoLead.upsert({ where: { requestKey: `legado:${modulo}:${registro.id}` }, create: { leadId, modulo, servico: servicoDoModulo(modulo, "tipo" in registro ? registro.tipo : null), requestKey: `legado:${modulo}:${registro.id}` }, update: {} });
    const data = { servicoLeadId: demanda.id };
    switch (modulo) {
      case "financiamento": await tx.financiamento.update({ where: { id: registro.id }, data }); break;
      case "obra": await tx.obra.update({ where: { id: registro.id }, data }); break;
      case "projeto": await tx.projeto.update({ where: { id: registro.id }, data }); break;
      case "regularizacao": await tx.regularizacao.update({ where: { id: registro.id }, data }); break;
      case "avaliacao": await tx.avaliacao.update({ where: { id: registro.id }, data }); break;
    }
  }
}

const demandaInclude = { financiamento: true, obra: true, projeto: true, regularizacao: true, avaliacao: true, tarefa: true } as const;
export interface ResultadoSincronizacao { criados: number; falhas: ModuloServico[] }

/** Lead e operações são gravados no mesmo commit. Falha em qualquer write aborta tudo. */
export async function sincronizarServicosDoLead(leadId: string, tx?: TransacaoCRM): Promise<ResultadoSincronizacao> {
  if (!tx) return transacaoCRM((t) => sincronizarServicosDoLead(leadId, t));
  await bloquearLead(tx, leadId);
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
  await reconciliarLegados(tx, leadId);
  let criados = 0;
  for (const servico of new Set(parseServicosLead(lead.servico))) {
    const op = moduloDoServico(servico);
    if (!op) continue;
    // Um serviço selecionado reutiliza a demanda existente; novas operações são explícitas.
    let demanda = await tx.servicoLead.findFirst({ where: { leadId, servico }, include: demandaInclude, orderBy: { criadoEm: "asc" } });
    if (!demanda) demanda = await tx.servicoLead.create({ data: { leadId, modulo: op.modulo, servico, requestKey: `selecao:${leadId}:${servico}` }, include: demandaInclude });
    if (!demanda[op.modulo]) {
      // Inclusive serviço antigo ainda sem registro: o colaborador precisa do módulo.
      await exigirModuloDoServico(op.modulo, servico);
      await criarRegistro(tx, lead, op, demanda.id);
      criados++;
    }
  }
  await garantirChecklistDosFinanciamentos(leadId, tx);
  return { criados, falhas: [] };
}

/** requestKey identifica uma intenção de adicionar operação, inclusive reenvios. */
export async function adicionarOperacaoDoLead(tx: TransacaoCRM, leadId: string, servico: string, requestKey: string) {
  const op = moduloDoServico(servico);
  if (!op || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) throw new Error("Operação inválida.");
  await bloquearLead(tx, leadId);
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!parseServicosLead(lead.servico).includes(servico)) throw new Error("Selecione este serviço no CRM antes de adicionar uma operação.");
  const demanda = await tx.servicoLead.upsert({ where: { requestKey: `operacao:${leadId}:${requestKey}` }, create: { leadId, servico, modulo: op.modulo, requestKey: `operacao:${leadId}:${requestKey}` }, update: {}, include: demandaInclude });
  if (demanda.leadId !== leadId || demanda.servico !== servico || demanda.modulo !== op.modulo) throw new Error("A operação pertence a outro serviço.");
  return demanda[op.modulo] ?? criarRegistro(tx, lead, op, demanda.id);
}

export async function propagarDadosClienteDoLead(lead: ClienteLead, tx?: TransacaoCRM): Promise<void> {
  if (!tx) return transacaoCRM(async (t) => { await bloquearLead(t, lead.id); return propagarDadosClienteDoLead(lead, t); });
  const c = dadosClienteDoLead(lead);
  const base = { clienteNome: c.clienteNome, clienteTel: c.clienteTel };
  await tx.financiamento.updateMany({ where: { leadId: lead.id }, data: { ...base, clienteEmail: c.clienteEmail, clienteCpf: lead.cpf ?? null } });
  await tx.avaliacao.updateMany({ where: { leadId: lead.id }, data: { ...base, clienteEmail: c.clienteEmail } });
  await tx.obra.updateMany({ where: { leadId: lead.id }, data: base });
  await tx.projeto.updateMany({ where: { leadId: lead.id }, data: base });
  await tx.regularizacao.updateMany({ where: { leadId: lead.id }, data: base });
}

/** Usuários reais (ativos, internos) que podem ser responsáveis por um lead. */
export async function listarResponsaveis() {
  return prisma.usuario.findMany({
    where: { ativo: true, papel: { in: [...PAPEIS_RESPONSAVEL] } },
    select: { id: true, nome: true, papel: true },
    orderBy: { nome: "asc" },
  });
}

/**
 * Valida o responsável vindo do formulário (nunca confiar no client): só
 * aceita usuário existente, ativo e com papel interno. Inválido → null.
 */
export async function resolverResponsavelId(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { papel: true, ativo: true } });
  return podeSerResponsavel(usuario) ? id : null;
}

/**
 * Dados do cliente para gravar num registro operacional na edição: se o
 * registro está vinculado a um lead, vêm SEMPRE do lead (fonte única); só
 * registros legados sem vínculo usam o que foi digitado no formulário.
 */
export async function clienteParaRegistro(leadId: string | null | undefined, formData: FormData, tx?: TransacaoCRM) {
  if (leadId) {
    const lead = await (tx ?? prisma).lead.findUnique({
      where: { id: leadId },
      select: { nome: true, telefone: true, email: true },
    });
    if (!lead) throw new Error("Lead vinculado não encontrado.");
    return dadosClienteDoLead(lead);
  }
  return {
    clienteNome: (formData.get("clienteNome") as string) ?? "",
    clienteTel: (formData.get("clienteTel") as string) ?? "",
    clienteEmail: (formData.get("clienteEmail") as string) || null,
  };
}


export async function carregarLeadParaVinculo(leadId: string | null | undefined) {
  if (!leadId) throw new Error("Selecione um lead do CRM.");
  return prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { id: true, nome: true, telefone: true, email: true, cpf: true } });
}

/** Compatibilidade apenas com avaliação, que já possuía uma entrada própria. */
export async function registrarServicoNoLead(leadId: string, modulo: ModuloServico) {
  if (modulo !== "avaliacao") throw new Error("Crie as operações pelo CRM.");
  await transacaoCRM(async (tx) => {
    await bloquearLead(tx, leadId);
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const servicos = parseServicosLead(lead.servico);
    const servico = servicoDoModulo(modulo);
    if (!servicos.includes(servico)) await tx.lead.update({ where: { id: leadId }, data: { servico: JSON.stringify([...servicos, servico]) } });
    await sincronizarServicosDoLead(leadId, tx);
  });
}
