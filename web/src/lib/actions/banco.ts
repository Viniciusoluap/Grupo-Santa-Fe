"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { criptografarSegredo } from "@/lib/segredo";
import { authenticatePluggy, createPluggyConnectToken, fetchPluggyItemAccounts, fetchPluggyItemConnector } from "@/lib/bancos/pluggy";
import { fetchAsaasSaldo } from "@/lib/bancos/asaas-extrato";
import {
  confirmarImportacao,
  dataDaConta,
  previaImportacao,
  registrarWebhookPluggy,
  salvarTokenWebhookAsaas,
  sincronizarConta,
  statusPluggy,
  tokenPluggy,
} from "@/lib/bancos";
import type { LinhaExtrato } from "@/lib/extrato-import";

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

export async function salvarCredenciaisPluggy(input: { clientId: string; clientSecret: string }) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo", { somenteEquipe: true });
    const clientId = texto(input?.clientId), clientSecret = texto(input?.clientSecret);
    if (!clientId || !clientSecret) throw new Error("Informe o Client ID e o Client Secret.");
    const token = await authenticatePluggy(clientId, clientSecret);
    if (!token) throw new Error("Credenciais Pluggy inválidas ou API indisponível");
    const dados = { clientIdEncrypted: criptografarSegredo(clientId), clientSecretEncrypted: criptografarSegredo(clientSecret), isActive: true };
    await prisma.configuracaoPluggy.upsert({ where: { id: 1 }, create: { id: 1, ...dados }, update: dados });
    return { success: true };
  });
}

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

// ── Webhook do Asaas (avisos em tempo real) ─────────────────────────────────

export async function salvarTokenWebhookAsaasAcao(token: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo", { somenteEquipe: true });
    const t = texto(token);
    if (t.length < 8 || t.length > 255) throw new Error("Token do webhook do Asaas inválido (mínimo de 8 caracteres).");
    await salvarTokenWebhookAsaas(t);
    return { success: true };
  });
}

// ── Contas ──────────────────────────────────────────────────────────────────

export async function criarContaBancaria(input: {
  banco: string;
  agencia?: string;
  conta?: string;
  tipo?: string;
  descricao?: string;
  saldoAtual?: number;
  provedor?: "manual" | "asaas";
  apiKey?: string;
  dataInicial?: string | null;
}) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const banco = texto(input?.banco);
    if (!banco) throw new Error("Informe o banco.");
    const provedor = input?.provedor === "asaas" ? "asaas" : "manual";
    const apiKey = texto(input?.apiKey);
    const dataInicial = dataIsoOpcional(input?.dataInicial);
    let saldo = Number.isFinite(input?.saldoAtual) ? Number(input.saldoAtual) : 0;
    if (provedor === "asaas") {
      if (!apiKey) throw new Error("Informe a chave de API do Asaas.");
      saldo = await fetchAsaasSaldo(apiKey);
    }
    const conta = await prisma.contaBancaria.create({
      data: {
        banco,
        agencia: texto(input?.agencia) || null,
        conta: texto(input?.conta) || (provedor === "asaas" ? "Asaas" : "—"),
        tipo: TIPOS_CONTA.includes(input?.tipo ?? "") ? input.tipo! : "corrente",
        descricao: texto(input?.descricao) || null,
        saldoAtual: saldo,
        provedor,
        credencialEncrypted: apiKey ? criptografarSegredo(apiKey) : null,
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

/** Remove a conta da lista (igual à Prospecta): as movimentações já gravadas continuam no histórico. */
export async function excluirContaBancaria(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo", { somenteEquipe: true });
    await prisma.contaBancaria.update({ where: { id }, data: { ativo: false } });
    revalidatePath(BPO);
    return { success: true };
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
      select: { id: true, data: true, descricao: true, valor: true, tipo: true, categoria: true, status: true, origem: true },
    });
    return t.map((x) => ({ ...x, data: x.data.toISOString() }));
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
  revalidatePath(BPO);
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

export async function confirmarImportacaoExtrato(contaId: string, linhas: LinhaExtrato[]) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    if (!Array.isArray(linhas) || linhas.length < 1 || linhas.length > 20000) throw new Error("Nenhum lançamento para importar.");
    const validas = linhas.map((l) => {
      if (!l || typeof l.data !== "string" || !DATA_ISO.test(l.data) || typeof l.descricao !== "string" || l.descricao.length > 500
        || typeof l.valor !== "number" || !(l.valor > 0) || (l.tipo !== "credito" && l.tipo !== "debito")) {
        throw new Error("Lançamento inválido na importação.");
      }
      return { data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo };
    });
    const r = await confirmarImportacao(String(contaId), validas);
    revalidatePath(BPO);
    return r;
  });
}
