// Validacao pura do cadastro de corretor (Usuario + Corretor atomico). Extraida de
// src/lib/actions/corretores.ts para ser testavel sem banco.
export function validarNovoCorretor(input: {
  nome: string;
  email: string;
  creci: string;
  telefone: string;
  senha: string;
}): string | null {
  if (!input.nome || !input.email || !input.creci || !input.telefone) {
    return "Nome, CRECI, telefone e e-mail são obrigatórios";
  }
  if (input.senha.length < 6) {
    return "Senha de acesso é obrigatória (mín. 6 caracteres) - é o que o corretor usará para entrar no sistema";
  }
  return null;
}
