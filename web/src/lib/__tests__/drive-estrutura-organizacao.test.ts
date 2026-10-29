import { describe, expect, it } from "vitest";
import {
  caminhoEquipe, caminhoFotosObra, caminhoGeradorPci, caminhoModeloPci, caminhoOrcamentoEstudo, caminhoWhatsappCliente, caminhoWhatsappSemCliente,
  entidadeDaChave, nomeDocumentoEquipe, nomeFotoObra, nomeMidiaWhatsapp, nomeModeloPci, nomePciGerada, nomePlanilhaOrcamento,
} from "@/lib/drive-estrutura";

// Pedido de 29/10 (SPEC-DRIVE-ORGANIZACAO.md): mesmos nomes e etiquetas na Prospecta.
const dia = new Date("2026-10-29T15:00:00Z");

describe("Drive: caminhos dos novos tipos de arquivo", () => {
  it("equipe: Equipe/<Nome (nº)>/<Categoria>", () => {
    expect(caminhoEquipe({ id: 7, numero: 7, nome: "João Engenheiro" }, "anuidade_crea")).toEqual([
      { chave: "equipe", nome: "Equipe" },
      { chave: "equipe:7", nome: "João Engenheiro (nº 7)" },
      { chave: "equipe:7:anuidade_crea", nome: "Anuidade CREA" },
    ]);
    expect(caminhoEquipe({ id: 7, numero: 7, nome: "J" }, "documento_pessoal").at(-1)!.nome).toBe("Documento pessoal");
    expect(caminhoEquipe({ id: 7, numero: 7, nome: "J" }, "carteirinha_crea").at(-1)!.nome).toBe("Carteirinha CREA");
    expect(caminhoEquipe({ id: 7, numero: 7, nome: "J" }, "desconhecida").at(-1)).toEqual({ chave: "equipe:7:outros", nome: "Outros" });
  });

  it("modelos: Modelos/PCI CAIXA", () => {
    expect(caminhoModeloPci()).toEqual([{ chave: "modelos", nome: "Modelos" }, { chave: "modelos:pci", nome: "PCI CAIXA" }]);
  });

  it("fotos de obra: Obras/<Obra (nº)>/Fotos/<Medição 01 — data | Sem medição>", () => {
    expect(caminhoFotosObra({ id: 5, numero: 5, nome: "Casa Ana" }, { id: "m1", ordem: 1, data: dia })).toEqual([
      { chave: "obras", nome: "Obras" },
      { chave: "obra:5", nome: "Casa Ana (nº 5)" },
      { chave: "obra:5:fotos", nome: "Fotos" },
      { chave: "obra:5:fotos:medicao:m1", nome: "Medição 01 — 29-10-2026" },
    ]);
    expect(caminhoFotosObra({ id: 5, numero: 5, nome: "Casa Ana" }, null).at(-1)).toEqual({ chave: "obra:5:fotos:medicao:sem", nome: "Sem medição" });
    expect(nomeFotoObra(3, dia, "image/jpeg")).toBe("Foto 03 — 29-10-2026.jpg");
  });

  it("gerador de PCI: Obras/<Obra (nº)>/Gerador de PCI/PCI gerada — data.ext", () => {
    expect(caminhoGeradorPci({ id: 5, numero: 5, nome: "Casa Ana" }).at(-1)).toEqual({ chave: "obra:5:gerador-pci", nome: "Gerador de PCI" });
    expect(nomePciGerada(dia, "xls")).toBe("PCI gerada — 29-10-2026.xls");
    expect(nomePciGerada(dia, "xlsm")).toBe("PCI gerada — 29-10-2026.xlsm");
    expect(nomePciGerada(dia, "pdf")).toBe("PCI gerada — 29-10-2026.pdf");
    expect(nomeModeloPci(1, dia, "PCI_CAIXA.xls", "application/vnd.ms-excel")).toBe("PCI modelo v01 — 29-10-2026.xls");
    expect(nomeModeloPci(12, dia, null, "application/vnd.ms-excel.sheet.macroEnabled.12")).toBe("PCI modelo v12 — 29-10-2026.xlsm");
  });

  it("WhatsApp: com cliente em Atendimento/WhatsApp; sem cliente por número", () => {
    expect(caminhoWhatsappCliente({ id: 9, numero: 9, nome: "Maria" }).map((p) => p.chave))
      .toEqual(["clientes", "cliente:9", "cliente:9:atendimento", "cliente:9:atendimento:whatsapp"]);
    expect(caminhoWhatsappCliente({ id: 9, numero: 9, nome: "Maria" }).at(-1)!.nome).toBe("WhatsApp");
    expect(caminhoWhatsappSemCliente("55 (94) 99999-0000")).toEqual([
      { chave: "whatsapp-sem-cliente", nome: "WhatsApp sem cliente" },
      { chave: "whatsapp-sem-cliente:5594999990000", nome: "+5594999990000" },
    ]);
    expect(nomeMidiaWhatsapp(dia, "foto.JPG", "image/jpeg")).toBe("Mídia — 29-10-2026.jpg");
    expect(nomeMidiaWhatsapp(dia, null, "application/pdf; charset=binary")).toBe("Mídia — 29-10-2026.pdf");
  });

  it("orçamento: Incorporação/<Estudo (nº)>/Orçamento/Planilha importada — data.xlsx", () => {
    expect(caminhoOrcamentoEstudo({ id: 3, numero: 3, nome: "Jardim X" }).at(-1)).toEqual({ chave: "incorporacao:3:orcamento", nome: "Orçamento" });
    expect(nomePlanilhaOrcamento(dia, "orcamento.xlsx", "")).toBe("Planilha importada — 29-10-2026.xlsx");
  });

  it("documento do usuário: Rótulo da categoria — data.ext", () => {
    expect(nomeDocumentoEquipe("anuidade_crea", dia, "boleto.pdf", "application/pdf")).toBe("Anuidade CREA — 29-10-2026.pdf");
    expect(nomeDocumentoEquipe("x", dia, null, "image/png")).toBe("Outros — 29-10-2026.png");
  });

  it("órfãs: só a pasta da entidade (prefixo:id) conta; subpastas e etiquetas soltas não", () => {
    expect(entidadeDaChave("cliente:abc")).toEqual({ prefixo: "cliente", id: "abc" });
    expect(entidadeDaChave("obra:x1")).toEqual({ prefixo: "obra", id: "x1" });
    expect(entidadeDaChave("equipe:u1")).toEqual({ prefixo: "equipe", id: "u1" });
    expect(entidadeDaChave("cliente:abc:juridico")).toBeNull();
    expect(entidadeDaChave("clientes")).toBeNull();
    expect(entidadeDaChave("cliente-1-portfolio")).toBeNull();
    expect(entidadeDaChave(undefined)).toBeNull();
  });
});
