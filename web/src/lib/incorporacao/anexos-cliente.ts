// Envio e abertura de anexos da Due Diligence e do registro, no navegador.
// Gêmeo de Prospecta/client/src/components/incorporacao/estudo/compat/acoes.ts
// (enviarDocumentoRegistro/abrirDocumentoRegistro): mesma regra nos dois sistemas.
import { enviarComProgresso } from "@/lib/envio-progresso";
import { LIMITE_ANEXO_BYTES, LIMITE_ANEXO_ROTULO, MIME_GENERICO, PARTE_ANEXO_BYTES, anexoVisualizavel, mimeDoAnexo, partesDoAnexo } from "./anexos";
import { LIMITE_DOCUMENTO_REGISTRO } from "./registro-documento-validacao";

function idDoEnvio() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/** Qualquer tipo de arquivo (foto, DWG, Word...), até 50 MB: direto até 3 MB, acima em partes de 2 MiB. */
export async function enviarAnexoRegistro<T>(estudoId: string, itemId: string, arquivo: File): Promise<T> {
  if (arquivo.size === 0) throw new Error("O arquivo está vazio.");
  if (arquivo.size > LIMITE_ANEXO_BYTES) throw new Error(`Arquivo acima de ${LIMITE_ANEXO_ROTULO}.`);
  if (arquivo.size <= LIMITE_DOCUMENTO_REGISTRO)
    return enviarComProgresso<T>("incorporacao.documento", { estudoId, itemId, arquivo }, { item: "documento" });
  const uploadId = idDoEnvio();
  const total = partesDoAnexo(arquivo.size);
  for (let parte = 0; parte < total; parte++) {
    const pedaco = arquivo.slice(parte * PARTE_ANEXO_BYTES, (parte + 1) * PARTE_ANEXO_BYTES);
    await enviarComProgresso("incorporacao.documento.parte", { estudoId, itemId, uploadId, parte: String(parte), pedaco: new File([pedaco], "parte") },
      { item: "documento", atual: parte + 1, total });
  }
  return enviarComProgresso<T>("incorporacao.documento.finalizar", {
    estudoId, itemId, uploadId, nome: arquivo.name, mime: mimeDoAnexo(arquivo.name, arquivo.type), tamanho: String(arquivo.size),
  }, { item: "documento" });
}

/**
 * Abre o anexo: PDF/foto/texto numa aba; os demais (DWG, Word...) são baixados com o nome original.
 * Acima de 4 MB a leitura é em partes (a resposta da Vercel é limitada) e o navegador junta.
 */
export async function abrirAnexoRegistro(doc: { id: string; nome: string; mime: string; tamanho: number }) {
  const url = `/api/incorporacao/documentos/${encodeURIComponent(doc.id)}`;
  if (doc.tamanho <= 4 * 1024 * 1024) { window.open(url, "_blank", "noopener,noreferrer"); return; }
  const visualizavel = anexoVisualizavel(doc.mime);
  // a aba é aberta no próprio clique (Safari/iPad bloqueia window.open depois de um await)
  const aba = visualizavel ? window.open("", "_blank") : null;
  try {
    const blocos: BlobPart[] = [];
    for (let parte = 0; parte < partesDoAnexo(doc.tamanho); parte++) {
      const r = await fetch(`${url}?parte=${parte}`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error("Não foi possível abrir o documento.");
      blocos.push(await r.arrayBuffer());
    }
    const href = URL.createObjectURL(new Blob(blocos, { type: visualizavel ? doc.mime : MIME_GENERICO }));
    if (aba) { aba.opener = null; aba.location.href = href; }
    else {
      const link = document.createElement("a");
      link.href = href; link.download = doc.nome || "arquivo"; link.rel = "noopener";
      document.body.appendChild(link); link.click(); link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (e) {
    aba?.close();
    throw e;
  }
}
