// Responsável pelo lead = usuário real do sistema (EPIC-007 S-08). Nunca nomes
// fixos no código: a lista vem de `usuarios`, filtrada por estas regras.

/**
 * Item 04: responsável operacional do CRM = Admin ou Colaborador ativo (ou ninguém).
 * Corretor não entra aqui: ele aparece só no campo separado "Corretor vinculado".
 */
export const PAPEIS_RESPONSAVEL = ["admin", "colaborador"] as const;

const ROTULO_PAPEL: Record<string, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
  corretor: "Corretor",
};

export function podeSerResponsavel(usuario: { papel: string; ativo: boolean } | null | undefined): boolean {
  if (!usuario || !usuario.ativo) return false;
  return (PAPEIS_RESPONSAVEL as readonly string[]).includes(usuario.papel);
}

export function rotuloResponsavel(usuario: { nome: string; papel: string }): string {
  const papel = ROTULO_PAPEL[usuario.papel];
  return papel ? `${usuario.nome} (${papel})` : usuario.nome;
}
