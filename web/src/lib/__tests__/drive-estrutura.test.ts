import { describe, expect, it } from "vitest";
import {
  areaDoServico, caminhoCliente, caminhoEstudo, dataArquivo, extensaoArquivo, limparNome, nomeArquivo, nomeComNumero, pastaLegada,
} from "@/lib/drive-estrutura";

// Pedido 15/10: pastas do Google Drive com nomes legíveis, iguais nos dois sistemas.
describe("estrutura de pastas do Drive", () => {
  it("cliente: Clientes/<Nome (nº id)>/<Área>", () => {
    expect(caminhoCliente({ id: 19, numero: 19, nome: "Maria da Silva" }, "atendimento")).toEqual([
      { chave: "clientes", nome: "Clientes" },
      { chave: "cliente:19", nome: "Maria da Silva (nº 19)" },
      { chave: "cliente:19:atendimento", nome: "Atendimento" },
    ]);
  });

  it("área pelo tipo de serviço do CRM; sem serviço fica em Atendimento", () => {
    expect(areaDoServico(null)).toBe("atendimento");
    expect(areaDoServico("financiamento_habitacional")).toBe("financiamento");
    expect(areaDoServico("consorcio")).toBe("financiamento");
    expect(areaDoServico("despachante")).toBe("regularizacao");
    expect(areaDoServico("juridico")).toBe("juridico");
    expect(areaDoServico("obra_cliente")).toBe("obras");
    expect(areaDoServico("bpo_financeiro")).toBe("outros");
  });

  it("estudo: Incorporação/<Estudo (nº id)>/<Etapa>", () => {
    expect(caminhoEstudo({ id: 3, numero: 3, nome: "Loteamento Jardim X" }, { chave: "registro", nome: "Registro do loteamento" }).map((p) => p.nome))
      .toEqual(["Incorporação", "Loteamento Jardim X (nº 3)", "Registro do loteamento"]);
  });

  it("nome do arquivo: rótulo — data de Brasília + extensão", () => {
    // 02:30 UTC de 16/10 ainda é 15/10 em Brasília.
    expect(dataArquivo(new Date("2026-10-16T02:30:00Z"))).toBe("15-10-2026");
    expect(nomeArquivo("RG", new Date("2026-10-15T15:00:00Z"), "IMG_0431.JPEG", "image/jpeg")).toBe("RG — 15-10-2026.jpeg");
    expect(nomeArquivo("Contrato CT-1", new Date("2026-10-15T15:00:00Z"), null, "application/pdf")).toBe("Contrato CT-1 — 15-10-2026.pdf");
    expect(extensaoArquivo("sem-extensao", "image/png")).toBe(".png");
  });

  it("nomes sem barras nem caracteres de controle; vazio vira 'Sem nome'", () => {
    expect(limparNome("  Ana / José\\Lima\n ")).toBe("Ana José Lima");
    expect(nomeComNumero("   ", 7)).toBe("Sem nome (nº 7)");
  });

  it("pasta antiga: sem etiqueta e com nome do formato antigo; pasta do dono nunca", () => {
    expect(pastaLegada({ name: "cliente-19" })).toBe(true);
    expect(pastaLegada({ name: "incorporacao-3" })).toBe(true);
    expect(pastaLegada({ name: "incorporacao-ckx9a1b2c3" })).toBe(true);
    expect(pastaLegada({ name: "Minha pasta" })).toBe(false);
    expect(pastaLegada({ name: "cliente-19", appProperties: { pastaSistema: "cliente:19" } })).toBe(false);
  });
});
