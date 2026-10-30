// Lote 03 (29/10/2026) — regras puras da Central WhatsApp (gêmeo do bloco "regras puras" de
// Prospecta/server/whatsapp-lote3.test.ts).
import { describe, expect, it } from "vitest";
import {
  alternarItem, alternarTodosVisiveis, candidatosVinculo, chaveTelefone, inicioPeriodo, podarSelecao, resolverLeadConversa, taxaLeitura, textoConfirmacaoExclusao,
} from "@/lib/whatsapp/conversas";
import { mesmoTelefone } from "@/lib/evolution";

describe("WhatsApp › regras do lote 03", () => {
  it("chave do telefone ignora 55, máscara e 9º dígito (e mesmoTelefone usa a mesma regra)", () => {
    expect(chaveTelefone("+55 (99) 98139-2210")).toBe(chaveTelefone("9981392210"));
    expect(mesmoTelefone("+55 (99) 98139-2210", "559981392210")).toBe(true);
    expect(chaveTelefone("123")).toBe("123");
  });
  it("vínculo manual vence a inferência pelo telefone, que vence o lead gravado", () => {
    expect(resolverLeadConversa({ manual: "b", porTelefone: "a", gravado: "c" })).toEqual({ leadId: "b", origem: "manual" });
    expect(resolverLeadConversa({ porTelefone: "a", gravado: "c" })).toEqual({ leadId: "a", origem: "telefone" });
    expect(resolverLeadConversa({ gravado: "c" })).toEqual({ leadId: "c", origem: "mensagem" });
    expect(resolverLeadConversa({})).toEqual({ leadId: null, origem: null });
  });
  it("seleção: alternar, selecionar todos os visíveis (e desmarcar) e podar removidos", () => {
    expect(alternarItem(["a"], "b")).toEqual(["a", "b"]);
    expect(alternarItem(["a", "b"], "a")).toEqual(["b"]);
    expect(alternarTodosVisiveis(["x"], ["a", "b"])).toEqual(["x", "a", "b"]);
    expect(alternarTodosVisiveis(["x", "a", "b"], ["a", "b"])).toEqual(["x"]);
    const sel = ["1", "2"];
    expect(podarSelecao(sel, ["1", "2", "3"])).toBe(sel);
    expect(podarSelecao(["1", "2", "3"], ["1", "3"])).toEqual(["1", "3"]);
  });
  it("busca de candidatos por nome sem acento, telefone e CPF; mesmo telefone primeiro", () => {
    const lista = [
      { id: "1", nome: "José André", telefone: "(99) 98139-2210", cpf: "111.222.333-44" },
      { id: "2", nome: "Maria", telefone: "11 90000-0000", cpf: null },
      { id: "3", nome: "Andressa", telefone: "9981392210", cpf: null },
    ];
    expect(candidatosVinculo(lista, "", "5599981392210").map((l) => l.id)).toEqual(["3", "1"]);
    expect(candidatosVinculo(lista, "andre", null).map((l) => l.id)).toEqual(["3", "1"]);
    expect(candidatosVinculo(lista, "222333", null).map((l) => l.id)).toEqual(["1"]);
    expect(candidatosVinculo(lista, "(11) 90000-0000", null).map((l) => l.id)).toEqual(["2"]);
  });
  it("período do dashboard, taxa e texto da confirmação", () => {
    const agora = new Date("2026-10-29T12:00:00Z");
    expect(inicioPeriodo("7", agora)?.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(inicioPeriodo("tudo", agora)).toBeNull();
    expect(taxaLeitura(0, 0)).toBe(0);
    expect(taxaLeitura(150, 50)).toBe(33);
    expect(textoConfirmacaoExclusao(2, 5)).toMatch(/2 conversas \(5 mensagens\).*continuam no celular/);
  });
});
