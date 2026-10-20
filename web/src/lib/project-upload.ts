export async function uploadProjectDocument(endpoint: string, file: File, itemId: string, kind: "editable" | "pdf", onProgress: (n: number) => void) {
  if (!file.size || file.size > 300 * 1024 * 1024) throw new Error("Envie um arquivo de até 300 MB.");
  if (kind === "pdf" && !/\.pdf$/i.test(file.name)) throw new Error("Nesta opção envie um arquivo PDF.");
  async function post(body: object) {
    const res = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível enviar o arquivo.");
    return data;
  }
  const start = await post({ action: "start", name: file.name, size: file.size, mime: file.type, itemId, kind });
  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    const chunk = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(file.slice(offset, offset + 1024 * 1024)); });
    try {
      const result = await post({ session: start.session, offset, chunk });
      if (!Number.isSafeInteger(result.offset) || result.offset <= offset) throw new Error("O Drive não confirmou o recebimento desta parte.");
      offset = result.offset;
      onProgress(Math.round(offset / file.size * 100));
      failures = 0;
      if (result.file) return result.file;
    } catch (error) {
      if (++failures > 3) throw error;
      const state = await post({ session: start.session, offset: 0, chunk: "" });
      if (state.file) return state.file;
      offset = state.offset;
    }
  }
  throw new Error("O Drive não confirmou o arquivo completo.");
}
