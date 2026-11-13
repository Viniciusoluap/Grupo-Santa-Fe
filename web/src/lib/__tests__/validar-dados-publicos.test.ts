import { describe, expect, it } from "vitest";
import { validarDadosPublicos } from "@/lib/incorporacao/validar-dados-publicos";

// Mesmos limites do schema de salvarDadosPublicos da Prospecta (resultado do IBGE vindo do navegador).
const base = () => ({
  municipio: { id: 2111300, nome: "São Luís", uf: "MA" },
  indicadores: [{ chave: "populacao_estimada", indicador: "População", valor: 1094000, unidade: "Pessoas", municipio: "São Luís - MA",
    periodo: "2025", fonte: "IBGE", url: "https://servicodados.ibge.gov.br/api/v3/agregados/6579", consultadoEm: "2026-11-08T12:00:00.000Z" }],
  indisponiveis: [{ chave: "salario_medio", indicador: "Salário", motivo: "sem valor publicado" }],
  consultadoEm: "2026-11-08T12:00:00.000Z", fonteGeral: "IBGE",
});

describe("validarDadosPublicos", () => {
  it("aceita o resultado do IBGE e mantém os campos", () => {
    expect(validarDadosPublicos(base())).toEqual(base());
    expect(validarDadosPublicos({ ...base(), municipio: null }).municipio).toBeNull();
  });
  it("recusa fonte que não seja o IBGE, número não finito e listas grandes demais", () => {
    const b = base();
    expect(() => validarDadosPublicos({ ...b, indicadores: [{ ...b.indicadores[0], url: "https://outro.site/x" }] })).toThrow(/IBGE/);
    expect(() => validarDadosPublicos({ ...b, indicadores: [{ ...b.indicadores[0], valor: Infinity }] })).toThrow(/inválidos/);
    expect(() => validarDadosPublicos({ ...b, indicadores: Array(41).fill(b.indicadores[0]) })).toThrow(/inválidos/);
    expect(() => validarDadosPublicos(null)).toThrow(/inválidos/);
  });
});
