/** Validação de configuração no servidor; ausência nunca vira zero ou tipo inventado. */
export function textoObrigatorio(form: FormData, campo: string): string {
  const valor = form.get(campo);
  if (typeof valor !== "string" || !valor.trim()) throw new Error(`Preencha ${campo}.`);
  return valor.trim();
}
export function opcaoObrigatoria(form: FormData, campo: string, opcoes: object): string {
  const valor = textoObrigatorio(form, campo);
  if (!Object.hasOwn(opcoes, valor)) throw new Error(`Valor inválido para ${campo}.`);
  return valor;
}
export function numeroObrigatorio(form: FormData, campo: string, inteiro = false): number {
  const raw = textoObrigatorio(form, campo);
  const valor = Number(raw);
  if (!Number.isFinite(valor) || valor < 0 || (inteiro && (!Number.isInteger(valor) || valor === 0))) throw new Error(`Valor inválido para ${campo}.`);
  return valor;
}
export function tiposObrigatorios(form: FormData, opcoes: object): string {
  const tipos = form.getAll("tipos");
  if (!tipos.length || tipos.some((t) => typeof t !== "string" || !Object.hasOwn(opcoes, t))) throw new Error("Selecione os tipos do projeto.");
  return JSON.stringify([...new Set(tipos)]);
}

export function exigirConfiguracaoParaStatus(registro: Record<string, unknown> | null, status: string, campos: string[], opcoes: object) {
  if (!Object.hasOwn(opcoes, status)) throw new Error("Status inválido.");
  if (!registro) throw new Error("Registro não encontrado.");
  if (status === "aguardando_configuracao" || status.startsWith("cancelad")) return;
  if (campos.some((campo) => registro[campo] == null || registro[campo] === "")) throw new Error("Conclua a configuração da operação antes de mudar o status.");
}
