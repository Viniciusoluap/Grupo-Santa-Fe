// Agregações anuais do fluxo mensal da Viabilidade (Correção 11).
//
// Convenção única do sistema: M0 = data-base; M1 = 1º mês do empreendimento.
// Ano 1 = M0..M12, Ano 2 = M13..M24, … (antes, floor(mes/12) jogava o M12 no "Ano 2").
// Três cronogramas distintos: COMERCIALIZAÇÃO (vendas contratadas), RECEBIMENTO (caixa que
// entra pelos vencimentos) e DESEMBOLSO (caixa que sai). Anos sem nenhum evento não aparecem.

import type { FluxoMesLote, ResultadoLoteamento } from "@/lib/finance/loteamento";

export function anoDoMes(mes: number): number {
  return mes <= 0 ? 1 : Math.ceil(mes / 12);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function agrupar<T extends { ano: number }>(fluxo: FluxoMesLote[], vazio: (ano: number) => T, somar: (a: T, f: FluxoMesLote) => void, temDado: (a: T) => boolean): T[] {
  const mapa = new Map<number, T>();
  for (const f of fluxo) {
    const ano = anoDoMes(f.mes);
    if (!mapa.has(ano)) mapa.set(ano, vazio(ano));
    somar(mapa.get(ano)!, f);
  }
  return Array.from(mapa.values()).sort((a, b) => a.ano - b.ano).filter(temDado);
}

export interface VendasAno { ano: number; unidades: number; vgv: number }
export function vendasPorAno(r: ResultadoLoteamento): VendasAno[] {
  return agrupar<VendasAno>(r.fluxo, (ano) => ({ ano, unidades: 0, vgv: 0 }), (a, f) => { a.unidades += f.vendasUnidades ?? 0; a.vgv += f.vendasVgv ?? 0; }, (a) => a.vgv > 0.005)
    .map((a) => ({ ...a, unidades: r2(a.unidades), vgv: r2(a.vgv) }));
}

export interface RecebimentosAno { ano: number; bruto: number; voce: number; terreneiro: number }
/** Agrega o fluxo mensal em recebimentos por ano (bruto, incorporador, terreneiro). */
export function recebimentosPorAno(r: ResultadoLoteamento): RecebimentosAno[] {
  return agrupar<RecebimentosAno>(r.fluxo, (ano) => ({ ano, bruto: 0, voce: 0, terreneiro: 0 }), (a, f) => { a.bruto += f.receitaBruta; a.voce += f.receitaVoce; a.terreneiro += f.receitaTerreneiro; }, (a) => a.bruto > 0.005)
    .map((a) => ({ ano: a.ano, bruto: r2(a.bruto), voce: r2(a.voce), terreneiro: r2(a.terreneiro) }));
}

export interface CustosAno { ano: number; preVenda: number; duranteVenda: number; terreno: number; financeiro: number; total: number }
/** Desembolsos por ano: obra e custos fixos (nominal, c/ INCC), custos de venda, terreno e remuneração de investidores. */
export function custosPorAno(r: ResultadoLoteamento): CustosAno[] {
  return agrupar<CustosAno>(r.fluxo, (ano) => ({ ano, preVenda: 0, duranteVenda: 0, terreno: 0, financeiro: 0, total: 0 }), (a, f) => {
    a.preVenda += f.custoPreVenda; a.duranteVenda += f.custoDuranteVenda; a.terreno += f.custoTerreno ?? 0; a.financeiro += f.resgateRemuneracao ?? 0;
    a.total += f.custoPreVenda + f.custoDuranteVenda + (f.custoTerreno ?? 0) + (f.resgateRemuneracao ?? 0);
  }, (a) => a.total > 0.005).map((a) => ({ ano: a.ano, preVenda: r2(a.preVenda), duranteVenda: r2(a.duranteVenda), terreno: r2(a.terreno), financeiro: r2(a.financeiro), total: r2(a.total) }));
}

export interface FluxoAno { ano: number; recebimentos: number; custos: number; aportes: number; resgatesPrincipal: number; remuneracaoInvestidores: number; saldoProjeto: number; saldo: number; acumulado: number }
/** Fluxo de caixa por ano. Incorporador = projeto + aportes − devolução do principal − remuneração dos investidores. */
export function fluxoPorAno(r: ResultadoLoteamento): FluxoAno[] {
  const anos = agrupar<FluxoAno>(r.fluxo, (ano) => ({ ano, recebimentos: 0, custos: 0, aportes: 0, resgatesPrincipal: 0, remuneracaoInvestidores: 0, saldoProjeto: 0, saldo: 0, acumulado: 0 }), (a, f) => {
    a.recebimentos += f.receitaVoce;
    a.custos += f.custoPreVenda + f.custoDuranteVenda + (f.custoTerreno ?? 0) + (f.resgateRemuneracao ?? 0);
    a.aportes += f.aporteCaptacao ?? 0; a.resgatesPrincipal += f.resgatePrincipal ?? 0; a.remuneracaoInvestidores += f.resgateRemuneracao ?? 0;
    a.saldoProjeto += f.saldoProjeto ?? f.saldoMes; a.saldo += f.saldoMes; a.acumulado = f.saldoAcumulado;
  }, (a) => a.recebimentos > 0.005 || a.custos > 0.005 || a.aportes > 0.005 || a.resgatesPrincipal > 0.005);
  return anos.map((a) => ({ ano: a.ano, recebimentos: r2(a.recebimentos), custos: r2(a.custos), aportes: r2(a.aportes), resgatesPrincipal: r2(a.resgatesPrincipal), remuneracaoInvestidores: r2(a.remuneracaoInvestidores), saldoProjeto: r2(a.saldoProjeto), saldo: r2(a.saldo), acumulado: r2(a.acumulado) }));
}
