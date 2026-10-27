// Lote 02, correção 02 — Detalhes da Obra mostra a mesma galeria por medição do
// Editar Obra, com os mesmos arquivos (rota autenticada) e metadados, sem cópia.
// Gêmeo em Prospecta/server/obra-galeria-detalhes.test.ts.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const fotos = [
  { id: "f2", medicaoId: "m2", legenda: "Cobertura", tiradaEm: new Date("2026-10-10T12:00:00Z"), incluirNoRelatorio: true },
  { id: "f1", medicaoId: "m1", legenda: "Fundação", tiradaEm: new Date("2026-09-10T12:00:00Z"), incluirNoRelatorio: false },
  { id: "f0", medicaoId: null, legenda: null, tiradaEm: new Date("2026-08-10T12:00:00Z"), incluirNoRelatorio: true },
];
const medicoes = [
  { id: "m2", progresso: { toString: () => "30.5" }, criadoEm: new Date("2026-10-10T12:00:00Z") },
  { id: "m1", progresso: { toString: () => "10" }, criadoEm: new Date("2026-09-10T12:00:00Z") },
];
const findManyFotos = vi.fn<(args: unknown) => Promise<typeof fotos>>(async () => fotos);
vi.mock("@/lib/db", () => ({ prisma: {
  obraFoto: { findMany: (a: unknown) => findManyFotos(a) },
  obraProgressoHistorico: { findMany: async () => medicoes },
} }));

describe("galeria por medição em Detalhes da Obra", () => {
  it("carrega as fotos da obra pela rota autenticada, sem bytes, com as medições", async () => {
    const { carregarGaleriaObra } = await import("@/lib/obras/galeria-dados");
    const g = await carregarGaleriaObra("obra1");
    expect(findManyFotos).toHaveBeenCalledWith(expect.objectContaining({ where: { obraId: "obra1" } }));
    expect(JSON.stringify(findManyFotos.mock.calls[0][0])).not.toContain("arquivo");
    expect(g.fotos[0]).toEqual({ id: "f2", medicaoId: "m2", url: "/api/obras/fotos/f2", legenda: "Cobertura", tiradaEm: "2026-10-10T12:00:00.000Z", incluirNoRelatorio: true });
    expect(g.medicoes).toEqual([{ id: "m2", progresso: 30.5, criadoEm: "2026-10-10T12:00:00.000Z" }, { id: "m1", progresso: 10, criadoEm: "2026-09-10T12:00:00.000Z" }]);
  });

  it("o componente compartilhado mostra nº da medição, % na medição, % acumulado, quantidade e legendas", async () => {
    const { carregarGaleriaObra } = await import("@/lib/obras/galeria-dados");
    const { GaleriaMedicoes } = await import("@/components/obras/galeria-medicoes");
    const g = await carregarGaleriaObra("obra1");
    const html = renderToStaticMarkup(createElement(GaleriaMedicoes, { fotos: g.fotos, medicoes: g.medicoes, tema: "claro" }));
    expect(html).toContain("Medição 1 — 10% nesta medição");
    expect(html).toContain("Medição 2 — 20,5% nesta medição");
    expect(html).toContain("30,5% acumulado · Lote de 1 foto(s)");
    expect(html).toContain("Fundação");
    expect(html).toContain("Fotos anteriores — sem medição vinculada");
    expect(html).toContain('src="/api/obras/fotos/f1"');
  });
});
