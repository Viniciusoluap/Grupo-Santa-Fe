"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Trash2, FileText, FileImage, Loader2, Upload, AlertCircle, X } from "lucide-react";
import { salvarDocumentosAvaliacao } from "@/lib/actions/avaliacoes";

interface Documento {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
}

interface Props {
  avaliacaoId: string;
  initialData: string;
}

const MAX_FILES = 5;
// 4 MB per file — matches /api/avaliacoes/upload-doc server limit (Vercel 4.5 MB body)
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB total (5 × 4 MB)

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fileIcon(tipo: string) {
  if (tipo.startsWith("image/")) return <FileImage size={14} className="text-blue-400 shrink-0" />;
  return <FileText size={14} className="text-gray-400 shrink-0" />;
}

function parseDocumentos(raw: string): Documento[] {
  try { return JSON.parse(raw) as Documento[]; } catch { return []; }
}

// XHR-based upload — avoids the @vercel/blob/client two-step handshake that
// hangs after CDN PUT on iOS Safari (post-upload completion callback never resolves).
function uploadFileXHR(
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { url: string });
        } catch {
          reject(new Error("Resposta inválida do servidor."));
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(json.error ?? `Erro HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede ao enviar arquivo."));
    xhr.onabort = () => reject(new DOMException("Upload cancelado.", "AbortError"));

    signal.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.open("POST", "/api/avaliacoes/upload-doc");
    xhr.send(fd);
  });
}

export function DocumentosAvaliacao({ avaliacaoId, initialData }: Props) {
  const [docs, setDocs] = useState<Documento[]>(() => parseDocumentos(initialData));
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const totalBytes = docs.reduce((sum, d) => sum + d.tamanho, 0);

  async function persistir(updated: Documento[]) {
    startTransition(async () => {
      await salvarDocumentosAvaliacao(avaliacaoId, JSON.stringify(updated));
    });
  }

  async function handleFiles(files: File[]) {
    if (uploading) return;
    setError(null);

    const remaining = MAX_FILES - docs.length;
    if (remaining <= 0) { setError(`Limite de ${MAX_FILES} documentos atingido.`); return; }

    const toUpload = files.slice(0, remaining);

    // Per-file size check
    const oversized = toUpload.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" excede 4 MB. Reduza o tamanho do arquivo.`);
      return;
    }

    // Total size check (existing + new)
    const newBytes = toUpload.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes + newBytes > MAX_TOTAL_BYTES) {
      const usedMB = (totalBytes / 1024 / 1024).toFixed(1);
      const addMB = (newBytes / 1024 / 1024).toFixed(1);
      setError(`Limite de 20 MB total excedido. Já usado: ${usedMB} MB + novo: ${addMB} MB.`);
      return;
    }

    setUploading(true);
    const novos: Documento[] = [];
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    try {
      for (const file of toUpload) {
        if (controller.signal.aborted) break;
        setUploadingName(file.name);
        setUploadProgress(0);

        const { url } = await uploadFileXHR(file, setUploadProgress, controller.signal);

        novos.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          nome: file.name,
          url,
          tipo: file.type,
          tamanho: file.size,
        });
      }

      if (novos.length > 0) {
        const updated = [...docs, ...novos];
        setDocs(updated);
        await persistir(updated);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Upload cancelado.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      abortCtrlRef.current = null;
      setUploading(false);
      setUploadingName(null);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleCancelar() {
    abortCtrlRef.current?.abort();
  }

  async function handleRemover(docId: string) {
    const updated = docs.filter((d) => d.id !== docId);
    setDocs(updated);
    await persistir(updated);
  }

  const canUpload = !uploading && !isPending && docs.length < MAX_FILES;
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

  return (
    <div className="bg-white border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Documentos ({docs.length}/{MAX_FILES})
          </p>
          {docs.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">{totalMB} MB / 20 MB usados</p>
          )}
        </div>
        {uploading ? (
          <button
            type="button"
            onClick={handleCancelar}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            <X size={12} /> Cancelar
          </button>
        ) : (
          docs.length < MAX_FILES && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!canUpload}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-gray-200 text-[var(--brand-dark)] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Upload size={12} /> Anexar
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) handleFiles(files);
                }}
              />
            </>
          )
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 p-3 text-xs text-red-600">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <X size={12} />
          </button>
        </div>
      )}

      {docs.length === 0 && !uploading && (
        <div
          className={`border-2 border-dashed p-6 text-center transition-colors ${canUpload ? "cursor-pointer border-gray-200 hover:border-[var(--brand-yellow)]" : "border-gray-100 cursor-default"}`}
          onClick={() => canUpload && inputRef.current?.click()}
        >
          <Paperclip size={20} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Clique para anexar documentos</p>
          <p className="text-[10px] text-gray-300 mt-1">PDF, Word, Excel, imagens · até 4 MB por arquivo · até 5 arquivos</p>
        </div>
      )}

      {uploading && uploadingName && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2">
            <Loader2 size={12} className="animate-spin text-[var(--brand-yellow)] shrink-0" />
            <span className="truncate flex-1">
              Enviando <strong>{uploadingName}</strong>
              {uploadProgress > 0 && <span className="text-[var(--brand-dark)] font-bold ml-1">{uploadProgress}%</span>}
            </span>
            <button
              type="button"
              onClick={handleCancelar}
              className="shrink-0 text-xs text-red-500 hover:text-red-700 font-bold border border-red-200 hover:border-red-400 px-2 py-0.5 transition-colors"
            >
              Cancelar
            </button>
          </div>
          <div className="h-1 bg-gray-100 overflow-hidden mx-3">
            <div
              className="h-full bg-[var(--brand-yellow)] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 bg-gray-50 px-3 py-2">
              {fileIcon(doc.tipo)}
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-xs font-medium text-[var(--brand-dark)] hover:text-[var(--brand-yellow)] truncate"
              >
                {doc.nome}
              </a>
              <span className="text-[10px] text-gray-400 shrink-0">{formatSize(doc.tamanho)}</span>
              <button
                type="button"
                onClick={() => handleRemover(doc.id)}
                disabled={isPending || uploading}
                title="Excluir documento"
                className="flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-1.5 py-0.5 transition-colors disabled:opacity-40 shrink-0"
              >
                <Trash2 size={11} /> Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
