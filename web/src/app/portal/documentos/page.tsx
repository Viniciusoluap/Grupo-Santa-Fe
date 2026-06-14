"use client";

import { useState } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { getClientProcess } from "@/lib/data/portal";
import { DOC_STATUS_CONFIG, DocumentStatus } from "@/lib/types/portal";
import { BackButton } from "@/components/ui/back-button";

export default function PortalDocumentosPage() {
  const process = getClientProcess();
  const [activeFilter, setActiveFilter] = useState<DocumentStatus | "todos">("todos");

  const filtered = process.documents.filter(
    (d) => activeFilter === "todos" || d.status === activeFilter
  );

  const counts = {
    aprovado: process.documents.filter((d) => d.status === "aprovado").length,
    enviado: process.documents.filter((d) => d.status === "enviado").length,
    pendente: process.documents.filter((d) => d.status === "pendente").length,
    rejeitado: process.documents.filter((d) => d.status === "rejeitado").length,
  };

  const statusIcon = {
    aprovado: <CheckCircle2 size={14} className="text-green-600" />,
    enviado: <Clock size={14} className="text-blue-500" />,
    pendente: <AlertCircle size={14} className="text-orange-400" />,
    rejeitado: <XCircle size={14} className="text-red-500" />,
  };

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Documentos</h1>
        <p className="text-gray-400 text-sm mt-0.5">{process.documents.length} documentos no processo</p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["aprovado", "enviado", "pendente", "rejeitado"] as DocumentStatus[]).map((status) => {
          const cfg = DOC_STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setActiveFilter(activeFilter === status ? "todos" : status)}
              className={`p-3 border text-left transition-colors ${activeFilter === status ? `${cfg.bgColor} border-transparent` : "bg-white border-gray-100 hover:border-gray-300"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {statusIcon[status]}
                <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className={`font-black text-2xl ${cfg.color}`}>{counts[status]}</p>
            </button>
          );
        })}
      </div>

      {/* Documents list */}
      <div className="bg-white border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Lista de Documentos</h2>
          <button
            onClick={() => setActiveFilter("todos")}
            className="text-xs text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
          >
            {activeFilter !== "todos" && "Mostrar todos"}
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map((doc) => {
            const cfg = DOC_STATUS_CONFIG[doc.status];
            return (
              <div key={doc.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {statusIcon[doc.status]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{doc.name}</p>
                      {doc.required && (
                        <span className="text-[9px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 uppercase shrink-0">Obrigatório</span>
                      )}
                    </div>
                    {doc.uploadedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Enviado em {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {doc.notes && <p className="text-xs text-red-500 mt-0.5">{doc.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {(doc.status === "pendente" || doc.status === "rejeitado") && (
                    <button className="flex items-center gap-1 text-xs bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase tracking-wide px-3 py-1.5 transition-colors">
                      <Upload size={11} /> Enviar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {counts.pendente > 0 && (
        <div className="bg-orange-50 border border-orange-100 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-700">Atenção: {counts.pendente} documento{counts.pendente > 1 ? "s" : ""} pendente{counts.pendente > 1 ? "s" : ""}</p>
            <p className="text-xs text-orange-600 mt-0.5">
              O envio dos documentos pendentes é necessário para prosseguir com o processo. Em caso de dúvidas, entre em contato com seu corretor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
