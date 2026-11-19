// Paridade 17/11 (bloco 2) — cópia de Prospecta `client/src/components/incorporacao/estudo/compat/fila-salvamento.ts`
// (93edc7c, salvamento automático da Incorporação): fila por formulário; a próxima edição espera a resposta anterior.
// Correção da revisão do PR #263 (19/11): `registrado === false` marca um formulário que abriu com os padrões, sem nada
// gravado no banco (ex.: Viabilidade sem premissas). O conteúdo inicial serve de "anterior", mas não conta como gravado:
// `forcar` (botão Salvar) grava mesmo sem alteração; o salvamento automático continua gravando só depois de uma mudança.
export interface FilaSalvamento<T> {
  atual: string | null;
  gravado: string | null;
  gravar: (dados: T, anterior: T) => Promise<unknown>;
  envio: Promise<boolean> | null;
  /** `false` = nada gravado ainda no banco; ausente/`true` = o conteúdo inicial já é o gravado. */
  registrado?: boolean;
}

function temAlteracao<T>(fila: FilaSalvamento<T>) {
  return fila.atual !== null && fila.gravado !== null && fila.atual !== fila.gravado;
}

export function salvarFila<T>(
  fila: FilaSalvamento<T>,
  confirmar: (snapshot: string) => void,
  falhar: (snapshot: string, erro: unknown) => void,
  iniciar: () => void,
  concluir: () => void,
  forcar = false,
): Promise<boolean> {
  if (fila.envio) return fila.envio;
  let primeiraGravacao = forcar && fila.registrado === false && fila.atual !== null && fila.gravado !== null;
  if (!primeiraGravacao && !temAlteracao(fila)) return Promise.resolve(true);
  iniciar();
  fila.envio = Promise.resolve().then(async () => {
    try {
      // A última edição espera a resposta anterior, inclusive ao trocar de aba.
      while (primeiraGravacao || temAlteracao(fila)) {
        primeiraGravacao = false;
        const snapshot = fila.atual as string;
        try {
          await fila.gravar(JSON.parse(snapshot) as T, JSON.parse(fila.gravado as string) as T);
        } catch (erro) {
          falhar(snapshot, erro);
          return false;
        }
        fila.gravado = snapshot;
        fila.registrado = true;
        confirmar(snapshot);
      }
      return true;
    } finally {
      fila.envio = null;
      concluir();
    }
  });
  return fila.envio;
}
