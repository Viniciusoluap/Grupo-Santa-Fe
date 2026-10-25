// Pedido de 25/10: contas bancárias do BPO por API (Asaas, Pluggy/Meu Pluggy) e por importação
// de extrato (planilha, OFX, PDF), com data inicial por conta. Gêmeo de Prospecta/server/bancos.ts
// (mesma regra de negócio; aqui com Prisma).
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo, segredoEmTextoPuro } from "@/lib/segredo";
import { authenticatePluggy, fetchPluggyAccountBalance, fetchPluggyTransactions } from "@/lib/bancos/pluggy";
import { fetchAsaasExtrato, fetchAsaasSaldo } from "@/lib/bancos/asaas-extrato";
import {
  aplicarDataInicial,
  chavesImportacao,
  lerCsv,
  lerOfx,
  lerTabela,
  lerTextoPdf,
  type LinhaExtrato,
  type ResultadoLeitura,
} from "@/lib/extrato-import";

export type Provedor = "manual" | "asaas" | "pluggy";
type Movimento = { externalId: string; data: string; descricao: string; valor: number; tipo: "credito" | "debito"; categoria?: string };
type ContaComData = { id: string; dataInicial: Date | null };

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Coluna DATE (Prisma devolve meia-noite UTC) ↔ "AAAA-MM-DD". */
export const dataIsoDaConta = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
export const dataDaConta = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Lê um segredo e, se ele foi gravado em texto puro (carga inicial), já o recriptografa. */
async function lerSegredo(valor: string, regravar: (cifrado: string) => Promise<unknown>) {
  const claro = descriptografarSegredo(valor);
  if (segredoEmTextoPuro(valor)) await regravar(criptografarSegredo(claro));
  return claro;
}

/**
 * Token da Pluggy com as credenciais salvas na tela. Se ainda não houver nada salvo, usa as
 * variáveis PLUGGY_CLIENT_ID/SECRET que o Santa Fé já aceitava (compatibilidade).
 */
export async function tokenPluggy(fetchImpl: typeof fetch = fetch): Promise<string> {
  const s = await prisma.configuracaoPluggy.findFirst();
  let clientId: string, clientSecret: string;
  if (s?.isActive) {
    clientId = await lerSegredo(s.clientIdEncrypted, (v) => prisma.configuracaoPluggy.update({ where: { id: s.id }, data: { clientIdEncrypted: v } }));
    clientSecret = await lerSegredo(s.clientSecretEncrypted, (v) => prisma.configuracaoPluggy.update({ where: { id: s.id }, data: { clientSecretEncrypted: v } }));
  } else if (!s && process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET) {
    clientId = process.env.PLUGGY_CLIENT_ID;
    clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  } else {
    throw new Error("Configure o Client ID e o Client Secret da Pluggy nesta aba.");
  }
  const token = await authenticatePluggy(clientId, clientSecret, fetchImpl);
  if (!token) throw new Error("A Pluggy recusou o Client ID/Secret (ou está fora do ar).");
  return token;
}

/** Status da Pluggy para a tela (nunca devolve as credenciais). */
export async function statusPluggy() {
  const s = await prisma.configuracaoPluggy.findFirst({ select: { isActive: true } });
  const viaAmbiente = !s && Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
  return { configured: Boolean(s) || viaAmbiente, active: Boolean(s?.isActive) || viaAmbiente };
}

async function credencialDaConta(conta: { id: string; credencialEncrypted: string | null }) {
  if (!conta.credencialEncrypted) throw new Error("Esta conta não tem a chave de API cadastrada.");
  return lerSegredo(conta.credencialEncrypted, (v) => prisma.contaBancaria.update({ where: { id: conta.id }, data: { credencialEncrypted: v } }));
}

/** Grava movimentos (sem duplicar) respeitando a data inicial da conta. */
export async function gravarMovimentos(conta: ContaComData, movimentos: Movimento[], origem: string) {
  const { mantidas, antesDaDataInicial } = aplicarDataInicial(
    movimentos.map((m) => ({ ...m, data: m.data.slice(0, 10) })),
    dataIsoDaConta(conta.dataInicial),
  );
  let novos = 0;
  for (let i = 0; i < mantidas.length; i += 200) {
    const lote = mantidas.slice(i, i + 200);
    const r = await prisma.transacaoBancaria.createMany({
      data: lote.map((m) => ({
        contaId: conta.id,
        data: new Date(`${m.data}T12:00:00Z`),
        descricao: m.descricao.slice(0, 500),
        valor: Math.round(m.valor * 100) / 100,
        tipo: m.tipo,
        categoria: m.categoria?.slice(0, 100) ?? null,
        externalId: m.externalId,
        origem,
      })),
      skipDuplicates: true,
    });
    novos += r.count;
  }
  return { novos, recebidos: movimentos.length, antesDaDataInicial };
}

export type ResultadoSync = { ok: boolean; mensagem: string; novos?: number; saldo?: number | null };

export async function sincronizarConta(contaId: string, fetchImpl: typeof fetch = fetch): Promise<ResultadoSync> {
  const conta = await prisma.contaBancaria.findUnique({ where: { id: contaId } });
  if (!conta) throw new Error("Conta não encontrada.");
  try {
    let movimentos: Movimento[];
    let saldo: number | null;
    // Releitura com folga: o banco pode lançar com atraso; a chave única evita duplicar.
    const ultima = conta.ultimaSincronizacao ? new Date(conta.ultimaSincronizacao.getTime() - 10 * 86400000).toISOString().slice(0, 10) : null;
    const desde = [dataIsoDaConta(conta.dataInicial), ultima].filter((x): x is string => Boolean(x)).sort().pop() ?? diasAtras(365);
    if (conta.provedor === "asaas") {
      const chave = await credencialDaConta(conta);
      movimentos = await fetchAsaasExtrato(chave, desde, hoje(), fetchImpl);
      saldo = await fetchAsaasSaldo(chave, fetchImpl);
    } else if (conta.provedor === "pluggy" && conta.pluggyAccountId) {
      const token = await tokenPluggy(fetchImpl);
      movimentos = await fetchPluggyTransactions(token, conta.pluggyAccountId, desde, fetchImpl);
      saldo = await fetchPluggyAccountBalance(token, conta.pluggyAccountId, fetchImpl);
    } else {
      return { ok: false, mensagem: "Esta conta é alimentada por importação de extrato (botão Importar extrato)." };
    }
    const r = await gravarMovimentos(conta, movimentos, conta.provedor);
    await prisma.contaBancaria.update({
      where: { id: conta.id },
      data: { ultimaSincronizacao: new Date(), ultimoErro: null, ...(saldo !== null ? { saldoAtual: saldo } : {}) },
    });
    return { ok: true, novos: r.novos, saldo, mensagem: `${r.novos} movimentação(ões) nova(s).` };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao sincronizar.";
    await prisma.contaBancaria.update({ where: { id: conta.id }, data: { ultimoErro: mensagem.slice(0, 500) } });
    return { ok: false, mensagem };
  }
}

/** Sincronização diária (cron): todas as contas ativas ligadas a uma API. */
export async function sincronizarTodasContas(fetchImpl: typeof fetch = fetch) {
  const contas = await prisma.contaBancaria.findMany({
    where: { ativo: true, provedor: { in: ["asaas", "pluggy"] } },
    select: { id: true },
  });
  const resultados = [];
  for (const c of contas) resultados.push({ contaId: c.id, ...(await sincronizarConta(c.id, fetchImpl)) });
  return { contas: contas.length, ok: resultados.filter((r) => r.ok).length, resultados };
}

// ── Importação de extrato ───────────────────────────────────────────────────

/** Lê o arquivo (CSV, Excel, OFX ou PDF) e devolve as linhas, sem gravar nada. */
export async function lerArquivoExtrato(nome: string, conteudo: Buffer, anoPadrao?: number): Promise<ResultadoLeitura> {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(conteudo));
    const linhas: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const porY = new Map<number, { x: number; s: string }[]>();
      for (const it of tc.items as { str: string; transform: number[] }[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5]);
        const chave = Array.from(porY.keys()).find((k) => Math.abs(k - y) <= 2) ?? y;
        porY.set(chave, [...(porY.get(chave) ?? []), { x: it.transform[4], s: it.str }]);
      }
      for (const y of Array.from(porY.keys()).sort((a, b) => b - a)) {
        linhas.push(porY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
      }
    }
    return lerTextoPdf(linhas, anoPadrao);
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(conteudo, { type: "buffer", cellDates: true });
    const tabela = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    return lerTabela(tabela, "Excel");
  }
  const texto = decodificar(conteudo);
  if (ext === "ofx" || /<OFX>|<STMTTRN>/i.test(texto)) return lerOfx(texto);
  if (ext === "csv" || ext === "txt") return lerCsv(texto);
  throw new Error("Formato não suportado. Use CSV, Excel (.xlsx/.xls), OFX ou PDF.");
}

function decodificar(buf: Buffer) {
  const utf8 = buf.toString("utf8");
  return utf8.includes("�") ? buf.toString("latin1") : utf8;
}

export type PreviaImportacao = {
  formato: string;
  linhas: (LinhaExtrato & { jaImportada: boolean })[];
  ignoradas: number;
  antesDaDataInicial: number;
  dataInicial: string | null;
};

export async function previaImportacao(contaId: string, nome: string, conteudo: Buffer, anoPadrao?: number): Promise<PreviaImportacao> {
  const conta = await prisma.contaBancaria.findUnique({ where: { id: contaId }, select: { id: true, dataInicial: true } });
  if (!conta) throw new Error("Conta não encontrada.");
  const lido = await lerArquivoExtrato(nome, conteudo, anoPadrao);
  const dataInicial = dataIsoDaConta(conta.dataInicial);
  const { mantidas, antesDaDataInicial } = aplicarDataInicial(lido.linhas, dataInicial);
  const chaves = chavesImportacao(conta.id, mantidas, sha);
  const existentes = new Set<string>();
  for (let i = 0; i < chaves.length; i += 500) {
    const r = await prisma.transacaoBancaria.findMany({ where: { externalId: { in: chaves.slice(i, i + 500) } }, select: { externalId: true } });
    r.forEach((x) => x.externalId && existentes.add(x.externalId));
  }
  return {
    formato: lido.formato,
    linhas: mantidas.map((l, i) => ({ ...l, jaImportada: existentes.has(chaves[i]) })),
    ignoradas: lido.ignoradas,
    antesDaDataInicial,
    dataInicial,
  };
}

export async function confirmarImportacao(contaId: string, linhas: LinhaExtrato[]) {
  const conta = await prisma.contaBancaria.findUnique({ where: { id: contaId }, select: { id: true, dataInicial: true } });
  if (!conta) throw new Error("Conta não encontrada.");
  // Mesmas chaves da prévia: filtra pela data inicial antes de numerar as ocorrências.
  const { mantidas, antesDaDataInicial } = aplicarDataInicial(linhas, dataIsoDaConta(conta.dataInicial));
  const chaves = chavesImportacao(conta.id, mantidas, sha);
  const r = await gravarMovimentos(conta, mantidas.map((l, i) => ({ ...l, externalId: chaves[i] })), "importacao");
  return { ...r, antesDaDataInicial };
}
