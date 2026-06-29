"use client";

import { useState, useRef } from "react";
import { FileText, Upload, Loader2, ExternalLink } from "lucide-react";
import { gerarPdfContrato, uploadContratoAssinado } from "@/lib/actions/juridico";

interface Props {
  contratoId: string;
  pdfUrl?: string;
}

export function ContratoAcoes({ contratoId, pdfUrl }: Props) {
  const [loading, setLoading] = useState<"pdf" | "upload" | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(pdfUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleGerarPdf() {
    setLoading("pdf");
    try {
      const result = await gerarPdfContrato(contratoId);
      setCurrentPdfUrl(result.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setLoading(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading("upload");
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      await uploadContratoAssinado(contratoId, fd);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setLoading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {currentPdfUrl ? (
        <a
          href={currentPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        >
          <ExternalLink size={10} /> PDF
        </a>
      ) : (
        <button
          onClick={handleGerarPdf}
          disabled={loading !== null}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading === "pdf" ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
          Gerar PDF
        </button>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading !== null}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        {loading === "upload" ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
        Assinar
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
