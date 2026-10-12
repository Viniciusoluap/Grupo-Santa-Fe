"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { centavosDe } from "@/lib/financeiro/obra";

// EPIC-020 Lote 2 — ações financeiras da obra (somente admin), com as mesmas
// regras da API `obraFinanceiro` da Prospecta. Os campos calculados não são
// aceitos: só as entradas são gravadas; os totais saem do motor único.

const DINHEIRO = /^\d{1,13}(\.\d{1,2})?$/;
const PERCENTUAL = /^\d{1,3}(\.\d{1,6})?$/;
const TAXA = /^\d{1,3}(\.\d{1,4})?$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const NATUREZAS = ["entrada", "recebimento_cef", "pagamento"] as const;
const CATEGORIAS = ["terreno", "comissao", "empreiteiro", "fornecedor", "outros"] as const;

const MENSAGENS_BANCO: Record<string, string> = {
  BPO_ALOCACAO_EXCEDIDA: "Este lançamento do BPO já está totalmente alocado (ou o valor ultrapassa o disponível).",
  BPO_LANCAMENTO_NAO_PAGO: "Só lançamentos do BPO já pagos/recebidos podem ser vinculados.",
  BPO_NATUREZA_INCOMPATIVEL: "Pagamentos usam despesas do BPO; recebimentos usam receitas do BPO.",
  BPO_LANCAMENTO_INEXISTENTE: "Lançamento do BPO não encontrado.",
  MOVIMENTO_NAO_PODE_SER_APAGADO: "Movimentos não são apagados: cancele para preservar o histórico.",
};

export type Resultado = { ok: true } | { ok: false; erro: string };

function traduzir(err: unknown): Resultado {
  const texto = err instanceof Error ? err.message : String(err);
  const codigo = Object.keys(MENSAGENS_BANCO).find((c) => texto.includes(c));
  if (!codigo) throw err;
  const disponivel = codigo === "BPO_ALOCACAO_EXCEDIDA" ? texto.match(/disponível R\$ ([\d.-]+)/)?.[1] : undefined;
  return { ok: false, erro: disponivel ? `${MENSAGENS_BANCO[codigo]} Disponível: R$ ${disponivel}.` : MENSAGENS_BANCO[codigo] };
}

async function exigirAdmin() {
  const session = await auth();
  requireActionRole(session, "admin");
  return (session!.user as { id?: string }).id ?? null;
}

function dinheiro(v: unknown, campo: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !DINHEIRO.test(v)) throw new Error(`Valor monetário inválido em ${campo}.`);
  return v;
}

function percentual(v: unknown, campo: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !PERCENTUAL.test(v) || Number(v) > 100) throw new Error(`${campo}: use um percentual entre 0% e 100%.`);
  return v;
}

export interface ValoresObraInput {
  obraId: string;
  vgv: string | null;
  financiamento: string | null;
  fgts: string | null;
  subsidio: string | null;
  custoTerreno: string | null;
  comissao: string | null;
  orcamentoPrevisto: string | null;
  taxaMensalPct: string | null;
  parcelas: number | null;
  empreiteiroId: string | null;
  percentualEmpreiteiro: string | null;
  escritorioCef: string | null;
}

export async function salvarValoresObra(input: ValoresObraInput): Promise<Resultado> {
  await exigirAdmin();
  const taxa = input.taxaMensalPct == null || input.taxaMensalPct === "" ? null : input.taxaMensalPct;
  if (taxa !== null && !TAXA.test(taxa)) return { ok: false, erro: "Taxa mensal inválida (até 4 casas decimais)." };
  if (input.parcelas !== null && (!Number.isInteger(input.parcelas) || input.parcelas < 0 || input.parcelas > 600))
    return { ok: false, erro: "Quantidade de parcelas inválida." };
  if (input.empreiteiroId) {
    const u = await prisma.usuario.findUnique({ where: { id: input.empreiteiroId }, select: { papel: true, ativo: true } });
    if (!u || u.papel !== "empreiteiro" || !u.ativo) return { ok: false, erro: "Selecione um empreiteiro cadastrado e ativo." };
  }
  try {
    await prisma.obra.update({
      where: { id: input.obraId },
      data: {
        vgv: dinheiro(input.vgv, "VGV"),
        financiamentoCef: dinheiro(input.financiamento, "Financiamento CEF"),
        fgts: dinheiro(input.fgts, "FGTS"),
        subsidio: dinheiro(input.subsidio, "Subsídio"),
        custoTerreno: dinheiro(input.custoTerreno, "Custo do Terreno"),
        comissaoValor: dinheiro(input.comissao, "Comissão"),
        orcamentoPrevisto: dinheiro(input.orcamentoPrevisto, "Orçamento Previsto"),
        taxaMensalPct: taxa,
        qtdeParcelas: input.parcelas,
        empreiteiroId: input.empreiteiroId || null,
        percentualEmpreiteiro: input.empreiteiroId ? percentual(input.percentualEmpreiteiro, "Participação do empreiteiro") : null,
        escritorioCef: input.escritorioCef?.trim() || null,
      },
    });
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Não foi possível salvar os valores." };
  }
  revalidatePath(`/admin/obras/${input.obraId}`);
  return { ok: true };
}

export async function definirInvestidoresObra(obraId: string, participacoes: { investidorId: string; percentual: string }[]): Promise<Resultado> {
  await exigirAdmin();
  const ids = participacoes.map((p) => p.investidorId);
  if (new Set(ids).size !== ids.length) return { ok: false, erro: "Investidor repetido na mesma obra." };
  for (const p of participacoes) {
    try { percentual(p.percentual, "Participação do investidor"); } catch (e) { return { ok: false, erro: (e as Error).message }; }
  }
  const soma = participacoes.reduce((acc, p) => acc + Math.round(Number(p.percentual) * 1e6), 0);
  if (soma > 100 * 1e6) return { ok: false, erro: "A soma das participações dos investidores não pode passar de 100%." };
  if (ids.length) {
    const ativos = await prisma.investidor.count({ where: { id: { in: ids }, ativo: true } });
    if (ativos !== ids.length) return { ok: false, erro: "Investidor inexistente ou inativo." };
  }
  await prisma.$transaction([
    prisma.obraInvestidor.deleteMany({ where: { obraId } }),
    prisma.obraInvestidor.createMany({ data: participacoes.map((p) => ({ obraId, investidorId: p.investidorId, percentual: p.percentual })) }),
  ]);
  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}

export async function listarInvestidores() {
  await exigirAdmin();
  return prisma.investidor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function criarInvestidor(dados: { nome: string; documento?: string; telefone?: string; email?: string }) {
  await exigirAdmin();
  const nome = dados.nome?.trim();
  if (!nome || nome.length < 2) throw new Error("Informe o nome do investidor.");
  return prisma.investidor.create({
    data: { nome, documento: dados.documento?.trim() || null, telefone: dados.telefone?.trim() || null, email: dados.email?.trim() || null },
    select: { id: true, nome: true },
  });
}

export async function listarEmpreiteiros() {
  await exigirAdmin();
  return prisma.usuario.findMany({ where: { papel: "empreiteiro", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarBpoDisponiveis(natureza: (typeof NATUREZAS)[number]) {
  await exigirAdmin();
  const lancamentos = await prisma.bpoLancamento.findMany({
    where: { pago: true, tipo: natureza === "pagamento" ? "despesa" : { not: "despesa" } },
    orderBy: { vencimento: "asc" },
    select: { id: true, descricao: true, valor: true, movimentosObra: { where: { status: "confirmado" }, select: { valor: true } } },
  });
  return lancamentos
    .map((l) => ({
      id: l.id,
      descricao: l.descricao,
      disponivelCentavos: centavosDe(l.valor)! - l.movimentosObra.reduce((acc, m) => acc + centavosDe(m.valor.toString())!, 0),
    }))
    .filter((l) => l.disponivelCentavos > 0);
}

export interface NovoMovimentoInput {
  obraId: string;
  natureza: (typeof NATUREZAS)[number];
  categoria?: (typeof CATEGORIAS)[number];
  descricao: string;
  valor: string;
  data: string;
  observacao?: string;
  bpoLancamentoId?: string;
}

export async function adicionarMovimentoObra(input: NovoMovimentoInput): Promise<Resultado> {
  const usuarioId = await exigirAdmin();
  if (!NATUREZAS.includes(input.natureza)) return { ok: false, erro: "Natureza inválida." };
  if ((input.natureza === "pagamento") !== !!input.categoria)
    return { ok: false, erro: input.natureza === "pagamento" ? "Informe a categoria do pagamento." : "Recebimentos não têm categoria." };
  if (input.categoria && !CATEGORIAS.includes(input.categoria)) return { ok: false, erro: "Categoria inválida." };
  if (!DINHEIRO.test(input.valor ?? "") || Number(input.valor) <= 0) return { ok: false, erro: "O valor deve ser maior que zero." };
  if (!DATA.test(input.data ?? "")) return { ok: false, erro: "Data inválida." };
  const descricao = input.descricao?.trim();
  if (!descricao || descricao.length < 2) return { ok: false, erro: "Informe a descrição." };
  try {
    await prisma.obraMovimento.create({
      data: {
        obraId: input.obraId,
        natureza: input.natureza,
        categoria: input.natureza === "pagamento" ? input.categoria : null,
        descricao: descricao.slice(0, 255),
        valor: input.valor,
        data: new Date(`${input.data}T00:00:00.000Z`),
        observacao: input.observacao?.trim() || null,
        origem: input.bpoLancamentoId ? "bpo" : "manual",
        bpoLancamentoId: input.bpoLancamentoId || null,
        criadoPorId: usuarioId,
      },
    });
  } catch (err) {
    return traduzir(err);
  }
  revalidatePath(`/admin/obras/${input.obraId}`);
  return { ok: true };
}

export async function cancelarMovimentoObra(id: string, motivo: string): Promise<Resultado> {
  const usuarioId = await exigirAdmin();
  if (!motivo || motivo.trim().length < 3) return { ok: false, erro: "Informe o motivo do cancelamento." };
  const r = await prisma.obraMovimento.updateMany({
    where: { id, status: "confirmado" },
    data: { status: "cancelado", motivoCancelamento: motivo.trim().slice(0, 500), atualizadoPorId: usuarioId },
  });
  if (r.count === 0) return { ok: false, erro: "Movimento inexistente ou já cancelado." };
  return { ok: true };
}

export async function reativarMovimentoObra(id: string): Promise<Resultado> {
  const usuarioId = await exigirAdmin();
  try {
    const r = await prisma.obraMovimento.updateMany({
      where: { id, status: "cancelado" },
      data: { status: "confirmado", motivoCancelamento: null, atualizadoPorId: usuarioId },
    });
    if (r.count === 0) return { ok: false, erro: "Movimento inexistente ou já confirmado." };
  } catch (err) {
    return traduzir(err);
  }
  return { ok: true };
}
