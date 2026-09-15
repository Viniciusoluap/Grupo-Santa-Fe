// Funcao pura que decide se uma desativacao/exclusao de usuario deve ser bloqueada
// por deixar o sistema sem nenhum administrador ativo (lockout administrativo).
// Extraida de src/lib/actions/usuarios.ts para ser testavel sem banco.
export function deveBloquearDesativacaoUltimoAdmin(
  alvo: { papel: string; ativo: boolean } | null | undefined,
  adminsAtivos: number,
): boolean {
  if (!alvo || alvo.papel !== "admin" || !alvo.ativo) return false;
  return adminsAtivos <= 1;
}
