export const PROJECT_UPLOAD_LIMIT = 300 * 1024 * 1024;
export const PROJECT_CHUNK_SIZE = 1024 * 1024;
export type ProjectDocumentKind = "editable" | "pdf";
export type ProjectCheck = { id?: string; type?: string; text: string; done: boolean };
export function projectChecklist(types: string[], current: ProjectCheck[], labels: Record<string, string>): ProjectCheck[] {
  const selected = types.filter(t => t !== "projeto_completo");
  const result = current.map((c, i) => ({ ...c, id: c.id || c.type || `legacy-${i}` }));
  for (const type of selected) {
    const text = labels[type] || type;
    const found = result.find(c => c.type === type || c.id === type || c.text.toLocaleLowerCase("pt-BR") === text.toLocaleLowerCase("pt-BR"));
    if (found) { found.id = type; found.type = type; }
    else result.push({ id: type, type, text, done: false });
  }
  return result;
}
export function validateProjectUpload(name: string, size: number, kind: string) {
  if (!name.trim() || name.length > 255 || /[\/\x00-\x1f]/.test(name)) throw new Error("Nome de arquivo inválido.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > PROJECT_UPLOAD_LIMIT) throw new Error("Envie um arquivo de até 300 MB.");
  if (kind !== "editable" && kind !== "pdf") throw new Error("Escolha arquivo editável ou PDF.");
  if (kind === "pdf" && !/\.pdf$/i.test(name)) throw new Error("Nesta opção envie um arquivo PDF.");
}
