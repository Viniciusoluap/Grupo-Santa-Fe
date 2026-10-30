import { formatarNumero } from "@/lib/numero-mascara";

// Exportação CSV de comissões — paridade com a Prospecta (`shared/comissoes-csv.ts`
// + `buildComissoesExportNovas` em `server/relatorios-comissoes.ts`): mesmas
// colunas, mesmo formato (";", BOM UTF-8, valores 1.234,56) e mesmo recorte
// (todas as comissões cadastradas, ordenadas pelo vencimento).

export type ComissaoCsvLinha = {
  origem: string;
  data: string;
  corretor: string;
  referencia: string | null;
  valorTotal: number;
  pago: number;
  status: string;
};

export type ComissaoParaExportar = {
  beneficiario: string;
  imovel: string;
  valor: number;
  status: string;
  vencimento: Date;
  pagamentoEm: Date | null;
  corretor: { nome: string } | null;
};

export const CABECALHO_CSV_COMISSOES = "Origem;Data;Corretor;Referência;Valor Total;Pago;Status";

/** Mesma regra de `buildComissoesExportNovas` da Prospecta. */
export function linhasExportacaoComissoes(rows: ComissaoParaExportar[]): ComissaoCsvLinha[] {
  return rows.map((r) => {
    const valorTotal = Number(r.valor);
    return {
      origem: "operacional",
      data: (r.pagamentoEm ?? r.vencimento).toISOString().slice(0, 10),
      corretor: r.corretor?.nome ?? (r.beneficiario === "empresa" ? "Empresa" : "Corretor sem cadastro"),
      referencia: r.imovel,
      valorTotal,
      pago: r.status === "paga" ? valorTotal : 0,
      status: r.status,
    };
  });
}

export function campoCsv(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

export function montarCsvComissoes(linhas: ComissaoCsvLinha[]): string {
  const corpo = linhas.map((r) =>
    [
      campoCsv(r.origem),
      campoCsv(r.data),
      campoCsv(r.corretor),
      campoCsv(r.referencia ?? ""),
      formatarNumero(r.valorTotal, { casas: 2 }),
      formatarNumero(r.pago, { casas: 2 }),
      campoCsv(r.status),
    ].join(";"),
  );
  return "﻿" + [CABECALHO_CSV_COMISSOES, ...corpo].join("\n");
}

export function nomeArquivoCsvComissoes(hoje = new Date()): string {
  return `comissoes-${hoje.toISOString().slice(0, 10)}.csv`;
}
