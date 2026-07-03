"use client";

import { useState, useRef } from "react";
import { FileText, Upload, Loader2, ExternalLink, Send } from "lucide-react";
import { gerarPdfContrato, uploadContratoAssinado, marcarAssinaturaStatus } from "@/lib/actions/juridico";

interface Props {
  contratoId: string;
  pdfUrl?: string;
  assinaturaStatus?: string;
}

export function ContratoAcoes({ contratoId, pdfUrl, assinaturaStatus }: Props) {
  const [loading, setLoading] = useState<"pdf" | "upload" | "solicitar" | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(pdfUrl);
  const [status, setStatus] = useState(assinaturaStatus ?? "pendente");
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

  async function handleSolicitar() {
    setLoading("solicitar");
    try {
      await marcarAssinaturaStatus(contratoId, "solicitado");
      setStatus("solicitado");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao solicitar assinatura");
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
      setStatus("assinado");
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
      {currentPdfUrl && status !== "assinado" && status !== "solicitado" && (
        <button
          onClick={handleSolicitar}
          disabled={loading !== null}
          title="Envia o contrato para o cliente assinar via gov.br pelo Portal do Cliente"
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 transition-colors"
        >
          {loading === "solicitar" ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
          Solicitar gov.br
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
