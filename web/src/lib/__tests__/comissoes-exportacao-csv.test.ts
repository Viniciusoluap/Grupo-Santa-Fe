import { describe, expect, it } from "vitest";
import {
  CABECALHO_CSV_COMISSOES,
  linhasExportacaoComissoes,
  montarCsvComissoes,
  nomeArquivoCsvComissoes,
} from "@/lib/comissoes/exportacao-csv";

// Gêmeo de `server/comissoes-csv.test.ts` + `buildComissoesExportNovas` da Prospecta.
describe("exportação CSV de comissões", () => {
  it("mapeia as comissões com a mesma regra da Prospecta", () => {
    const linhas = linhasExportacaoComissoes([
      { beneficiario: "corretor", imovel: "Casa 1", valor: 12345.6, status: "paga", vencimento: new Date("2026-10-10T12:00:00Z"), pagamentoEm: new Date("2026-10-01T12:00:00Z"), corretor: { nome: "Ana" } },
      { beneficiario: "empresa", imovel: "Obra X", valor: 1000000, status: "pendente", vencimento: new Date("2026-10-02T12:00:00Z"), pagamentoEm: null, corretor: null },
      { beneficiario: "corretor", imovel: "Apto", valor: 10, status: "aprovada", vencimento: new Date("2026-10-03T12:00:00Z"), pagamentoEm: null, corretor: null },
    ]);
    expect(linhas).toEqual([
      { origem: "operacional", data: "2026-10-01", corretor: "Ana", referencia: "Casa 1", valorTotal: 12345.6, pago: 12345.6, status: "paga" },
      { origem: "operacional", data: "2026-10-02", corretor: "Empresa", referencia: "Obra X", valorTotal: 1000000, pago: 0, status: "pendente" },
      { origem: "operacional", data: "2026-10-03", corretor: "Corretor sem cadastro", referencia: "Apto", valorTotal: 10, pago: 0, status: "aprovada" },
    ]);
  });

  it("monta cabeçalho, BOM e valores no padrão 1.234,56", () => {
    const csv = montarCsvComissoes([
      { origem: "operacional", data: "2026-10-01", corretor: "Ana", referencia: "Casa 1", valorTotal: 12345.6, pago: 12345.6, status: "paga" },
      { origem: "operacional", data: "2026-10-02", corretor: "Empresa", referencia: null, valorTotal: 1000000, pago: 0, status: "pendente" },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const linhas = csv.slice(1).split("\n");
    expect(linhas[0]).toBe(CABECALHO_CSV_COMISSOES);
    expect(linhas[1]).toBe("operacional;2026-10-01;Ana;Casa 1;12.345,60;12.345,60;paga");
    expect(linhas[2]).toBe("operacional;2026-10-02;Empresa;;1.000.000,00;0,00;pendente");
  });

  it("põe entre aspas campos com ponto e vírgula ou aspas", () => {
    const csv = montarCsvComissoes([
      { origem: "operacional", data: "2026-10-01", corretor: 'João "JJ"', referencia: "Lote 1; Quadra 2", valorTotal: 1, pago: 0, status: "pendente" },
    ]);
    expect(csv.split("\n")[1]).toBe('operacional;2026-10-01;"João ""JJ""";"Lote 1; Quadra 2";1,00;0,00;pendente');
  });

  it("nome do arquivo com a data", () => {
    expect(nomeArquivoCsvComissoes(new Date("2026-10-30T12:00:00Z"))).toBe("comissoes-2026-10-30.csv");
  });
});
