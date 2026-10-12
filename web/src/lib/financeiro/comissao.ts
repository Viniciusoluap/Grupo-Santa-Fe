// EPIC-020 Lote 3 (item 32) — comissão de obra calculada pelo CRM.
// Mesmo arquivo em Prospecta/shared/financeiro/comissao.ts.
//
// Comissão = VGV da obra × Percentual de Comissão / 100 (centavos, HALF_UP).
// O percentual é a regra cadastrada: o da própria obra ou, na falta dele, o
// percentual padrão do corretor. Nunca há percentual inventado: sem regra,
// a comissão fica "dados incompletos" e não tem valor.

import { aplicarPercentual, percentualMicro } from "./obra";

export type FontePercentual = "obra" | "corretor";
export type StatusComissaoObra = "dados_incompletos" | "pendente" | "parcial" | "paga";

export interface EntradaComissaoObra {
  /** Obra tem corretor vinculado pelo lead do CRM. */
  corretor: { id: string | number; nome: string; percentualPadrao: string | null } | null;
  vgvCentavos: number | null;
  /** Percentual cadastrado na própria obra ("5", "2.5"). */
  percentualObra: string | null;
  /** Soma dos pagamentos confirmados de categoria "comissão" da obra. */
  pagoCentavos: number;
}

export interface ComissaoObraCalculada {
  elegivel: boolean;
  percentual: string | null;
  fontePercentual: FontePercentual | null;
  valorCentavos: number | null;
  pagoCentavos: number;
  saldoCentavos: number | null;
  status: StatusComissaoObra;
  pendencias: string[];
  alertas: string[];
}

function percentualValido(p: string | null | undefined): string | null {
  if (p === null || p === undefined || String(p).trim() === "") return null;
  const micro = percentualMicro(p);
  if (micro === null || micro < BigInt(0) || micro > BigInt(100_000_000)) return null;
  return String(p).trim();
}

/** VGV × % / 100 em centavos (HALF_UP). Teste G: 230.000 × 5% = 11.500,00. */
export function valorComissao(vgvCentavos: number, percentual: string): number {
  return aplicarPercentual(vgvCentavos, percentualMicro(percentual)!);
}

export function calcularComissaoObra(e: EntradaComissaoObra): ComissaoObraCalculada {
  const pendencias: string[] = [];
  const alertas: string[] = [];
  if (!e.corretor) {
    return {
      elegivel: false, percentual: null, fontePercentual: null, valorCentavos: null,
      pagoCentavos: e.pagoCentavos, saldoCentavos: null, status: "dados_incompletos",
      pendencias: ["Lead da obra sem corretor vinculado no CRM"], alertas,
    };
  }
  const daObra = percentualValido(e.percentualObra);
  const doCorretor = percentualValido(e.corretor.percentualPadrao);
  const percentual = daObra ?? doCorretor;
  const fontePercentual: FontePercentual | null = daObra ? "obra" : doCorretor ? "corretor" : null;
  if (e.vgvCentavos === null) pendencias.push("VGV não informado em Valores da Operação");
  else if (e.vgvCentavos <= 0) pendencias.push("VGV deve ser maior que zero");
  if (!percentual) pendencias.push("Percentual de comissão não cadastrado (na obra ou no corretor)");

  const valorCentavos = pendencias.length === 0 ? valorComissao(e.vgvCentavos!, percentual!) : null;
  const saldoCentavos = valorCentavos === null ? null : valorCentavos - e.pagoCentavos;
  if (saldoCentavos !== null && saldoCentavos < 0)
    alertas.push("Pagamentos de comissão superam o valor calculado — verifique os lançamentos.");
  if (valorCentavos === null && e.pagoCentavos > 0)
    alertas.push("Há pagamentos de comissão registrados, mas a comissão não pode ser calculada.");

  let status: StatusComissaoObra;
  if (valorCentavos === null) status = "dados_incompletos";
  else if (e.pagoCentavos >= valorCentavos) status = "paga";
  else if (e.pagoCentavos <= 0) status = "pendente";
  else status = "parcial";

  return { elegivel: true, percentual, fontePercentual, valorCentavos, pagoCentavos: e.pagoCentavos, saldoCentavos, status, pendencias, alertas };
}
