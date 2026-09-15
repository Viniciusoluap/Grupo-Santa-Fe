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

// Funcao pura que decide se um JWT ja emitido ainda e valido, comparando com o
// estado atual do usuario no banco. Extraida de auth.ts (callback jwt) para ser
// testavel sem depender do NextAuth. Estrategia JWT nao tem estado no servidor
// por padrao - sem essa checagem, um token emitido no login continuaria valido
// ate expirar mesmo apos a senha ser redefinida ou a conta ser desativada.
export function sessaoAindaValida(
  usuarioAtual: { ativo: boolean; sessionVersion: number } | null | undefined,
  sessionVersionDoToken: number | undefined,
): boolean {
  if (!usuarioAtual || !usuarioAtual.ativo) return false;
  return usuarioAtual.sessionVersion === sessionVersionDoToken;
}
