"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { auth } from "@/auth";
import { exigirConfiguracaoParaStatus } from "@/lib/crm/configuracao-servico";
import { REG_STATUS_CONFIG } from "@/lib/types/regularizacao";
import { prisma } from "@/lib/db";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { centavosDe } from "@/lib/financeiro/obra";
import {
  ehGrupoFinanceiro,
  ehStatusProcesso,
  LIMITE_NOME_ITEM,
  mensagemErroRegularizacao,
  planejarValoresPadrao,
  reordenarEtapas,
  validarEtapa,
} from "@/lib/financeiro/regularizacao";
import { revalidatePath } from "next/cache";

// EPIC-020 Lote 6 — Regularização, com as mesmas regras da API `regularizacao`
// da Prospecta: Status do Processo (30) independente das Etapas; tabela
// financeira (31) com recebimentos manuais ou do BPO. "Valor Pago" e os
// "Documentos" antigos saíram da tela; os dados continuam no banco.

const DINHEIRO = /^\d{1,13}(\.\d{1,2})?$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function exigirAdmin() {
  const session = await auth();
  await exigirModuloAcao("regularizacao");
  return (session!.user as { id?: string }).id ?? null;
}

function revalidar(regularizacaoId: string) {
  revalidatePath("/admin/regularizacao");
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

/** Converte as garantias do banco em mensagens; demais erros seguem adiante. */
function traduzir(err: unknown): never {
  const mensagem = mensagemErroRegularizacao(err);
  if (mensagem) throw new Error(mensagem);
  throw err;
}

export async function alterarStatusRegularizacao(id: string, status: string) {
  await exigirAdmin();
  if (!ehStatusProcesso(status)) throw new Error("Status inválido.");
  const registro = await prisma.regularizacao.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ['tipo', 'endereco', 'responsavel', 'valorServico'], REG_STATUS_CONFIG);
  await prisma.regularizacao.update({ where: { id }, data: { status } });
  revalidar(id);
}

// ── Etapas do Processo (30) ───────────────────────────────────────────

export interface EtapaInput { nome: string; progresso: number; observacoes?: string | null }

function etapaValida(dados: EtapaInput) {
  const erros = validarEtapa(dados);
  if (erros.length) throw new Error(erros.join(" "));
  return { nome: dados.nome.trim(), progresso: dados.progresso, observacoes: dados.observacoes?.trim() || null };
}

async function criarEtapaImpl(regularizacaoId: string, dados: EtapaInput) {
  await exigirAdmin();
  const valida = etapaValida(dados);
  await prisma.$transaction(async (tx) => {
    const reg = await tx.regularizacao.findUnique({ where: { id: regularizacaoId }, select: { id: true } });
    if (!reg) throw new Error("Regularização não encontrada.");
    const ultima = await tx.regularizacaoEtapa.aggregate({ where: { regularizacaoId }, _max: { ordem: true } });
    await tx.regularizacaoEtapa.create({ data: { regularizacaoId, ...valida, ordem: (ultima._max.ordem ?? 0) + 1 } });
  });
  revalidar(regularizacaoId);
  return { ok: true as const };
}

async function editarEtapaImpl(id: string, dados: EtapaInput) {
  await exigirAdmin();
  const valida = etapaValida(dados);
  const r = await prisma.regularizacaoEtapa.updateMany({ where: { id }, data: valida });
  if (r.count === 0) throw new Error("Etapa não encontrada.");
  const etapa = await prisma.regularizacaoEtapa.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (etapa) revalidar(etapa.regularizacaoId);
  return { ok: true as const };
}

async function excluirEtapaImpl(id: string) {
  await exigirAdmin();
  const etapa = await prisma.regularizacaoEtapa.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (!etapa) throw new Error("Etapa não encontrada.");
  await prisma.regularizacaoEtapa.delete({ where: { id } });
  revalidar(etapa.regularizacaoId);
  return { ok: true as const };
}

async function moverEtapaImpl(id: string, direcao: -1 | 1) {
  await exigirAdmin();
  if (direcao !== -1 && direcao !== 1) throw new Error("Direção inválida.");
  const etapa = await prisma.regularizacaoEtapa.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (!etapa) throw new Error("Etapa não encontrada.");
  await prisma.$transaction(async (tx) => {
    const atuais = await tx.regularizacaoEtapa.findMany({
      where: { regularizacaoId: etapa.regularizacaoId },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const nova = reordenarEtapas(atuais, id, direcao);
    for (const [i, e] of nova.entries()) await tx.regularizacaoEtapa.update({ where: { id: e.id }, data: { ordem: i + 1 } });
  });
  revalidar(etapa.regularizacaoId);
  return { ok: true as const };
}

export async function criarEtapaRegularizacao(regularizacaoId: string, dados: EtapaInput) { return capturarErroAcao(() => criarEtapaImpl(regularizacaoId, dados)); }
export async function editarEtapaRegularizacao(id: string, dados: EtapaInput) { return capturarErroAcao(() => editarEtapaImpl(id, dados)); }
export async function excluirEtapaRegularizacao(id: string) { return capturarErroAcao(() => excluirEtapaImpl(id)); }
export async function moverEtapaRegularizacao(id: string, direcao: -1 | 1) { return capturarErroAcao(() => moverEtapaImpl(id, direcao)); }

// ── Tabela financeira (31) ────────────────────────────────────────────

export interface ItemFinanceiroInput { nome: string; grupo: string; previsto: string }

function itemValido(dados: ItemFinanceiroInput) {
  const nome = dados.nome?.trim() ?? "";
  if (nome.length < 2) throw new Error("Informe o nome do item.");
  if (nome.length > LIMITE_NOME_ITEM) throw new Error(`O nome do item deve ter até ${LIMITE_NOME_ITEM} caracteres.`);
  if (!ehGrupoFinanceiro(dados.grupo)) throw new Error("Grupo inválido.");
  if (!DINHEIRO.test(dados.previsto ?? "")) throw new Error("Valor previsto inválido.");
  return { nome, grupo: dados.grupo, previsto: dados.previsto };
}

async function criarItemImpl(regularizacaoId: string, dados: ItemFinanceiroInput) {
  await exigirAdmin();
  const valido = itemValido(dados);
  await prisma.$transaction(async (tx) => {
    const reg = await tx.regularizacao.findUnique({ where: { id: regularizacaoId }, select: { id: true } });
    if (!reg) throw new Error("Regularização não encontrada.");
    const ultimo = await tx.regularizacaoItemFinanceiro.aggregate({ where: { regularizacaoId, ordem: { lt: 99 } }, _max: { ordem: true } });
    await tx.regularizacaoItemFinanceiro.create({ data: { regularizacaoId, ...valido, ordem: (ultimo._max.ordem ?? 0) + 1 } });
  });
  revalidar(regularizacaoId);
  return { ok: true as const };
}

async function editarItemImpl(id: string, dados: ItemFinanceiroInput) {
  await exigirAdmin();
  const valido = itemValido(dados);
  const item = await prisma.regularizacaoItemFinanceiro.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (!item) throw new Error("Item não encontrado.");
  await prisma.regularizacaoItemFinanceiro.update({ where: { id }, data: valido });
  revalidar(item.regularizacaoId);
  return { ok: true as const };
}

async function excluirItemImpl(id: string) {
  await exigirAdmin();
  const item = await prisma.regularizacaoItemFinanceiro.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (!item) throw new Error("Item não encontrado.");
  try {
    await prisma.regularizacaoItemFinanceiro.delete({ where: { id } });
  } catch (err) {
    traduzir(err);
  }
  revalidar(item.regularizacaoId);
  return { ok: true as const };
}

export async function criarItemFinanceiroRegularizacao(regularizacaoId: string, dados: ItemFinanceiroInput) { return capturarErroAcao(() => criarItemImpl(regularizacaoId, dados)); }
export async function editarItemFinanceiroRegularizacao(id: string, dados: ItemFinanceiroInput) { return capturarErroAcao(() => editarItemImpl(id, dados)); }
export async function excluirItemFinanceiroRegularizacao(id: string) { return capturarErroAcao(() => excluirItemImpl(id)); }

/** Aplica os previstos em uma transação, sem alterar recebimentos ou itens personalizados. */
export async function gerarValoresPadraoRegularizacao(regularizacaoId: string, confirmarSubstituicao = false) {
  return capturarErroAcao(async () => {
    await exigirAdmin();
    if (typeof regularizacaoId !== "string" || !regularizacaoId.trim()) throw new Error("Regularização inválida.");
    if (typeof confirmarSubstituicao !== "boolean") throw new Error("Confirmação inválida.");
    const resultado = await prisma.$transaction(async (tx) => {
      const registros = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM regularizacoes WHERE id = ${regularizacaoId} FOR UPDATE`;
      if (!registros.length) throw new Error("Regularização não encontrada.");
      const itens = await tx.regularizacaoItemFinanceiro.findMany({ where: { regularizacaoId } });
      const plano = planejarValoresPadrao(itens.map((item) => ({ ...item, previsto: item.previsto.toString() })));
      if (!confirmarSubstituicao && plano.some((item) => item.requerConfirmacao)) return { requerConfirmacao: true };
      for (const item of plano) {
        if (item.id) {
          await tx.regularizacaoItemFinanceiro.update({ where: { id: item.id }, data: { previsto: item.previsto, chavePadrao: item.chave } });
        } else {
          await tx.regularizacaoItemFinanceiro.create({ data: { regularizacaoId, chavePadrao: item.chave, nome: item.nome, grupo: item.grupo, ordem: item.ordem, previsto: item.previsto } });
        }
      }
      return { requerConfirmacao: false };
    });
    if (!resultado.requerConfirmacao) revalidar(regularizacaoId);
    return resultado;
  });
}

/** Receitas do BPO já recebidas e com saldo (descontado o que obras e regularizações já usaram). */
async function bpoDisponiveisImpl() {
  await exigirAdmin();
  const lancamentos = await prisma.bpoLancamento.findMany({
    where: { pago: true, tipo: { not: "despesa" } },
    orderBy: { vencimento: "asc" },
    select: {
      id: true,
      descricao: true,
      valor: true,
      movimentosObra: { where: { status: "confirmado" }, select: { valor: true } },
      recebimentosRegularizacao: { where: { status: "confirmado" }, select: { valor: true } },
    },
  });
  return lancamentos
    .map((l) => ({
      id: l.id,
      descricao: l.descricao,
      disponivelCentavos: centavosDe(l.valor)!
        - [...l.movimentosObra, ...l.recebimentosRegularizacao].reduce((acc, m) => acc + centavosDe(m.valor.toString())!, 0),
    }))
    .filter((l) => l.disponivelCentavos > 0);
}

export async function listarBpoDisponiveisRegularizacao() { return capturarErroAcao(() => bpoDisponiveisImpl()); }

export interface RecebimentoInput {
  regularizacaoId: string;
  itemId: string;
  valor: string;
  data: string;
  observacao?: string;
  bpoLancamentoId?: string;
}

async function adicionarRecebimentoImpl(input: RecebimentoInput) {
  const usuarioId = await exigirAdmin();
  if (!DINHEIRO.test(input.valor ?? "") || Number(input.valor) <= 0) throw new Error("O valor deve ser maior que zero.");
  if (!DATA.test(input.data ?? "")) throw new Error("Data inválida.");
  const item = await prisma.regularizacaoItemFinanceiro.findFirst({ where: { id: input.itemId, regularizacaoId: input.regularizacaoId }, select: { id: true } });
  if (!item) throw new Error("O item escolhido não pertence a este processo.");
  try {
    await prisma.regularizacaoRecebimento.create({
      data: {
        regularizacaoId: input.regularizacaoId,
        itemId: input.itemId,
        valor: input.valor,
        data: new Date(`${input.data}T00:00:00.000Z`),
        observacao: input.observacao?.trim().slice(0, 2000) || null,
        origem: input.bpoLancamentoId ? "bpo" : "manual",
        bpoLancamentoId: input.bpoLancamentoId || null,
        criadoPorId: usuarioId,
      },
    });
  } catch (err) {
    traduzir(err);
  }
  revalidar(input.regularizacaoId);
  return { ok: true as const };
}

/** Pedido A6: excluir apaga o recebimento de vez (e o histórico dele). */
async function excluirRecebimentoImpl(id: string) {
  await exigirAdmin();
  const atual = await prisma.regularizacaoRecebimento.findUnique({ where: { id }, select: { regularizacaoId: true } });
  if (!atual) throw new Error("Recebimento não encontrado (talvez já excluído).");
  await prisma.regularizacaoRecebimento.deleteMany({ where: { id } });
  revalidar(atual.regularizacaoId);
  return { ok: true as const };
}

export async function adicionarRecebimentoRegularizacao(input: RecebimentoInput) { return capturarErroAcao(() => adicionarRecebimentoImpl(input)); }
export async function excluirRecebimentoRegularizacao(id: string) { return capturarErroAcao(() => excluirRecebimentoImpl(id)); }

// Novas regularizações são materializadas exclusivamente pelas demandas do CRM.
