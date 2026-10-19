import { describe, expect, it } from "vitest";
import { agruparFotos } from "@/lib/obras/galeria-medicoes";
describe("galeria por medição", () => {
 it("preserva numeração de medições sem fotos, ordena e calcula avanço", () => {
   const { grupos, antigas } = agruparFotos([
     { id: 1, medicaoId: 3, url: "/foto/1", legenda: "Laje" },
     { id: 2, medicaoId: 1, url: "/foto/2", legenda: null },
     { id: 3, medicaoId: 3, url: "/foto/3", legenda: null },
     { id: 4, medicaoId: null, url: "/foto/4", legenda: "Legado" },
   ], [
     { id: 3, progresso: 45, criadoEm: "2026-10-19" },
     { id: 2, progresso: 30, criadoEm: "2026-10-18" },
     { id: 1, progresso: 20, criadoEm: "2026-10-18" },
   ]);
   expect(grupos.map(g => [g.titulo, g.progresso, g.avancou, g.fotos.length])).toEqual([["Medição 1",20,20,1],["Medição 3",45,15,2]]);
   expect(antigas.map(f => f.id)).toEqual([4]);
 });
 it("exibe fotos de medição excluída como anteriores sem atribuir a outra", () => {
   const r = agruparFotos([{ id: "a", medicaoId: "excluida", url: "/a", legenda: null }], []);
   expect(r.grupos).toEqual([]); expect(r.antigas).toHaveLength(1);
 });
});
