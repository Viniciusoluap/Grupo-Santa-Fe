"use server";
// Paridade BPO (13/11) com a Prospecta (bpo.contaAzul.*, bpo.aClassificar.*, bpo.centrosCusto.* do bpo-router):
// importar backup do Conta Azul, aba "A classificar" (criar lançamento, ignorar, confirmar, dar baixa/dividir) e
// cadastro de centros de custo. Os erros voltam como dado ({ erroAcao }) para chegar em português à tela.
import { revalidatePath } from "next/cache";
import { exigirAdminAtivo, exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { LIMITE_ARQUIVO_CONTA_AZUL } from "@/lib/financeiro/conta-azul";
import { importarContaAzul, previaContaAzul } from "@/lib/bpo-conta-azul";
import {
  abertosParaBaixa, confirmarLancamentos, contagemAClassificar, criarLancamentosDasMovimentacoes, darBaixaComMovimentacao,
  ignorarMovimentacoes, lancamentosAClassificar, movimentacoesAClassificar,
} from "@/lib/bpo-a-classificar";
import { ativarCentroCusto, criarCentroCusto, listarCentrosCusto, renomearCentroCusto } from "@/lib/bpo-centros-custo";

const BPO = "/admin/bpo";
const MAX_IDS = 5000;

function arquivosValidos(arquivos: unknown): Record<string, string> {
  if (!arquivos || typeof arquivos !== "object" || Array.isArray(arquivos)) throw new Error("Arquivo do backup inválido.");
  const entradas = Object.entries(arquivos as Record<string, unknown>);
  if (!entradas.length || entradas.length > 20) throw new Error("O ZIP não tem os arquivos .csv do Conta Azul.");
  const out: Record<string, string> = {};
  for (const [nome, texto] of entradas) {
    if (typeof texto !== "string" || nome.length > 200) throw new Error("Arquivo do backup inválido.");
    if (texto.length > LIMITE_ARQUIVO_CONTA_AZUL) throw new Error(`${nome} passa do limite de ${Math.round(LIMITE_ARQUIVO_CONTA_AZUL / 1_000_000)} MB de texto.`);
    out[nome] = texto;
  }
  return out;
}

function idsValidos(ids: unknown): string[] {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_IDS || ids.some((x) => typeof x !== "string" || !x || x.length > 64)) throw new Error("Seleção inválida.");
  return Array.from(new Set(ids as string[]));
}

// ── Conta Azul ──────────────────────────────────────────────────────────────

export async function previaContaAzulAcao(arquivos: Record<string, string>) {
  return capturarErroAcao(async () => {
    await exigirAdminAtivo();
    await exigirModuloAcao("bpo");
    return previaContaAzul(arquivosValidos(arquivos));
  });
}

export async function importarContaAzulAcao(arquivos: Record<string, string>) {
  return capturarErroAcao(async () => {
    await exigirAdminAtivo();
    await exigirModuloAcao("bpo");
    const r = await importarContaAzul(arquivosValidos(arquivos));
    revalidatePath(BPO);
    return r;
  });
}

// ── A classificar ───────────────────────────────────────────────────────────

export async function dadosAClassificar() {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const [movimentacoes, lancamentos, contagem] = await Promise.all([movimentacoesAClassificar(), lancamentosAClassificar(), contagemAClassificar()]);
    return {
      contagem,
      movimentacoes: movimentacoes.map((m) => ({ ...m, data: m.data.toISOString() })),
      lancamentos: lancamentos.map((l) => ({
        id: l.id, tipo: l.tipo, descricao: l.descricao, valor: l.valor, valorRecebido: l.valorRecebido, vencimento: l.vencimento.toISOString(),
        competencia: l.competencia, pago: l.pago, categoria: l.categoria, centroCustos: l.centroCustos, clienteId: l.clienteId,
        clienteNome: l.clienteNome, asaasPaymentId: l.asaasPaymentId, transacaoId: l.transacaoId, version: l.version, observacoes: l.observacoes,
        origemEfetiva: l.origemEfetiva,
      })),
    };
  });
}

export async function criarLancamentosAClassificar(input: { ids: string[]; categoria: string; bpoClienteId?: string | null; centroCustos?: string | null }) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await criarLancamentosDasMovimentacoes(idsValidos(input?.ids), {
      categoria: String(input?.categoria ?? ""),
      ...(input?.bpoClienteId !== undefined ? { bpoClienteId: input.bpoClienteId ? String(input.bpoClienteId) : null } : {}),
      ...(input?.centroCustos !== undefined ? { centroCustos: input.centroCustos ? String(input.centroCustos).slice(0, 100) : null } : {}),
    });
    revalidatePath(BPO);
    return r;
  });
}

export async function ignorarAClassificar(ids: string[]) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await ignorarMovimentacoes(idsValidos(ids));
    revalidatePath(BPO);
    return r;
  });
}

export async function confirmarAClassificar(ids: string[]) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("bpo");
    const r = await confirmarLancamentos(idsValidos(ids), u.id);
    revalidatePath(BPO);
    return r;
  });
}

export async function abertosParaBaixaAcao(movimentacaoId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await abertosParaBaixa(String(movimentacaoId));
    return {
      movimentacao: { ...r.movimentacao, data: r.movimentacao.data.toISOString() },
      abertos: r.abertos.map((l) => ({ ...l, vencimento: l.vencimento.toISOString() })),
      sugeridos: r.sugeridos,
    };
  });
}

export async function darBaixaAcao(input: { movimentacaoId: string; alocacoes: { lancamentoId: string; valor: number }[] }) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("bpo");
    if (!Array.isArray(input?.alocacoes) || input.alocacoes.length > 200
      || input.alocacoes.some((a) => !a || typeof a.lancamentoId !== "string" || typeof a.valor !== "number")) throw new Error("Divisão inválida.");
    const r = await darBaixaComMovimentacao({ movimentacaoId: String(input.movimentacaoId), alocacoes: input.alocacoes.map((a) => ({ lancamentoId: a.lancamentoId, valor: a.valor })) }, u.id);
    revalidatePath(BPO);
    return r;
  });
}

// ── Centros de custo ────────────────────────────────────────────────────────

export async function listarCentrosCustoAcao() {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    return listarCentrosCusto();
  });
}

export async function criarCentroCustoAcao(nome: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const c = await criarCentroCusto(String(nome ?? ""));
    revalidatePath(BPO);
    return { id: c.id, nome: c.nome, ativo: c.ativo };
  });
}

export async function renomearCentroCustoAcao(id: string, nome: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const r = await renomearCentroCusto(String(id), String(nome ?? ""));
    revalidatePath(BPO);
    return { lancamentos: r.lancamentos, nome: r.centro.nome };
  });
}

export async function ativarCentroCustoAcao(id: string, ativo: boolean) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("bpo");
    const c = await ativarCentroCusto(String(id), Boolean(ativo));
    revalidatePath(BPO);
    return { id: c.id, ativo: c.ativo };
  });
}
