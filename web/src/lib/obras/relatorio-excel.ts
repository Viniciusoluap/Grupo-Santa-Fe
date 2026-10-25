import type { RelatorioObra } from "@/lib/obras/relatorio";
import type * as XLSX from "xlsx";

type FotoReferencia = { legenda: string | null; data: string; url: string };

/** A mesma estrutura de campos, tabelas e gráficos usada pelo PDF. */
export async function montarExcelRelatorioObra(relatorio: RelatorioObra, fotos: FotoReferencia[]) {
  const xlsx = await import("xlsx");
  const livro = xlsx.utils.book_new();
  const moeda = /^R\$\s*(-?[\d.]+,\d{2})$/;
  const celula = (texto: string): XLSX.CellObject => {
    const m = moeda.exec(texto);
    if (m) return { t: "n", v: Number(m[1].replace(/\./g, "").replace(",", ".")), z: '"R$" #,##0.00' };
    return { t: "s", v: texto || "Não informado" };
  };
  const aba = (nome: string, linhas: string[][]) => {
    const sheet = xlsx.utils.aoa_to_sheet(linhas.map(l => l.map(celula)));
    const colunas = Math.max(2, ...linhas.map(l => l.length));
    sheet["!cols"] = Array.from({ length: colunas }, (_, i) => ({ wch: Math.min(70, Math.max(20, i === 0 ? 35 : 26)) }));
    const cabecalho = linhas.findIndex(l => l.length > 2);
    if (cabecalho >= 0) sheet["!autofilter"] = { ref: xlsx.utils.encode_range({ s: { r: cabecalho, c: 0 }, e: { r: linhas.length - 1, c: colunas - 1 } }) };
    xlsx.utils.book_append_sheet(livro, sheet, nome.slice(0, 31));
  };
  aba("Resumo executivo", [
    [relatorio.titulo, relatorio.subtitulo],
    ["Seção", "Campos", "Tabelas", "Gráficos"],
    ...relatorio.secoes.map(s => [s.titulo, String(s.campos.length), String(s.tabelas.length), String(s.graficos.length)]),
  ]);
  relatorio.secoes.forEach((secao, indice) => {
    const linhas: string[][] = [[secao.titulo], ["Campo", "Valor"], ...secao.campos.map(c => [c.rotulo, c.valor])];
    for (const tabela of secao.tabelas) {
      linhas.push([], [tabela.titulo], tabela.colunas);
      linhas.push(...(tabela.linhas.length ? tabela.linhas : [[tabela.vazio || "Não informado"]]));
    }
    for (const grafico of secao.graficos) {
      linhas.push([], [grafico.titulo], ["Indicador", `Valor (${grafico.unidade})`]);
      linhas.push(...grafico.itens.map(item => [item.rotulo, item.texto]));
    }
    aba(`${indice + 1} ${secao.titulo}`, linhas);
  });
  aba("Referências fotográficas", [["Legenda", "Data", "Link autenticado"],
    ...fotos.map(f => [f.legenda || "Sem legenda", f.data.slice(0, 10).split("-").reverse().join("/"), f.url])]);
  return livro;
}

export async function gerarExcelRelatorioObra(relatorio: RelatorioObra, fotos: FotoReferencia[], nome: string) {
  const xlsx = await import("xlsx");
  xlsx.writeFile(await montarExcelRelatorioObra(relatorio, fotos), nome);
}
