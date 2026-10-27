/** Planeja importação CRM -> BPO por ID, ignorando leads já vinculados. */
export function planejarImportacaoClientesBpo<T extends { id: string }>(
  leads: readonly T[],
  leadIdsJaImportados: readonly (string | null)[],
) {
  const existentes = new Set(leadIdsJaImportados.filter((id): id is string => Boolean(id)));
  const faltantes = leads.filter((lead) => !existentes.has(lead.id));
  return {
    faltantes,
    jaImportados: leads.length - faltantes.length,
    encontrados: leads.length,
  };
}
