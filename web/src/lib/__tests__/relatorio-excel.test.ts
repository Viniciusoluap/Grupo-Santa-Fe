import { describe, expect, it } from "vitest";
import { montarExcelRelatorioObra } from "@/lib/obras/relatorio-excel";
import type { RelatorioObra } from "@/lib/obras/relatorio";

describe("Excel executivo usa todos os dados do PDF", () => {
  it("mantém campos, tabelas, indicadores e referências de fotos em abas legíveis", async () => {
    const relatorio: RelatorioObra = { titulo: "Relatório executivo", subtitulo: "Obra A", secoes: [{
      id: "operacao", titulo: "Valores da Operação",
      campos: [{ rotulo: "VGV", valor: "R$ 230.000,00" }, { rotulo: "Lucro", valor: "Não informado" }],
      tabelas: [{ titulo: "Medições", colunas: ["Data", "Valor"], linhas: [["25/10/2026", "R$ 15.000,00"]], vazio: "Nenhuma medição" }],
      graficos: [{ titulo: "Distribuição", unidade: "moeda", itens: [{ rotulo: "Empreiteiro", valor: 5000, texto: "R$ 5.000,00" }] }],
    }] };
    const livro = await montarExcelRelatorioObra(relatorio, [{ legenda: "Frente", data: "2026-10-25", url: "https://exemplo.com/api/obras/fotos/1" }]);
    expect(livro.SheetNames).toEqual(["Resumo executivo", "1 Valores da Operação", "Referências fotográficas"]);
    const secao = livro.Sheets["1 Valores da Operação"];
    expect(secao["B3"]).toMatchObject({ t: "n", v: 230000 });
    expect(secao["B4"].v).toBe("Não informado");
    expect(secao["B8"].v).toBe(15000);
    expect(livro.Sheets["Referências fotográficas"]["C2"].v).toContain("/api/obras/fotos/1");
  });
});
