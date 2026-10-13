// Erros lançados dentro de Server Actions chegam ao navegador, em produção, como
// uma mensagem genérica em inglês ("An error occurred in the Server Components
// render..."). As ações de incorporação devolvem o erro como dado e a tela o
// transforma de volta em erro com a mensagem original em português.

export type ErroAcao = { erroAcao: string };

/** No servidor: executa a ação e devolve a mensagem de erro em vez de lançá-la. */
export async function capturarErroAcao<T>(fn: () => Promise<T>): Promise<T | ErroAcao> {
  try {
    return await fn();
  } catch (erro) {
    // redirect()/notFound() do Next carregam `digest` e precisam continuar sendo lançados.
    if (erro && typeof erro === "object" && "digest" in erro) throw erro;
    return { erroAcao: erro instanceof Error && erro.message ? erro.message : "Operação falhou." };
  }
}

/** No navegador: recupera o resultado ou lança o erro com a mensagem original. */
export function exigirResultado<T>(resultado: T | ErroAcao): T {
  if (resultado && typeof resultado === "object" && "erroAcao" in resultado) throw new Error(resultado.erroAcao);
  return resultado as T;
}
