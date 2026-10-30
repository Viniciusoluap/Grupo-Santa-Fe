import { describe, expect, it } from "vitest";
import { confirmacaoRestauracaoValida, lerSnapshot, planejarRestauracao, type ContextoRestauracao } from "@/lib/bpo-restauracao";

// Lote 4: regra pura do "Restaurar" exclusões em lote do BPO (mesmo arquivo nos dois repositórios).
const ctx = (over: Partial<ContextoRestauracao> = {}): ContextoRestauracao => ({
  idsExistentes: new Set(), clientesExistentes: new Set(["10"]),
  vinculoExiste: (_t, _c, id) => id === "obra-ok", unicosEmUso: { requestKey: new Set(["rk-usada"]) }, ...over,
});
const COLUNAS = ["id", "clienteId", "clienteNomeLivre", "tipo", "descricao", "valor", "vencimento", "categoriaOperacional", "vinculoOperacionalId", "vinculoOperacionalRotulo", "requestKey", "asaasPaymentId", "version"];

describe("restaurar exclusão em lote — regra pura", () => {
  it("confirmação forte", () => {
    expect(confirmacaoRestauracaoValida("RESTAURAR")).toBe(true);
    expect(confirmacaoRestauracaoValida("restaurar")).toBe(false);
    expect(confirmacaoRestauracaoValida(null)).toBe(false);
  });

  it("snapshot inválido dá erro claro", () => {
    expect(() => lerSnapshot("{")).toThrow(/corrompido/);
    expect(() => lerSnapshot("{}")).toThrow(/formato/);
    expect(lerSnapshot('[{"id":1},{"x":2},null]')).toEqual([{ id: 1 }]);
  });

  it("volta só colunas reais, converte datas, limpa vínculos que sumiram e não duplica", () => {
    const plano = planejarRestauracao([
      { id: 1, clienteId: 10, clienteNome: "Ana", tipo: "despesa", descricao: "OK", valor: "10.50", vencimento: "2026-10-10T12:00:00.000Z", baixas: 0, asaasPaymentId: "x", version: 2 },
      { id: 2, clienteId: 99, clienteNome: "Cliente Apagado", clienteNomeLivre: null, tipo: "despesa", descricao: "Sem cliente", valor: 1 },
      { id: 3, tipo: "despesa", descricao: "Obra apagada", valor: 1, categoriaOperacional: "obras", vinculoOperacionalId: "obra-x", vinculoOperacionalRotulo: "Obra X" },
      { id: 4, tipo: "despesa", descricao: "Chave", valor: 1, requestKey: "rk-usada" },
      { id: 5, tipo: "despesa", descricao: "Já existe", valor: 1 },
      { id: 1, tipo: "despesa", descricao: "Repetido no backup", valor: 1 },
    ], ctx({ idsExistentes: new Set(["5"]) }), COLUNAS, ["vencimento"]);
    expect(plano).toMatchObject({ restaurar: 4, jaExistem: 2, comAviso: 3 });
    const [ok, semCliente, obra, chave] = plano.itens;
    expect(ok.avisos).toEqual([]);
    expect(ok.dados).toEqual({ id: 1, clienteId: 10, tipo: "despesa", descricao: "OK", valor: "10.50", vencimento: new Date("2026-10-10T12:00:00.000Z"), asaasPaymentId: null, version: 2 });
    expect(semCliente.dados).toMatchObject({ clienteId: null, clienteNomeLivre: "Cliente Apagado" });
    expect(semCliente.avisos[0]).toMatch(/Cliente Apagado.*não existe mais/);
    expect(obra.dados).toMatchObject({ vinculoOperacionalId: null, vinculoOperacionalRotulo: null, categoriaOperacional: "obras" });
    expect(obra.avisos[0]).toMatch(/Obra X.*não existe mais/);
    expect(chave.dados.requestKey).toBeNull();
    expect(plano.itens[4]).toMatchObject({ acao: "ja_existe", dados: {} });
    expect(plano.itens[5]).toMatchObject({ acao: "ja_existe" });
  });

  it("vínculo que ainda existe é mantido", () => {
    const plano = planejarRestauracao([{ id: "a", tipo: "despesa", descricao: "x", valor: 1, vinculoOperacionalId: "obra-ok", categoriaOperacional: "obras" }], ctx(), COLUNAS, []);
    expect(plano.itens[0]).toMatchObject({ acao: "restaurar", avisos: [], dados: { vinculoOperacionalId: "obra-ok" } });
  });
});
