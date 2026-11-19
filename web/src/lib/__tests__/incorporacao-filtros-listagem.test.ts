// Paridade 17/11 (bloco 2) — porte de Prospecta `server/incorporacao-filtros-listagem.test.ts` (EPIC-024 S-07).
// Diferença de stack: campos do Santa Fé (nome/status/tipoIncorporacao), situações em português e "pendente".
// O Santa Fé ainda tem "residencial" como tipo atual (a retirada da Prospecta, 355f3aa, não faz parte deste bloco).
import { describe, expect, it } from "vitest";
import { FILTROS_INCORPORACAO_VAZIOS, filtrarEstudosIncorporacao, filtrosIncorporacaoAtivos } from "@/lib/incorporacao/filtro-listagem";

const estudos = [
  { id: 1, nome: "Loteamento Jardim das Palmeiras", status: "em_estudo", tipoIncorporacao: "loteamento" },
  { id: 2, nome: "Residencial São José", status: "em_andamento", tipoIncorporacao: "vertical" },
  { id: 3, nome: "Desmembramento Rua Ceará", status: "em_estudo", tipoIncorporacao: "desmembramento_simples" },
  { id: 4, nome: "Condomínio Antigo", status: "concluido", tipoIncorporacao: "residencial" },
  { id: 5, nome: "Gleba sem tipo", status: "em_estudo", tipoIncorporacao: null },
  { id: 6, nome: null, status: "inviavel", tipoIncorporacao: null },
  { id: 7, nome: "Estudo legado", status: "rascunho", tipoIncorporacao: null },
];
const ids = (r: { id: number }[]) => r.map((e) => e.id);
const f = (p: Partial<typeof FILTROS_INCORPORACAO_VAZIOS>) => ({ ...FILTROS_INCORPORACAO_VAZIOS, ...p });

describe("filtrarEstudosIncorporacao", () => {
  it("sem filtro devolve tudo, inclusive sem tipo e situação pendente", () => {
    expect(ids(filtrarEstudosIncorporacao(estudos, FILTROS_INCORPORACAO_VAZIOS))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(filtrosIncorporacaoAtivos(FILTROS_INCORPORACAO_VAZIOS)).toBe(false);
  });

  it("nome ignora maiúsculas e acentos, nos dois sentidos", () => {
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ nome: "sao jose" })))).toEqual([2]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ nome: "CEARÁ" })))).toEqual([3]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ nome: "condominio" })))).toEqual([4]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ nome: "  palmeiras " })))).toEqual([1]);
    expect(filtrosIncorporacaoAtivos(f({ nome: "x" }))).toBe(true);
  });

  it("tipo filtra só o tipo escolhido; sem tipo fica fora", () => {
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ tipo: "vertical" })))).toEqual([2]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ tipo: "loteamento" })))).toEqual([1]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ tipo: "desmembramento_simples" })))).toEqual([3]);
  });

  it("os três filtros combinam; 'pendente' = situação fora da lista oficial", () => {
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ status: "em_estudo", tipo: "loteamento", nome: "jardim" })))).toEqual([1]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ status: "em_andamento", tipo: "loteamento" })))).toEqual([]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ status: "em_estudo", nome: "gleba" })))).toEqual([5]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ status: "inviavel" })))).toEqual([6]);
    expect(ids(filtrarEstudosIncorporacao(estudos, f({ status: "pendente" })))).toEqual([7]);
  });
});
