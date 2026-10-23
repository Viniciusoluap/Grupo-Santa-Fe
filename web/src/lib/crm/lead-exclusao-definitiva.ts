// Pedido de 23/10 (H3): exclusão definitiva de lead arquivado. Só é permitida
// quando o lead não tem nada que dependa dele; caso contrário o sistema avisa
// o que está vinculado em vez de apagar. Mesma regra na Prospecta (shared/lead-exclusao-definitiva.ts).
export const VINCULOS_LEAD = [
  ["obras", "obra", "obras"],
  ["financiamentos", "financiamento", "financiamentos"],
  ["regularizacoes", "regularização", "regularizações"],
  ["projetos", "projeto", "projetos"],
  ["avaliacoes", "avaliação", "avaliações"],
  ["contratos", "contrato", "contratos"],
  ["documentos", "documento", "documentos"],
  ["contas", "conta de acesso", "contas de acesso"],
] as const;

export type VinculoLead = (typeof VINCULOS_LEAD)[number][0];
export type VinculosLead = Record<VinculoLead, number>;

/** Lista legível dos vínculos ("1 obra e 2 documentos") ou null quando não há nenhum. */
export function resumoVinculosLead(v: VinculosLead): string | null {
  const partes = VINCULOS_LEAD.filter(([chave]) => v[chave] > 0)
    .map(([chave, um, varios]) => `${v[chave]} ${v[chave] === 1 ? um : varios}`);
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

export function mensagemBloqueioExclusao(v: VinculosLead): string | null {
  const resumo = resumoVinculosLead(v);
  return resumo
    ? `Este lead não pode ser excluído definitivamente porque possui ${resumo} vinculado(s). Desvincule ou exclua esses registros primeiro, ou mantenha o lead arquivado.`
    : null;
}
