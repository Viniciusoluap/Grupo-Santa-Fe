"use server";
import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida } from "@/lib/bpo-lote";
import { exigirModuloAcao, exigirAdminAtivo } from "@/lib/auth/modulos";
import { preservarLancamentoNaLimpeza } from "@/lib/bpo-limpeza";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { capturarErroAcao, exigirResultado } from "@/lib/acao-resultado";
import { criptografarSegredo } from "@/lib/segredo";
import { createPluggyConnectToken, fetchPluggyItemAccounts, fetchPluggyItemConnector } from "@/lib/bancos/pluggy";
import { fetchAsaasSaldo } from "@/lib/bancos/asaas-extrato";
import { criarFetchMtls, fetchInterSaldo, interHabilitado, tokenInter, validarCredencialInter, type CredencialInter } from "@/lib/bancos/inter";
import { chaveAsaasCentral } from "@/lib/bancos/asaas-central";
import {
  confirmarImportacao,
  dataDaConta,
  previaImportacao,
  registrarWebhookPluggy,
  sincronizarConta,
  statusPluggy,
  tokenPluggy,
} from "@/lib/bancos";
import { classificarTransacao, reprocessarMovimentacoes, vincularTransacoesAoBpo } from "@/lib/bancos/lancamentos-bpo";
import type { LinhaExtrato, SaldoExtrato } from "@/lib/extrato-import";

// Pedido de 25/10: BPO › Bancos — contas por API (Asaas, Pluggy/Meu Pluggy) e por importação de
// extrato. Mesmas operações dos routers `bancario` e `pluggySettings` da Prospecta
// (server/bancos-router.ts). A chave da API nunca volta para a tela.

const BPO = "/admin/bpo";
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_CONTA = ["corrente", "poupanca", "pagamento", "investimento"];

function dataIsoOpcional(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !DATA_ISO.test(v)) throw new Error("Data inválida.");
  return v;
}
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ── Pluggy ──────────────────────────────────────────────────────────────────

export async function statusPluggyAcao() {
  return capturarErroAcao(async () => { await exigirModuloAcao("bpo"); return statusPluggy(); });
}

// LOTE B (25/10): Client ID/Secret da Pluggy são salvos só em Configurações › Integrações
// (lib/actions/integracoes.ts → salvarPluggyIntegracao).

export async function testarPluggy() {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    try {
      await tokenPluggy();
      // Avisos em tempo real: garante o webhook da Pluggy apontando para o sistema (erro vira aviso).
      const aviso = await registrarWebhookPluggy().then(() => " Avisos em tempo real ativos.")
        .catch((e) => ` (Avisos em tempo real: ${e instanceof Error ? e.message : "falhou"})`);
      return { ok: true, mensagem: `Pluggy conectada.${aviso}` };
    }
    catch (e) { return { ok: false, mensagem: e instanceof Error ? e.message : "Falha na Pluggy." }; }
  });
}

/** Token para abrir o Pluggy Connect na tela (escolher "Meu Pluggy" e autorizar). */
export async function tokenConexaoPluggy() {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    return { accessToken: await createPluggyConnectToken(await tokenPluggy()) };
  });
}

/** Cadastra sozinho as contas de uma conexão (item) da Pluggy. */
export async function importarItemPluggy(input: { itemId: string; dataInicial?: string | null }) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const itemId = texto(input?.itemId);
    if (itemId.length < 8) throw new Error("Informe o ID da conexão (itemId).");
    const dataInicial = dataIsoOpcional(input?.dataInicial);
    const token = await tokenPluggy();
    const [contas, banco] = await Promise.all([fetchPluggyItemAccounts(token, itemId), fetchPluggyItemConnector(token, itemId)]);
    const existentes = await prisma.contaBancaria.findMany({ where: { ativo: true }, select: { pluggyAccountId: true } });
    let criadas = 0;
    for (const c of contas) {
      if (existentes.some((e) => e.pluggyAccountId === c.id)) continue;
      await prisma.contaBancaria.create({
        data: {
          banco: banco ?? "Pluggy",
          conta: c.numero ?? c.nome,
          descricao: c.nome,
          tipo: "corrente",
          provedor: "pluggy",
          pluggyItemId: itemId,
          pluggyAccountId: c.id,
          saldoAtual: c.saldo ?? 0,
          dataInicial: dataDaConta(dataInicial),
        },
      });
      criadas++;
    }
    await registrarWebhookPluggy().catch(() => undefined);
    revalidatePath(BPO);
    return { encontradas: contas.length, criadas };
  });
}

// LOTE B (25/10): o token do webhook do Asaas é salvo só em Configurações › Integrações.

// ── Contas ──────────────────────────────────────────────────────────────────

export async function criarContaBancaria(input: {
  banco: string;
  agencia?: string;
  conta?: string;
  tipo?: string;
  descricao?: string;
  saldoAtual?: number;
  provedor?: "manual" | "asaas" | "inter";
  apiKey?: string;
  dataInicial?: string | null;
  /** Lote 4 (beta, desligado por padrão): credencial da integração do Banco Inter PJ. */
  inter?: Partial<CredencialInter>;
}) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const banco = texto(input?.banco);
    if (!banco) throw new Error("Informe o banco.");
    const provedor = input?.provedor === "asaas" ? "asaas" : input?.provedor === "inter" ? "inter" : "manual";
    const apiKey = texto(input?.apiKey);
    const dataInicial = dataIsoOpcional(input?.dataInicial);
    let saldo = Number.isFinite(input?.saldoAtual) ? Number(input.saldoAtual) : 0;
    if (provedor === "asaas") {
      // LOTE B (25/10): sem chave própria, valida e usa a chave central (Integrações).
      let chave = apiKey;
      if (!chave) {
        const central = await chaveAsaasCentral().catch(() => null);
        if (!central) throw new Error("Cadastre a chave do Asaas em Configurações › Integrações.");
        chave = central.apiKey;
      }
      saldo = await fetchAsaasSaldo(chave);
    }
    let credencialInter: string | null = null;
    if (provedor === "inter") {
      // Lote 4: valida a credencial no próprio Inter (token + saldo) antes de salvar, criptografada.
      if (!interHabilitado()) throw new Error("O conector do Banco Inter está desligado (beta).");
      await exigirModuloAcao("bpo", { somenteEquipe: true });
      const cred = validarCredencialInter(input?.inter ?? {});
      const f = criarFetchMtls(cred);
      saldo = (await fetchInterSaldo(await tokenInter(cred, f), cred, f)) ?? 0;
      credencialInter = JSON.stringify(cred);
    }
    const conta = await prisma.contaBancaria.create({
      data: {
        banco,
        agencia: texto(input?.agencia) || null,
        conta: texto(input?.conta) || (provedor === "asaas" ? "Asaas" : provedor === "inter" ? "Inter" : "—"),
        tipo: TIPOS_CONTA.includes(input?.tipo ?? "") ? input.tipo! : "corrente",
        descricao: texto(input?.descricao) || null,
        saldoAtual: saldo,
        provedor,
        credencialEncrypted: credencialInter ? criptografarSegredo(credencialInter) : apiKey ? criptografarSegredo(apiKey) : null,
        dataInicial: dataDaConta(dataInicial),
      },
      select: { id: true },
    });
    revalidatePath(BPO);
    return { id: conta.id };
  });
}

/** Data inicial, descrição e (só Asaas) nova chave de API. A chave nunca volta para a tela. */
export async function atualizarContaBancaria(input: { id: string; dataInicial?: string | null; descricao?: string; apiKey?: string }) {
  return capturarErroAcao(async () => {
    const apiKey = texto(input?.apiKey);
    await exigirModuloAcao("bpo", apiKey ? { somenteEquipe: true } : {});
    const atual = await prisma.contaBancaria.findUnique({ where: { id: String(input?.id ?? "") }, select: { id: true } });
    if (!atual) throw new Error("Conta não encontrada");
    if (apiKey) await fetchAsaasSaldo(apiKey);
    await prisma.contaBancaria.update({
      where: { id: atual.id },
      data: {
        ...(input.dataInicial !== undefined ? { dataInicial: dataDaConta(dataIsoOpcional(input.dataInicial)) } : {}),
        ...(input.descricao !== undefined ? { descricao: texto(input.descricao) || null } : {}),
        ...(apiKey ? { credencialEncrypted: criptografarSegredo(apiKey) } : {}),
      },
    });
    revalidatePath(BPO);
    return { success: true };
  });
}

export type PreviaLimpezaBpo = { contaId: string; rotulo: string; transacoes: number; lancamentosRemovidos: number; lancamentosPreservados: number; vinculosOperacionais: number };

/** Prévia exata para limpeza; lançamentos ligados ao Asaas ou a movimentos operacionais são preservados. */
export async function previaLimpezaContaBancaria(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo", { somenteEquipe: true });
    const conta = await prisma.contaBancaria.findUnique({ where: { id }, select: { id: true, banco: true, descricao: true, conta: true } });
    if (!conta) throw new Error("Conta não encontrada.");
    const transacoes = await prisma.transacaoBancaria.findMany({ where: { contaId: id }, include: { lancamento: { include: { movimentosObra: { select: { id: true } }, recebimentosRegularizacao: { select: { id: true } } } } } });
    const lancamentos = transacoes.flatMap((t) => t.lancamento ? [t.lancamento] : []);
    const preservar = preservarLancamentoNaLimpeza;
    const rotulo = [conta.descricao || conta.banco, conta.conta].filter(Boolean).join(" · ");
    return { contaId: conta.id, rotulo, transacoes: transacoes.length,
      lancamentosRemovidos: lancamentos.filter((l) => !preservar(l)).length,
      lancamentosPreservados: lancamentos.filter(preservar).length,
      vinculosOperacionais: lancamentos.filter((l) => l.movimentosObra.length || l.recebimentosRegularizacao.length).length };
  });
}

/** Backup e limpeza atômicos. A conta fica inativa; credenciais nunca entram no snapshot. */
export async function excluirContaBancaria(id: string, confirmacao?: string) {
  return capturarErroAcao(async () => {
    const administrador = await exigirAdminAtivo();
    await exigirModuloAcao("bpo", { somenteEquipe: true });
    // Lote 3, item 13B: confirmação digitando EXCLUIR (case-sensitive, sem acento).
    if (!confirmacaoExclusaoValida(confirmacao)) throw new Error(`Digite ${CONFIRMACAO_EXCLUSAO} para confirmar a exclusão da conta.`);
    const p = exigirResultado(await previaLimpezaContaBancaria(id));
    const res = await prisma.$transaction(async (tx) => {
      const conta = await tx.contaBancaria.findUnique({ where: { id }, select: { id: true, banco: true, agencia: true, conta: true, tipo: true, descricao: true, saldoAtual: true, ativo: true, pluggyItemId: true, pluggyAccountId: true, webhookUrl: true, ultimaSincronizacao: true, provedor: true, dataInicial: true, ultimoErro: true, saldoExtrato: true, saldoExtratoData: true, criadoEm: true } });
      if (!conta) throw new Error("Conta removida ou alterada. Atualize a prévia.");
      const transacoes = await tx.transacaoBancaria.findMany({ where: { contaId: id }, include: { lancamento: { include: { movimentosObra: { select: { id: true } }, recebimentosRegularizacao: { select: { id: true } } } } } });
      const lancamentos = transacoes.flatMap((t) => t.lancamento ? [t.lancamento] : []);
      const preservar = preservarLancamentoNaLimpeza;
      const manter = lancamentos.filter(preservar), remover = lancamentos.filter((l) => !preservar(l));
      if (transacoes.length !== p.transacoes || manter.length !== p.lancamentosPreservados || remover.length !== p.lancamentosRemovidos) throw new Error("A conta recebeu alterações depois da prévia. Atualize a prévia e confirme novamente.");
      const backup = await tx.bpoContaLimpezaBackup.create({ data: { contaReferencia: conta.id, contaRotulo: p.rotulo,
        criadoPorUsuarioId: administrador.id,
        snapshotJson: JSON.stringify({ conta, transacoes, lancamentos }), transacoes: transacoes.length,
        lancamentosRemovidos: remover.length, lancamentosPreservados: manter.length } });
      if (manter.length) await tx.bpoLancamento.updateMany({ where: { id: { in: manter.map((l) => l.id) } }, data: { transacaoId: null, atualizadoEm: new Date(), version: { increment: 1 } } });
      if (remover.length) await tx.bpoLancamento.deleteMany({ where: { id: { in: remover.map((l) => l.id) } } });
      await tx.transacaoBancaria.deleteMany({ where: { contaId: id } });
      await tx.contaBancaria.update({ where: { id }, data: { ativo: false, ultimaSincronizacao: null, saldoAtual: 0, saldoExtrato: null, saldoExtratoData: null } });
      return { backupId: backup.id, excluidaEm: backup.criadoEm.toISOString(), excluidaPor: administrador.nome, transacoes: transacoes.length, lancamentosRemovidos: remover.length, lancamentosPreservados: manter.length };
    });
    revalidatePath(BPO);
    return { success: true, ...res };
  });
}

export async function atualizarSaldoConta(id: string, saldo: number) {
  await exigirModuloAcao("bpo");
  await prisma.contaBancaria.update({
    where: { id },
    data: { saldoAtual: saldo, ultimaSincronizacao: new Date() },
  });
  revalidatePath(BPO);
}

export async function sincronizarContaBancaria(contaId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await sincronizarConta(String(contaId));
    revalidatePath(BPO);
    return r;
  });
}

// ── Transações ──────────────────────────────────────────────────────────────

export async function listarTransacoesConta(contaId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const t = await prisma.transacaoBancaria.findMany({
      where: { contaId: String(contaId) },
      orderBy: { data: "desc" },
      take: 300,
      select: {
        id: true, data: true, descricao: true, descricaoOriginal: true, titular: true, valor: true, tipo: true, categoria: true, status: true, origem: true, bpoClienteId: true,
        lancamento: { select: { clienteId: true } },
      },
    });
    return t.map(({ lancamento, ...x }) => ({ ...x, data: x.data.toISOString(), clienteId: x.bpoClienteId ?? lancamento?.clienteId ?? null }));
  });
}

export async function atualizarStatusTransacao(id: string, status: string) {
  await exigirModuloAcao("bpo");
  if (!["pendente", "conciliado", "ignorado"].includes(status)) throw new Error("Status inválido.");
  await prisma.transacaoBancaria.update({ where: { id }, data: { status } });
  revalidatePath(BPO);
}

export async function salvarTransacoes(
  contaId: string,
  transacoes: {
    data: string;
    descricao: string;
    valor: number;
    tipo: string;
    categoria?: string;
    externalId?: string;
  }[]
) {
  await exigirModuloAcao("bpo");
  for (const t of transacoes) {
    await prisma.transacaoBancaria.upsert({
      where: { externalId: t.externalId ?? `manual-${contaId}-${Date.now()}-${Math.random()}` },
      create: {
        contaId,
        data: new Date(t.data),
        descricao: t.descricao,
        valor: t.valor,
        tipo: t.tipo,
        categoria: t.categoria,
        externalId: t.externalId,
      },
      update: {},
    });
  }
  await prisma.contaBancaria.update({
    where: { id: contaId },
    data: { ultimaSincronizacao: new Date() },
  });
  // LOTE C: toda movimentação gera o lançamento pago no BPO.
  await vincularTransacoesAoBpo({ contaId });
  revalidatePath(BPO);
}

/** LOTE C: categoria e cliente BPO de uma movimentação (atualiza o lançamento vinculado). */
export async function classificarTransacaoAcao(id: string, input: { categoria?: string; clienteId?: string | null }) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await classificarTransacao(String(id), {
      ...(input?.categoria !== undefined ? { categoria: String(input.categoria) } : {}),
      ...(input?.clienteId !== undefined ? { clienteId: input.clienteId ? String(input.clienteId) : null } : {}),
    });
    revalidatePath(BPO);
    return r;
  });
}

/** LOTE C: botão "Reprocessar movimentações" — gera os lançamentos que faltam (sem duplicar). */
export async function reprocessarMovimentacoesAcao() {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await reprocessarMovimentacoes();
    revalidatePath(BPO);
    return r;
  });
}

// ── Importação de extrato ───────────────────────────────────────────────────

const LIMITE_ARQUIVO = 10 * 1024 * 1024;

/** Recebe o arquivo (FormData: contaId, arquivo, anoPadrao?) e devolve a prévia, sem gravar. */
export async function previaImportacaoExtrato(formData: FormData) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const contaId = texto(formData.get("contaId"));
    const arquivo = formData.get("arquivo");
    if (!contaId) throw new Error("Conta não informada.");
    if (!(arquivo instanceof File) || !arquivo.size) throw new Error("Escolha o arquivo do extrato.");
    if (arquivo.size > LIMITE_ARQUIVO) throw new Error("Arquivo acima de 10 MB.");
    const anoTxt = texto(formData.get("anoPadrao"));
    const ano = anoTxt ? Number(anoTxt) : undefined;
    if (ano !== undefined && (!Number.isInteger(ano) || ano < 1990 || ano > 2100)) throw new Error("Ano inválido.");
    const nome = arquivo.name.slice(0, 255) || "extrato";
    return previaImportacao(contaId, nome, Buffer.from(await arquivo.arrayBuffer()), ano);
  });
}

export async function confirmarImportacaoExtrato(contaId: string, linhas: LinhaExtrato[], saldo?: SaldoExtrato | null) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    if (!Array.isArray(linhas) || linhas.length < 1 || linhas.length > 20000) throw new Error("Nenhum lançamento para importar.");
    const validas = linhas.map((l) => {
      if (!l || typeof l.data !== "string" || !DATA_ISO.test(l.data) || typeof l.descricao !== "string" || l.descricao.length > 500
        || typeof l.valor !== "number" || !(l.valor > 0) || (l.tipo !== "credito" && l.tipo !== "debito")) {
        throw new Error("Lançamento inválido na importação.");
      }
      return { data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, titular: l.titular, detalhe: l.detalhe, original: l.original };
    });
    const saldoValido = saldo && typeof saldo.valor === "number" && Number.isFinite(saldo.valor)
      && (saldo.data === null || (typeof saldo.data === "string" && DATA_ISO.test(saldo.data)))
      ? { valor: saldo.valor, data: saldo.data } : null;
    const r = await confirmarImportacao(String(contaId), validas, saldoValido);
    revalidatePath(BPO);
    return r;
  });
}
