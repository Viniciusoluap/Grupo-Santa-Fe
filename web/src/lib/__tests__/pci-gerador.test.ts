import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  aplicarEngenheiroPci,
  coordenadaDecimalParaPci,
  coordenadaPciParaCelula,
  formatoModeloPci,
  formularioPciVazio,
  normalizarFormularioPci,
  preencherPciAutomatico,
  prazoEmMeses,
  separarTelefone,
  type FormularioPci,
} from "@/lib/pci-gerador";
import { gerarPdfPci, gerarPlanilhaPci, lerFormularioPci, PastaXlsx } from "@/lib/caixa/pci-gerador.js";
import { lerPci } from "@/lib/caixa/pci.js";
import { PastaBiff8 } from "@/lib/caixa/biff8.js";
import { imagensDaAba } from "@/lib/caixa/biff8-imagens.js";

const MODELO = new Uint8Array(readFileSync(new URL("../caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));

function formularioCompleto(): FormularioPci {
  const f = formularioPciVazio();
  Object.assign(f.campos, {
    proponenteNome: "MARIA DIGITADA", proponenteEmail: "maria@teste.local", proponenteCpf: "123.456.789-09", proponenteDdd: 98, proponenteTelefone: "991234567",
    rtpNome: "ENG PROJETO", rtpEmail: "proj@teste.local", rtpRegistro: "1112223334", rtpUf: "MA", rtpCpf: "111.222.333-44", rtpDdd: 99, rtpTelefone: "981112222",
    rteNome: "ENG EXECUCAO", rteEmail: "exec@teste.local", rteRegistro: "12345/D", rteUf: "PI", rteCpf: "555.666.777-88", rteDdd: 86, rteTelefone: "999887766",
    endereco: "RUA NOVA, 10", complemento: "LOTE 5, QUADRA B", bairro: "CENTRO", cep: "65901-230", municipio: "IMPERATRIZ", uf: "MA",
    matricula: "4321", cartorio: "2º OFICIO", latitude: `05° 29' 18" S`, longitude: `47° 28' 30.5" W`, construtora: "CONSTRUTORA TESTE", cnpjConstrutora: "11.222.333/0001-81", finalidade: "Construção em terreno próprio",
    alvaraSituacao: "Apresentado", alvaraValidade: "2027-03-15", terrenoProprio: "Sim", artProjetoSituacao: "Apresentado", artProjetoNumero: "MA123", artExecucaoSituacao: "Apresentado", artExecucaoNumero: "MA456", projetoLegalSituacao: "Apresentado projeto aprovado",
    areaCoberta: 60.5, areaPermeavel: 100, areaAcessoria: 4.5, areaTerreno: 300, valorTerreno: 80000, destinacao: "Residencial", valorImovel: 250000,
    padraoAcabamento: "Normal", implantacao: "Isolada", cobertura: "Telha cerâmica", teto: "Forro PVC", pavimentos: 1, quartos: 3, suites: 1, salas: 1, vagas: 2, tipoVagas: "Coberta(s)",
    divisaoInterna: "3 QUARTOS, SALA, COZINHA", sistemaConstrutivo: "Conv:Estrut Concreto", especificacaoSistema: "CONCRETO ARMADO", usoEps: "Não", seloCasaAzul: "Não",
    drenagem: "Interna ao terreno", esgoto: "Rede pública", esgotoDescricao: "LIGAÇÃO NA REDE", bdi: 20, prazoMeses: 4, localData: "IMPERATRIZ, 27 DE OUTUBRO DE 2026",
  });
  f.custos = [5000, 10000, 15000, 12000, 6000, 0, 8000, 7000, 9000, 1500, 5000, 4500, 10000, 1500, 5000, 5000, 5000, 5000, 500];
  f.adicionais[0] = { descricao: "MURO", valor: 5000 };
  f.adicionais[1] = { descricao: "PORTÃO", valor: 2000 };
  f.cronograma = [25, 50, 75, 100];
  return normalizarFormularioPci(f);
}

describe("Gerador de PCI — mapa de células (ida e volta)", () => {
  it("o .xls gerado devolve exatamente os dados digitados e o lerPci lê a proposta", () => {
    const form = formularioCompleto();
    const r = gerarPlanilhaPci(MODELO, "xls", form);
    expect(r.formato).toBe("xls");
    expect(r.avisos).toEqual([]);
    const volta = lerFormularioPci(r.bytes);
    expect(volta.campos).toEqual(form.campos ? Object.fromEntries(Object.entries(form.campos).map(([k, v]) => [k, k === "valorFinanciado" ? null : v])) : {});
    expect(volta.custos).toEqual(form.custos);
    expect(volta.adicionais.slice(0, 2)).toEqual(form.adicionais.slice(0, 2));
    expect(volta.cronograma).toEqual(form.cronograma);

    const pci = lerPci(r.bytes);
    expect(pci.identificacao).toMatchObject({
      proponente: "MARIA DIGITADA", emailProponente: "maria@teste.local", cpfProponente: "123.456.789-09", telefoneProponente: "98 99123-4567",
      rtpNome: "ENG PROJETO", rtpRegistro: "1112223334", rtpUf: "MA", rteNome: "ENG EXECUCAO", rteRegistro: "12345/D", rteUf: "PI",
      endereco: "RUA NOVA, 10", complemento: "LOTE 5, QUADRA B", bairro: "CENTRO", cep: "65901-230", municipio: "IMPERATRIZ", uf: "MA",
      matricula: "4321", cartorio: "2º OFICIO", latitude: `05° 29' 18" S`, longitude: `47° 28' 30.5" W`, construtora: "CONSTRUTORA TESTE",
    });
    const total = 5000 + 10000 + 15000 + 12000 + 6000 + 8000 + 7000 + 9000 + 1500 + 5000 + 4500 + 10000 + 1500 + 5000 * 4 + 500 + 7000;
    expect(pci.incidencias[0]).toBeCloseTo((5000 / total) * 100, 10);
    expect(pci.incidencias[19]).toBeCloseTo((7000 / total) * 100, 10);
    expect(pci.incidencias.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 8);
    // prazoMeses do lerPci vem primeiro da aba PLS (preenchida na medição); o da proposta é o T161.
    expect(volta.campos.prazoMeses).toBe(4);
    expect(pci.cronogramaProposto.slice(1, 5)).toEqual([25, 50, 75, 100]);
  });

  it("campos vazios limpam o valor que o modelo trazia", () => {
    const form = formularioCompleto();
    form.campos.complemento = null;
    const volta = lerFormularioPci(gerarPlanilhaPci(MODELO, "xls", form).bytes);
    expect(volta.campos.complemento).toBeNull();
  });

  it("inclui a imagem de localização no quadro da poligonal do .xls", () => {
    const form = formularioCompleto();
    // PNG 1x1 válido
    form.imagem = { tipo: "png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
    const r = gerarPlanilhaPci(MODELO, "xls", form);
    expect(r.avisos).toEqual([]);
    expect(lerPci(r.bytes).identificacao.proponente).toBe("MARIA DIGITADA");
    const imgs = imagensDaAba(PastaBiff8.abrir(r.bytes), "Proposta_Constr_Individual");
    const quadro = imgs.filter((i) => i.coluna1 >= 6 && i.linha1 >= 193 && i.linha2 - i.linha1 >= 5);
    expect(quadro).toHaveLength(1);
    expect(quadro[0].imagem.dados.length).toBeLessThan(200);
  });

  it("xlsb: só leitura, mensagem pede a versão .xls/.xlsm", () => {
    expect(() => gerarPlanilhaPci(new Uint8Array([0x50, 0x4b]), "xlsb", formularioPciVazio())).toThrow(/\.xls ou \.xlsm/);
  });
});

/** .xlsm sintético com a aba da proposta, uma fórmula e macros. */
function xlsmSintetico(): Uint8Array {
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`
    + `<row r="44"><c r="G44" s="3" t="s"><v>0</v></c><c r="Y44" s="3"/></row>`
    + `<row r="73"><c r="G73" s="5"><v>10</v></c><c r="AC73" s="5"><f>G73+U73</f><v>10</v></c></row>`
    + `<row r="140"><c r="AB140"><f>SUM(AB120:AB139)</f><v>0</v></c></row>`
    + `</sheetData></worksheet>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Proposta_Constr_Individual" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/sharedStrings.xml": strToU8(`<sst><si><t>ANTIGO &amp; CIA</t></si></sst>`),
    "xl/vbaProject.bin": new Uint8Array([1, 2, 3, 4, 5]),
  });
}

describe("Gerador de PCI — .xlsm (XML no zip)", () => {
  it("lê strings compartilhadas e grava todas as células, preservando macros e fórmulas", () => {
    const original = new PastaXlsx(unzipSync(xlsmSintetico()));
    expect(original.ler("Proposta_Constr_Individual", "G44")).toBe("ANTIGO & CIA");
    const form = formularioCompleto();
    form.campos.proponenteNome = "JOÃO <TESTE> & FILHOS";
    const r = gerarPlanilhaPci(xlsmSintetico(), "xlsm", form);
    expect(r.formato).toBe("xlsm");
    const zip = unzipSync(r.bytes);
    expect(Array.from(zip["xl/vbaProject.bin"])).toEqual([1, 2, 3, 4, 5]);
    expect(strFromU8(zip["xl/workbook.xml"])).toContain('fullCalcOnLoad="1"');
    const xml = strFromU8(zip["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain("<f>G73+U73</f>");
    expect(xml).toMatch(/<c r="G44" s="3" t="inlineStr">/);
    const rows = [...xml.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1]));
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
    const volta = lerFormularioPci(r.bytes);
    expect(volta.campos.proponenteNome).toBe("JOÃO <TESTE> & FILHOS");
    expect(volta.campos).toEqual({ ...form.campos, proponenteNome: "JOÃO <TESTE> & FILHOS", valorFinanciado: null });
    expect(volta.custos).toEqual(form.custos);
    expect(volta.cronograma).toEqual(form.cronograma);
  });

  it("não sobrescreve fórmula do modelo e avisa", () => {
    const sheetComFormula = xlsmSintetico();
    const zip = unzipSync(sheetComFormula);
    zip["xl/worksheets/sheet1.xml"] = strToU8(strFromU8(zip["xl/worksheets/sheet1.xml"]).replace(`<c r="Y44" s="3"/>`, `<c r="Y44"><f>A1</f><v>0</v></c>`));
    const r = gerarPlanilhaPci(zipSync(zip), "xlsm", formularioCompleto());
    expect(r.avisos.some((a) => a.includes("Y44"))).toBe(true);
  });
});

describe("Gerador de PCI — PDF", () => {
  it("gera PDF paginado com os dados", () => {
    const pdf = gerarPdfPci(formularioCompleto(), { obraTitulo: "Obra X", modeloVersao: 2, modeloArquivo: "pci.xls", geradoEm: new Date("2026-10-27T12:00:00Z"), autor: "Admin" });
    const texto = Buffer.from(pdf).toString("latin1");
    expect(texto.startsWith("%PDF")).toBe(true);
    expect(texto).toMatch(/\/Type \/Page\b/);
  });
});

describe("Gerador de PCI — pré-preenchimento e engenheiro", () => {
  const obra = { titulo: "Obra Y", endereco: "Rua A, 1", cidade: "Imperatriz", uf: "MA", area: 70, valorImovel: 200000, valorTerreno: 50000, valorFinanciado: 150000, inicio: "2026-01-10", termino: "2026-07-05" };
  it("usa cliente, obra e coordenadas sem inventar o que falta", () => {
    const f = preencherPciAutomatico({ obra, cliente: { nome: "Cliente", cpf: "123.456.789-09", email: null, telefone: "+55 (99) 98888-7777", endereco: null, bairro: "Centro" }, coordenadas: { lat: -5.5079, lng: -47.4777 }, pci: null });
    expect(f.campos).toMatchObject({ proponenteNome: "Cliente", proponenteCpf: "123.456.789-09", proponenteEmail: null, proponenteDdd: 99, proponenteTelefone: "988887777",
      endereco: "Rua A, 1", bairro: "Centro", municipio: "Imperatriz", uf: "MA", areaCoberta: 70, valorImovel: 200000, valorTerreno: 50000, valorFinanciado: 150000, prazoMeses: 6,
      latitude: `05° 30' 28.4" S`, longitude: `47° 28' 39.7" W`, rtpRegistro: null, rteRegistro: null });
  });
  it("a PCI vinculada tem prioridade; o cadastro só completa lacunas", () => {
    const pci = lerFormularioPci(MODELO);
    const f = preencherPciAutomatico({ obra, cliente: { nome: "Outro Nome", cpf: null, email: "x@y.z", telefone: null, endereco: null, bairro: null }, coordenadas: null, pci });
    expect(f.campos.proponenteNome).toBe("PROPONENTE DE TESTE");
    expect(f.campos.rtpRegistro).toBe("1000000001");
    expect(f.custos[0]).toBe(3940.68);
  });
  it("selecionar engenheiro traz nome e CREA do perfil; sem CREA fica vazio", () => {
    let f = formularioCompleto();
    f = aplicarEngenheiroPci(f, "rte", "7", { nome: "Eng. Ana", email: "ana@x.y", telefone: "(86) 3222-1111", crea: "998877", creaUf: "PI" });
    expect(f.rteEngenheiroId).toBe("7");
    expect(f.campos).toMatchObject({ rteNome: "Eng. Ana", rteRegistro: "998877", rteUf: "PI", rteDdd: 86, rteTelefone: "32221111", rteCpf: "555.666.777-88" });
    f = aplicarEngenheiroPci(f, "rtp", "8", { nome: "Eng. Sem Crea", email: null, telefone: null, crea: null, creaUf: null });
    expect(f.campos).toMatchObject({ rtpNome: "Eng. Sem Crea", rtpRegistro: null, rtpUf: null });
  });
  it("auxiliares", () => {
    expect(separarTelefone("99 98888-7777")).toEqual({ ddd: 99, numero: "988887777" });
    expect(prazoEmMeses("2026-01-10", "2026-03-10")).toBe(2);
    expect(prazoEmMeses(null, "2026-03-10")).toBeNull();
    expect(coordenadaDecimalParaPci(-5.488333333, "lat")).toBe(`05° 29' 18" S`);
    expect(coordenadaPciParaCelula(`05° 29' 18.4" S`, "lat")).toEqual({ numero: 52918.4, hemisferio: "S" });
    expect(coordenadaPciParaCelula("47 graus", "lng")).toBeNull();
    expect(formatoModeloPci("m.xls", new Uint8Array([0xd0, 0xcf]))).toBe("xls");
    expect(formatoModeloPci("m.xlsm", new Uint8Array([0x50, 0x4b]))).toBe("xlsm");
    expect(() => formatoModeloPci("m.xlsx", new Uint8Array([0x50, 0x4b]))).toThrow();
    expect(() => formatoModeloPci("m.xls", new Uint8Array([0x50, 0x4b]))).toThrow();
    expect(() => normalizarFormularioPci({ imagem: { tipo: "png", base64: "A".repeat(2_100_000) } })).toThrow(/1,5 MB/);
  });
});

