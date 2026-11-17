// Paridade 17/11, bloco 1 — EPIC-023 S-A da Prospecta: campos do corretor em "Usuários e acesso".
// Funções puras (sem banco), testáveis isoladamente.

export const OBSERVACOES_CORRETOR_MAX = 5000;

/** Observações do corretor: texto livre aparado; acima de 5000 caracteres é recusado (mesmo limite da Prospecta). */
export function lerObservacoesCorretor(valor: unknown): string {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (texto.length > OBSERVACOES_CORRETOR_MAX) throw new Error(`Observações com mais de ${OBSERVACOES_CORRETOR_MAX} caracteres.`);
  return texto;
}

/** Convite (e-mail de definição de senha): padrão é enviar; só "nao" desliga (caixa desmarcada na tela). */
export function lerConvite(valor: unknown): boolean {
  return valor !== "nao";
}
