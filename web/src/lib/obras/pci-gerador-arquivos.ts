// Lote 2, correção 03: download em partes (limite de resposta da Vercel) dos
// modelos de PCI e das PCIs geradas. Rotas em src/app/api/pci-modelos e src/app/api/obras/[id]/pci-geradas.
export async function baixarArquivoEmPartes(url: string, nomePadrao: string) {
  const primeira = await fetch(`${url}?parte=0`, { credentials: "include" });
  if (!primeira.ok) {
    let msg = `Erro ao baixar o arquivo (código ${primeira.status}).`;
    try {
      const j = await primeira.json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      // resposta sem JSON
    }
    throw new Error(msg);
  }
  const nome = /filename="([^"]+)"/.exec(primeira.headers.get("Content-Disposition") ?? "")?.[1] ?? nomePadrao;
  const total = Number(primeira.headers.get("X-Arquivo-Partes") ?? 1);
  const versao = primeira.headers.get("X-Arquivo-Versao") ?? "";
  const blobs = [await primeira.blob()];
  for (let parte = 1; parte < total; parte++) {
    const r = await fetch(`${url}?parte=${parte}&versao=${encodeURIComponent(versao)}`, { credentials: "include" });
    if (!r.ok) throw new Error("Não foi possível concluir o download. Tente novamente.");
    blobs.push(await r.blob());
  }
  const blob = new Blob(blobs, { type: primeira.headers.get("Content-Type") ?? "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
