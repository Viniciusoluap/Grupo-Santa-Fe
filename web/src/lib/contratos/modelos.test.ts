import { describe, expect, it } from "vitest";
import { lerCamposModelo, montarContrato, type OpcoesContrato } from "./modelos.js";
import { gerarPdfModelo } from "./pdf.js";

const opcoes: OpcoesContrato = {
  empresa: { nome: "Empresa Exemplo", documento: "41.865.900/0001-89", endereco: "Rua Um, 10" },
  obras: [{
    id: "1", nome: "Obra 1", leadId: "2", cliente: "Cliente Exemplo", cpfCliente: "123.456.789-09",
    enderecoCliente: "Rua Dois, 20", conjuge: "", imovelId: "3", enderecoImovel: "Rua Três, 30, Quadra 1, Lote 2",
    foro: "Imperatriz/MA", area: "78", matricula: "547", cartorio: "1º Ofício de Imperatriz", prazo: "6",
    vgv: "250000.00", financiamento: "210000.00", fgts: "10000.00", subsidio: "20000.00", terreno: "50000.00",
    valorExecucao: "135000.00", percentualObra: "3.5", corretorId: "5", empreiteiroId: "4",
  }],
  empreiteiros: [{ id: "4", nome: "Empreiteiro Exemplo", documento: "987.654.321-00", endereco: "Rua Quatro, 40" }],
  corretores: [{ id: "5", nome: "Corretora Exemplo", creci: "12345-MA", percentualPadrao: "5" }],
};

const campos = {
  ...lerCamposModelo(new FormData()),
  tipo: "construcao_atc", obraId: "1", empresaNome: "Empresa Exemplo LTDA", empresaDocumento: opcoes.empresa.documento,
  empresaEndereco: opcoes.empresa.endereco, dataAssinatura: "2026-11-09",
  corretorId: "5", terrenoTerceiro: "sim", terrenoValor: "60000.00", prazoTerreno: "2027-01-09",
  terrenistaNome: "Terrenista Exemplo", terrenistaDocumento: "111.444.777-35", terrenistaEndereco: "Rua Cinco, 50",
};

describe("Modelos do Jurídico", () => {
  it("usa os vínculos corretos, separa terreno e obra e gera o PDF ATC completo", () => {
    const contrato = montarContrato(campos, opcoes);
    expect(contrato.valor).toBe(250000);
    expect(contrato.parteB).toBe("Cliente Exemplo");
    expect(contrato.empresa.nome).toBe("Empresa Exemplo LTDA");
    expect(contrato.obra).toMatchObject({ id: "1", leadId: "2", imovelId: "3" });
    expect(contrato.corretorId).toBe("5");
    expect(contrato.clausulas).toMatch(/60\.000,00 destinados à aquisição do terreno e R\$\s190\.000,00 à construção/);
    expect(contrato.clausulas).toContain("3,5% sobre o VGV");
    expect(contrato.clausulas).toContain("8.750,00");
    expect(contrato.clausulas).toContain("efetivo recebimento");
    expect(contrato.assinaturas).toContain("TERRENISTA / PROMITENTE VENDEDOR — Terrenista Exemplo");
    expect(contrato.assinaturas).toContain("CORRETOR INTERVENIENTE — Corretora Exemplo");
    expect(contrato.clausulas).not.toMatch(/\{\{|PROSPECTA/);

    const doc = gerarPdfModelo({
      numero: "TESTE-001", titulo: "CONSTRUÇÃO ATC", data: contrato.dataAssinatura,
      clausulas: contrato.clausulas, assinaturas: contrato.assinaturas,
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(3);
    expect(doc.output().slice(0, 4)).toBe("%PDF");
  });

  it("identifica empreiteiro como Parte B e cliente como proprietário, sem duplicar a corretagem", () => {
    const contrato = montarContrato({ ...campos, tipo: "execucao_obra", empreiteiroId: "4" }, opcoes);
    expect(contrato.valor).toBe(135000);
    expect(contrato.parteB).toBe("Empreiteiro Exemplo");
    expect(contrato.empreiteiroId).toBe("4");
    expect(contrato.clausulas).toContain("de propriedade de Cliente Exemplo");
    expect(contrato.clausulas).toContain("sem duplicar a cobrança");
    expect(contrato.assinaturas).toContain("EMPREITEIRO CONTRATADO — Empreiteiro Exemplo");
    expect(contrato.assinaturas).not.toContain("COMPRADOR — Cliente Exemplo");
    expect(contrato.clausulas).not.toContain("Terrenista Exemplo");
  });

  it("exige terrenista, empreiteiro, comissão e data válidos conforme o modelo", () => {
    expect(() => montarContrato({ ...campos, terrenistaDocumento: "" }, opcoes)).toThrow(/terrenista/);
    expect(() => montarContrato({ ...campos, tipo: "execucao_obra" }, opcoes)).toThrow(/empreiteiro/);
    expect(() => montarContrato({ ...campos, corretorId: "" }, opcoes)).toThrow(/corretor/);
    expect(() => montarContrato({ ...campos, dataAssinatura: "2026-02-31" }, opcoes)).toThrow(/data/);
  });

  it("identifica a própria construtora como vendedora quando o lote é dela", () => {
    const contrato = montarContrato({ ...campos, terrenoTerceiro: "nao", terrenoValor: "" }, opcoes);
    expect(contrato.clausulas).toContain("na condição de titular da matrícula");
    expect(contrato.clausulas).toContain("50.000,00");
    expect(contrato.assinaturas.join()).not.toContain("TERRENISTA");
  });
});
