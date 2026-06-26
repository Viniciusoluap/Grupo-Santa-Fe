"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
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
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB total across all files

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

// Sanitize filename to safe URL chars
function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const MAX_RETRIES = 3;
const STALL_MS = 25000;   // aborta se o progresso não avançar por 25s
const ATTEMPT_TIMEOUT_MS = 40000; // deadline duro por tentativa — garante falha mesmo se SDK ignorar AbortSignal

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Pergunta ao servidor se o blob já chegou no storage. Cobre o caso do iOS em que
// o upload termina mas o callback do SDK nunca resolve (trava em 100%).
async function checkBlobLanded(pathname: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/avaliacoes/documentos?path=${encodeURIComponent(pathname)}`);
    if (res.ok) {
      const { url } = (await res.json()) as { url?: string };
      return url ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

// Uma tentativa de upload com dois mecanismos de segurança contra travamento:
// 1. Watchdog de progresso — aborta se os bytes pararem de fluir por STALL_MS
// 2. Promise.race com deadline duro — garante falha mesmo que o SDK ignore o AbortSignal
//    (problema conhecido no iOS Safari durante a fase de geração do token, quando
//    progress=0% e o AbortSignal não é respeitado pelo fetch interno do SDK)
async function uploadAttempt(
  file: File,
  pathname: string,
  onProgress: (pct: number) => void,
  userSignal: AbortSignal
): Promise<string> {
  const inner = new AbortController();
  const onUserAbort = () => inner.abort(new DOMException("Upload cancelado.", "AbortError"));
  if (userSignal.aborted) onUserAbort();
  else userSignal.addEventListener("abort", onUserAbort, { once: true });

  let lastProgressAt = Date.now();
  let lastPct = 0;
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgressAt > STALL_MS) {
      inner.abort(new DOMException("Upload travou (sem progresso).", "StallError"));
    }
  }, 5000);

  // Deadline duro: rejeita a Promise independentemente do SDK honrar o AbortSignal
  const hardDeadline = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new DOMException("Upload excedeu o tempo limite.", "TimeoutError")),
      ATTEMPT_TIMEOUT_MS
    )
  );

  try {
    const blob = await Promise.race([
      upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/avaliacoes/documentos",
        // multipart:true removido — exige round-trips extras de "create session" que
        // travam em 0% no iOS quando o token não chega a tempo (SDK ignora AbortSignal
        // nessa fase); o upload single-chunk é igualmente robusto com o watchdog ativo.
        abortSignal: inner.signal,
        onUploadProgress: ({ percentage }) => {
          const pct = Math.round(percentage);
          if (pct > lastPct) { lastPct = pct; lastProgressAt = Date.now(); }
          onProgress(pct);
        },
      }),
      hardDeadline,
    ]);
    return blob.url;
  } finally {
    clearInterval(watchdog);
    userSignal.removeEventListener("abort", onUserAbort);
  }
}

// Upload robusto: path determinístico + multipart + watchdog de travamento + retentativas,
// com verificação no servidor entre as tentativas — assim um upload que de fato concluiu
// (mas cujo callback se perdeu no iOS) é recuperado em vez de reenviado.
async function uploadComFallback(
  file: File,
  avaliacaoId: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<string> {
  const pathname = `docs-avaliacao/${avaliacaoId}/${Date.now()}-${safeName(file.name)}`;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new DOMException("Upload cancelado.", "AbortError");
    try {
      return await uploadAttempt(file, pathname, onProgress, signal);
    } catch (err) {
      // Cancelamento real do usuário — propaga, sem retentar.
      if (signal.aborted) throw new DOMException("Upload cancelado.", "AbortError");

      // Os bytes podem já estar no storage (callback perdido no iOS ou travamento em 100%).
      const landed = await checkBlobLanded(pathname);
      if (landed) return landed;

      lastErr = err;
      if (attempt < MAX_RETRIES) {
        onProgress(0); // reseta a barra para a nova tentativa
        await delay(1500 * attempt); // backoff linear
      }
    }
  }

  // Última chance: talvez a tentativa final tenha chegado logo após desistirmos.
  const landed = await checkBlobLanded(pathname);
  if (landed) return landed;

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "desconhecido");
  throw new Error(`Falha no upload após ${MAX_RETRIES} tentativas: ${msg}`);
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

    const newBytes = toUpload.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes + newBytes > MAX_TOTAL_BYTES) {
      const usedMB = (totalBytes / 1024 / 1024).toFixed(1);
      const addMB = (newBytes / 1024 / 1024).toFixed(1);
      setError(`Limite de 50 MB total excedido. Já usado: ${usedMB} MB + novo: ${addMB} MB.`);
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

        const url = await uploadComFallback(file, avaliacaoId, setUploadProgress, controller.signal);

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
      } else if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "StallError")) {
        setError("Upload excedeu o tempo limite. Verifique sua conexão e tente novamente.");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("BLOB_READ_WRITE_TOKEN") || msg.toLowerCase().includes("token") || msg.includes("Unauthorized")) {
          setError("Blob Storage não configurado. Adicione BLOB_READ_WRITE_TOKEN nas variáveis de ambiente do Vercel.");
        } else {
          setError(msg || "Falha no upload. Tente novamente.");
        }
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
            <p className="text-[10px] text-gray-400 mt-0.5">{totalMB} MB / 50 MB usados</p>
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
          <p className="text-[10px] text-gray-300 mt-1">PDF, Word, Excel, imagens · até 50 MB no total · até 5 arquivos</p>
        </div>
      )}

      {uploading && uploadingName && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2">
            <Loader2 size={12} className="animate-spin text-[var(--brand-yellow)] shrink-0" />
            <span className="truncate flex-1">
              {uploadProgress === 0
                ? <><span className="text-gray-400">Conectando…</span> <strong>{uploadingName}</strong></>
                : <>Enviando <strong>{uploadingName}</strong> <span className="text-[var(--brand-dark)] font-bold ml-1">{uploadProgress}%</span>{uploadProgress >= 100 && <span className="text-gray-400 ml-1 text-[10px]">· finalizando…</span>}</>
              }
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
