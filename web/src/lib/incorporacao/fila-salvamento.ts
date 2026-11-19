// Paridade 17/11 (bloco 2) — cópia de Prospecta `client/src/components/incorporacao/estudo/compat/fila-salvamento.ts`
// (93edc7c, salvamento automático da Incorporação): fila por formulário; a próxima edição espera a resposta anterior.
export interface FilaSalvamento<T> {
  atual: string | null;
  gravado: string | null;
  gravar: (dados: T, anterior: T) => Promise<unknown>;
  envio: Promise<boolean> | null;
}

export function salvarFila<T>(
  fila: FilaSalvamento<T>,
  confirmar: (snapshot: string) => void,
  falhar: (snapshot: string, erro: unknown) => void,
  iniciar: () => void,
  concluir: () => void,
): Promise<boolean> {
  if (fila.envio) return fila.envio;
  if (fila.atual === null || fila.gravado === null || fila.atual === fila.gravado) return Promise.resolve(true);
  iniciar();
  fila.envio = Promise.resolve().then(async () => {
    try {
      // A última edição espera a resposta anterior, inclusive ao trocar de aba.
      while (fila.atual !== null && fila.gravado !== null && fila.atual !== fila.gravado) {
        const snapshot = fila.atual;
        try {
          await fila.gravar(JSON.parse(snapshot) as T, JSON.parse(fila.gravado) as T);
        } catch (erro) {
          falhar(snapshot, erro);
          return false;
        }
        fila.gravado = snapshot;
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
