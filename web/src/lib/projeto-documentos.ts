export const PROJECT_UPLOAD_LIMIT = 300 * 1024 * 1024;
export const PROJECT_CHUNK_SIZE = 1024 * 1024;
export type ProjectDocumentKind = "editable" | "pdf";
export type ProjectCheck = { id?: string; type?: string; text: string; done: boolean; pdfDone?: boolean; editableDone?: boolean };
export type ProjectDocumentPresence = { itemId: string; kind: ProjectDocumentKind };
export function projectChecklist(types: string[], current: ProjectCheck[], labels: Record<string, string>): ProjectCheck[] {
  const selected = types.filter(t => t !== "projeto_completo");
  const result = current.map((c, i) => ({ ...c, id: c.id || c.type || `legacy-${i}` }));
  for (const type of selected) {
    const text = labels[type] || type;
    const found = result.find(c => c.type === type || c.id === type || c.text.toLocaleLowerCase("pt-BR") === text.toLocaleLowerCase("pt-BR"));
    if (found) { found.id ||= type; found.type = type; }
    else result.push({ id: type, type, text, done: false });
  }
  return result;
}
export function validateProjectUpload(name: string, size: number, kind: string) {
  if (!name.trim() || name.length > 255 || /[\/\x00-\x1f]/.test(name)) throw new Error("Nome de arquivo inválido.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > PROJECT_UPLOAD_LIMIT) throw new Error("Envie um arquivo de até 300 MB.");
  if (kind !== "editable" && kind !== "pdf") throw new Error("Escolha arquivo editável ou PDF.");
  if (kind === "pdf" && !/\.pdf$/i.test(name)) throw new Error("Nesta opção envie um arquivo PDF.");
  if (kind === "editable" && /\.pdf$/i.test(name)) throw new Error("Envie o arquivo fonte editável nesta opção; o PDF pertence ao campo PDF.");
}

const extensionFrom = (name: string, mime: string) => {
  const match = /\.([a-z0-9]{1,10})$/i.exec(name.trim());
  if (match) return match[1].toLowerCase();
  return mime === "application/pdf" ? "pdf" : "bin";
};

const canonicalPart = (value: string, fallback: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  .slice(0, 48) || fallback;

export function projectDocumentCanonicalName(input: { projectName: string; clientName: string; itemName: string; version: number; originalName: string; mime: string }) {
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new Error("Versão de arquivo inválida.");
  const version = String(input.version).padStart(2, "0");
  const extension = extensionFrom(input.originalName, input.mime);
  return `${canonicalPart(input.projectName, "PROJETO")}_${canonicalPart(input.clientName, "CLIENTE")}_${canonicalPart(input.itemName, "ARQUIVO")}_V${version}.${extension}`;
}

export function reconcileProjectChecklist(checks: ProjectCheck[], documents: ProjectDocumentPresence[]): ProjectCheck[] {
  const active = new Set(documents.map(document => `${document.itemId}:${document.kind}`));
  return checks.map((check, index) => {
    const id = check.id || check.type || `legacy-${index}`;
    const pdfDone = active.has(`${id}:pdf`);
    const editableDone = active.has(`${id}:editable`);
    return { ...check, id, pdfDone, editableDone, done: pdfDone && editableDone };
  });
}
