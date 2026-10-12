import { prisma } from "@/lib/db";
import { calcularObra, centavosDe, type EntradasObra, type ResultadoObra } from "@/lib/financeiro/obra";

// Leitura dos Valores da Operação e Custos de uma obra (EPIC-020 Lote 2), no
// mesmo formato do `obraFinanceiro.resumo` da Prospecta. Decimais viram texto
// ("1234.56") para atravessar a fronteira servidor → cliente sem perda.

const txt = (d: { toString(): string } | null | undefined) => (d == null ? null : d.toString());
const paraData = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export type MovimentoResumo = {
  id: string;
  natureza: "entrada" | "recebimento_cef" | "pagamento";
  categoria: string | null;
  descricao: string;
  valor: string;
  data: string;
  observacao: string | null;
  origem: "manual" | "bpo" | "migracao";
  status: "confirmado" | "cancelado";
  motivoCancelamento: string | null;
  bpo: { descricao: string; valor: number; pago: boolean } | null;
};

export type ResumoObra = {
  obra: { id: string; nome: string; valorTotalLegado: number | null; valorPagoLegado: number };
  valores: {
    vgv: string | null;
    financiamento: string | null;
    fgts: string | null;
    subsidio: string | null;
    custoTerreno: string | null;
    comissao: string | null;
    orcamentoPrevisto: string | null;
    taxaMensalPct: string | null;
    parcelas: number | null;
    dataInicio: string | null;
    dataTerminoPrevista: string | null;
    percentualEmpreiteiro: string | null;
  };
  empreiteiro: { id: string; nome: string } | null;
  investidores: { investidorId: string; nome: string; percentual: string }[];
  movimentos: MovimentoResumo[];
  calculo: ResultadoObra;
};

export async function carregarResumoObra(obraId: string): Promise<ResumoObra | null> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    include: {
      empreiteiro: { select: { id: true, nome: true } },
      investidores: { include: { investidor: { select: { nome: true } } }, orderBy: { investidor: { nome: "asc" } } },
      movimentos: {
        orderBy: [{ data: "asc" }, { criadoEm: "asc" }],
        include: { bpoLancamento: { select: { descricao: true, valor: true, pago: true } } },
      },
    },
  });
  if (!obra) return null;

  const entradas: EntradasObra = {
    vgv: centavosDe(txt(obra.vgv)),
    financiamento: centavosDe(txt(obra.financiamentoCef)),
    fgts: centavosDe(txt(obra.fgts)),
    subsidio: centavosDe(txt(obra.subsidio)),
    custoTerreno: centavosDe(txt(obra.custoTerreno)),
    comissao: centavosDe(txt(obra.comissaoValor)),
    orcamentoPrevisto: centavosDe(txt(obra.orcamentoPrevisto)),
    taxaMensalPct: txt(obra.taxaMensalPct),
    parcelas: obra.qtdeParcelas,
    dataInicio: paraData(obra.dataInicio),
    dataTerminoPrevista: paraData(obra.dataPrevisaoFim),
    investidores: obra.investidores.map((i) => ({ id: i.investidorId, percentual: i.percentual.toString() })),
    percentualEmpreiteiro: obra.empreiteiroId ? txt(obra.percentualEmpreiteiro) : null,
    movimentos: obra.movimentos.map((m) => ({
      natureza: m.natureza as MovimentoResumo["natureza"],
      valorCentavos: centavosDe(m.valor.toString())!,
      status: m.status as MovimentoResumo["status"],
    })),
  };
  const calculo = calcularObra(entradas);
  const alertasBpo = obra.movimentos
    .filter((m) => m.status === "confirmado" && m.bpoLancamento && !m.bpoLancamento.pago)
    .map((m) => `O lançamento do BPO vinculado a "${m.descricao}" deixou de estar pago. Revise o movimento.`);

  return {
    obra: { id: obra.id, nome: obra.nome, valorTotalLegado: obra.valorTotal, valorPagoLegado: obra.valorPago },
    valores: {
      vgv: txt(obra.vgv),
      financiamento: txt(obra.financiamentoCef),
      fgts: txt(obra.fgts),
      subsidio: txt(obra.subsidio),
      custoTerreno: txt(obra.custoTerreno),
      comissao: txt(obra.comissaoValor),
      orcamentoPrevisto: txt(obra.orcamentoPrevisto),
      taxaMensalPct: txt(obra.taxaMensalPct),
      parcelas: obra.qtdeParcelas,
      dataInicio: entradas.dataInicio,
      dataTerminoPrevista: entradas.dataTerminoPrevista,
      percentualEmpreiteiro: txt(obra.percentualEmpreiteiro),
    },
    empreiteiro: obra.empreiteiro,
    investidores: obra.investidores.map((i) => ({ investidorId: i.investidorId, nome: i.investidor.nome, percentual: i.percentual.toString() })),
    movimentos: obra.movimentos.map((m) => ({
      id: m.id,
      natureza: m.natureza as MovimentoResumo["natureza"],
      categoria: m.categoria,
      descricao: m.descricao,
      valor: m.valor.toString(),
      data: m.data.toISOString().slice(0, 10),
      observacao: m.observacao,
      origem: m.origem as MovimentoResumo["origem"],
      status: m.status as MovimentoResumo["status"],
      motivoCancelamento: m.motivoCancelamento,
      bpo: m.bpoLancamento,
    })),
    calculo: { ...calculo, alertas: [...calculo.alertas, ...alertasBpo] },
  };
}
