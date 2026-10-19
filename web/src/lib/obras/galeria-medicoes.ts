export type FotoGaleria = { id: string | number; medicaoId: string | number | null; url: string; legenda: string | null };
export type MedicaoGaleria = { id: string | number; progresso: number; criadoEm: string | Date };
/** Numeração considera todas as medições, inclusive aquelas ainda sem fotos. */
export function agruparFotos(fotos: FotoGaleria[], medicoes: MedicaoGaleria[]) {
  const ordenadas = [...medicoes].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime() || (typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : String(a.id).localeCompare(String(b.id))));
  const porMedicao = new Map<string | number | null, FotoGaleria[]>();
  for (const foto of fotos) { const grupo = porMedicao.get(foto.medicaoId) ?? []; grupo.push(foto); porMedicao.set(foto.medicaoId, grupo); }
  const grupos = ordenadas.map((m, i) => ({ id: m.id, titulo: `Medição ${i + 1}`, progresso: m.progresso,
    avancou: Math.max(0, m.progresso - (ordenadas[i - 1]?.progresso ?? 0)), fotos: porMedicao.get(m.id) ?? [] }));
  const conhecidas = new Set(ordenadas.map(m => m.id));
  const antigas = fotos.filter(f => f.medicaoId === null || !conhecidas.has(f.medicaoId));
  return { grupos: grupos.filter(g => g.fotos.length > 0), antigas };
}
