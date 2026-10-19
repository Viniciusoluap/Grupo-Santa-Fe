/** Gera amostras anônimas dos três modelos para validação em leitor externo. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerPci } from "../src/lib/caixa/pci.js";
import { gerarXlsMedicao, type EntradaMedicaoCaixa } from "../src/lib/caixa/medicao-xls.js";
import { gerarPdfMedicao } from "../src/lib/caixa/medicao-pdf.js";
import { dadosPlsPadrao, dadosRepactuacaoPadrao, dadosAlteracaoPadrao } from "../src/lib/medicao-caixa.js";

const destino = resolve(process.argv[2] ?? "/tmp/validacao-medicoes-caixa");
mkdirSync(destino, { recursive: true });
const modelo = new Uint8Array(readFileSync(new URL("../src/lib/caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));
const pci = lerPci(modelo);
const jpeg = new Uint8Array(Buffer.from("/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAFmX//2Q==", "base64"));
const resultados = [];
for (const tipo of ["pls", "repactuacao", "alteracao"] as const) {
  const entrada: EntradaMedicaoCaixa = {
    tipo, pci,
    execucoes: [100, 100, 50, 50, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    progresso: 29.35,
    anteriores: [{ data: "2026-06-25", progresso: 10.1 }],
    dados: {
      pls: { ...dadosPlsPadrao({ alvaraEmissao: pci.alvaraEmissao, alvaraVigencia: pci.alvaraVigencia }), dataLevantamento: "2026-08-25", observacoes: "AMOSTRA FICTICIA PARA VALIDACAO TECNICA. NAO PROTOCOLAR." },
      repactuacao: tipo === "repactuacao" ? { ...dadosRepactuacaoPadrao(6), dataRepactuacao: "2026-10-18", prazoProposto: 9, acumuladoProposto: [null, null, null, null, null, 55, 65, 80, 100], motivo: "Validacao tecnica com dados ficticios." } : null,
      alteracao: tipo === "alteracao" ? { ...dadosAlteracaoPadrao(), justificativa: "Validacao tecnica com dados ficticios.", custos: Array.from({ length: 19 }, () => 1000), bdi: 18, adicionais: [{ descricao: "Muro de teste", custo: 1000 }] } : null,
    },
    fotos: [{ dados: jpeg, tipo: "jpeg", legenda: "Imagem de teste ficticia" }],
  };
  const xls = gerarXlsMedicao(modelo, entrada);
  const pdf = gerarPdfMedicao(modelo, entrada);
  writeFileSync(resolve(destino, `${tipo}.xls`), xls);
  writeFileSync(resolve(destino, `${tipo}.pdf`), pdf);
  resultados.push({ tipo, xlsBytes: xls.length, pdfBytes: pdf.length });
}
console.log(JSON.stringify({ destino, resultados }, null, 2));
