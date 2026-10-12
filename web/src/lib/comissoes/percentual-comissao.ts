// EPIC-020 Lote 3 (item 32): percentual de comissão digitado (vírgula ou ponto).
// Vazio = sem regra cadastrada (nunca vira 0%). Até 4 casas, entre 0 e 100.
export function lerPercentualComissao(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim().replace(",", ".");
  if (texto === "") return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(texto) || Number(texto) > 100)
    throw new Error("Percentual de comissão inválido (0 a 100, até 4 casas decimais).");
  return texto;
}
