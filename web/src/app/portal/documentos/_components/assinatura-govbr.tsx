"use client";

import { useState, useRef } from "react";
import { Download, ExternalLink, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { enviarContratoAssinadoPortal } from "@/lib/actions/portal";

interface Props {
  contratoId: string;
  numero: string;
  pdfUrl: string;
}

export function AssinaturaGovBr({ contratoId, numero, pdfUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      await enviarContratoAssinadoPortal(contratoId, fd);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (enviado) {
    return (
      <div className="border-t border-gray-50 px-5 py-4 bg-green-50 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-600 shrink-0" />
        <p className="text-sm text-green-700 font-medium">
          Contrato assinado enviado com sucesso! Nossa equipe irá conferir.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-50 px-5 py-4 bg-yellow-50/50 space-y-3">
      <p className="text-sm font-bold text-[var(--brand-dark)]">
        ✍️ Sua assinatura foi solicitada — siga os 3 passos:
      </p>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 shrink-0 flex items-center justify-center text-[10px] font-black bg-[var(--brand-dark)] text-[var(--brand-yellow)] rounded-full">1</span>
          <div className="flex-1">
            <p className="text-sm text-gray-700">Baixe o contrato <strong>{numero}</strong> no seu celular ou computador</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)]"
            >
              <Download size={12} /> Baixar contrato
            </a>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-5 h-5 shrink-0 flex items-center justify-center text-[10px] font-black bg-[var(--brand-dark)] text-[var(--brand-yellow)] rounded-full">2</span>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              Assine gratuitamente no site oficial do governo com sua conta gov.br
              <span className="text-gray-400"> (necessário nível prata ou ouro)</span>
            </p>
            <a
              href="https://assinador.iti.br"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-blue-600 text-white"
            >
              <ExternalLink size={12} /> Assinar no gov.br
            </a>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-5 h-5 shrink-0 flex items-center justify-center text-[10px] font-black bg-[var(--brand-dark)] text-[var(--brand-yellow)] rounded-full">3</span>
          <div className="flex-1">
            <p className="text-sm text-gray-700">Envie aqui o PDF assinado que o gov.br gerou</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-green-600 text-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {loading ? "Enviando..." : "Enviar PDF assinado"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>

      {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}
    </div>
  );
}
