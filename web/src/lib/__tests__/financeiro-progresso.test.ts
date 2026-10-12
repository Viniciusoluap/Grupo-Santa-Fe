// Teste E e regras do progresso por incidência (EPIC-020, Lote 4, item 27).
// Mesmo conteúdo em Prospecta/server/financeiro-progresso.test.ts.
import { describe, expect, it } from "vitest";
import {
  SERVICOS_PROGRESSO,
  calcularProgresso,
  formatarPercentual,
  itensProgressoIniciais,
  mesclarComPadrao,
} from "@/lib/financeiro/progresso";

const comExecucao = (execucoes: Record<string, string>) =>
  itensProgressoIniciais().map((i) => ({ ...i, execucao: execucoes[i.chave] ?? "0" }));

describe("Teste E — progresso por incidência", () => {
  it("28,196% exibido como 28,20%", () => {
    const r = calcularProgresso(
      comExecucao({
        preliminares: "100",
        infraestrutura: "100",
        supraestrutura: "50",
        impermeabilizacoes: "50",
        eletricas: "20",
        hidraulicas: "20",
        esgoto: "50",
        outros: "40",
      })
    );
    expect(r.erros).toEqual([]);
    expect(r.progresso).toBeCloseTo(28.196, 6);
    expect(formatarPercentual(r.progresso)).toBe("28,20%");
    expect(r.itens.find((i) => i.chave === "supraestrutura")!.execucaoObra).toBe(6.25);
    expect(r.itens.find((i) => i.chave === "outros")!.execucaoObra).toBe(3.996);
  });
});

describe("incidências iniciais", () => {
  it("são 20 serviços e somam 100%", () => {
    expect(SERVICOS_PROGRESSO).toHaveLength(20);
    const r = calcularProgresso(itensProgressoIniciais());
    expect(r.somaIncidencia).toBe(100);
    expect(r.distribuicaoCompleta).toBe(true);
    expect(r.avisos).toEqual([]);
    expect(r.progresso).toBe(0);
  });
  it("obra 100% executada = 100%", () => {
    const r = calcularProgresso(itensProgressoIniciais().map((i) => ({ ...i, execucao: "100" })));
    expect(r.progresso).toBe(100);
    expect(formatarPercentual(r.progresso)).toBe("100,00%");
  });
});

describe("validações", () => {
  it("incidência negativa é erro", () => {
    const itens = itensProgressoIniciais().map((i) => (i.chave === "vidros" ? { ...i, incidencia: "-1" } : i));
    expect(calcularProgresso(itens).erros.some((e) => e.includes("negativo"))).toBe(true);
  });
  it("soma acima de 100% é erro", () => {
    const itens = itensProgressoIniciais().map((i) => (i.chave === "vidros" ? { ...i, incidencia: "1" } : i));
    const r = calcularProgresso(itens);
    expect(r.somaIncidencia).toBe(101);
    expect(r.erros.some((e) => e.includes("passa de 100%"))).toBe(true);
  });
  it("soma abaixo de 100% sinaliza distribuição incompleta (sem bloquear)", () => {
    const itens = itensProgressoIniciais().map((i) => (i.chave === "outros" ? { ...i, incidencia: "0" } : i));
    const r = calcularProgresso(itens);
    expect(r.erros).toEqual([]);
    expect(r.distribuicaoCompleta).toBe(false);
    expect(r.avisos[0]).toContain("faltam 9,99%");
  });
  it("execução acima de 100% é erro", () => {
    expect(calcularProgresso(comExecucao({ pisos: "100.5" })).erros.length).toBe(1);
  });
  it("mais de 4 casas decimais é erro", () => {
    expect(calcularProgresso(comExecucao({ pisos: "10.12345" })).erros[0]).toContain("casas decimais");
  });
  it("serviço desconhecido, repetido ou ausente é erro", () => {
    const base = itensProgressoIniciais();
    expect(calcularProgresso([...base, { chave: "xyz", incidencia: "0", execucao: "0" }]).erros).toContain("Serviço desconhecido: xyz");
    expect(calcularProgresso([...base, base[0]]).erros).toContain("Serviço repetido: preliminares");
    expect(calcularProgresso(base.slice(1)).erros[0]).toContain("serviço ausente");
  });
  it("mesclarComPadrao completa os serviços que faltam", () => {
    const m = mesclarComPadrao([{ chave: "pisos", incidencia: "8.5", execucao: "30" }]);
    expect(m).toHaveLength(20);
    expect(m.find((i) => i.chave === "pisos")!.execucao).toBe("30");
  });
});
