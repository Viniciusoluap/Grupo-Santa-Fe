"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { Paperclip, Trash2, FileText, FileImage, Loader2, Upload, AlertCircle } from "lucide-react";
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
  initialData: string; // JSON string
}

const MAX_FILES = 5;
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB per file

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

export function DocumentosAvaliacao({ avaliacaoId, initialData }: Props) {
  const [docs, setDocs] = useState<Documento[]>(() => parseDocumentos(initialData));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function persistir(updated: Documento[]) {
    startTransition(async () => {
      await salvarDocumentosAvaliacao(avaliacaoId, JSON.stringify(updated));
    });
  }

  async function handleFiles(files: File[]) {
    setError(null);
    const remaining = MAX_FILES - docs.length;
    if (remaining <= 0) {
      setError(`Limite de ${MAX_FILES} documentos atingido.`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    const oversized = toUpload.filter((f) => f.size > MAX_BYTES);
    if (oversized.length) {
      setError(`Arquivo(s) acima de 30 MB: ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }

    setUploading(true);
    const novos: Documento[] = [];
    try {
      for (const file of toUpload) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/avaliacoes/documentos",
        });
        novos.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          nome: file.name,
          url: blob.url,
          tipo: file.type,
          tamanho: file.size,
        });
      }
      const updated = [...docs, ...novos];
      setDocs(updated);
      await persistir(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("BLOB_READ_WRITE_TOKEN") || msg.includes("token")) {
        setError("Vercel Blob não configurado. Ative o Blob Storage no dashboard do Vercel e adicione BLOB_READ_WRITE_TOKEN nas variáveis de ambiente.");
      } else {
        setError(`Erro ao enviar: ${msg}`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemover(docId: string) {
    const updated = docs.filter((d) => d.id !== docId);
    setDocs(updated);
    await persistir(updated);
  }

  return (
    <div className="bg-white border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Documentos ({docs.length}/{MAX_FILES})
        </p>
        {docs.length < MAX_FILES && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || isPending}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-gray-200 text-[var(--brand-dark)] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? "Enviando..." : "Anexar"}
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
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 p-3 text-xs text-red-600">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {docs.length === 0 && !uploading && (
        <div
          className="border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer hover:border-[var(--brand-yellow)] transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={20} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Clique para anexar documentos</p>
          <p className="text-[10px] text-gray-300 mt-1">PDF, Word, Excel, imagens · max 30 MB por arquivo · até 5 arquivos</p>
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
                disabled={isPending}
                className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          Fazendo upload...
        </div>
      )}
    </div>
  );
}
