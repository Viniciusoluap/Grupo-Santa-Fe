"use client";

import { useState } from "react";
import { FileText, X, Download, ExternalLink } from "lucide-react";

interface Documento {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  criadoEm: Date;
}

interface Props {
  contratoNumero: string;
  documentos: Documento[];
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  contrato_gerado: { label: "Gerado", color: "bg-blue-100 text-blue-700" },
  assinado:        { label: "Assinado", color: "bg-green-100 text-green-700" },
  anexo:           { label: "Anexo", color: "bg-gray-100 text-gray-600" },
};

export function ContratoDocumentos({ contratoNumero, documentos }: Props) {
  const [open, setOpen] = useState(false);

  if (documentos.length === 0) {
    return (
      <span className="text-xs text-gray-400">—</span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1"
      >
        <FileText size={10} /> {documentos.length}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-[var(--brand-dark)] flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[var(--brand-yellow)] font-black text-sm uppercase tracking-wide">Documentos</p>
                <p className="text-gray-400 text-xs">{contratoNumero}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {documentos.map((doc) => {
                const cfg = TIPO_LABELS[doc.tipo] ?? TIPO_LABELS.anexo;
                return (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={16} className="text-gray-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{doc.nome}</p>
                        <p className="text-xs text-gray-400">{new Date(doc.criadoEm).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 ${cfg.color}`}>{cfg.label}</span>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
                        title="Abrir"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2 bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
