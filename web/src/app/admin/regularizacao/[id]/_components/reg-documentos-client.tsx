"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Plus,
} from "lucide-react";
import {
  adicionarDocumentoReg,
  atualizarStatusDocumento,
  excluirDocumentoReg,
} from "@/lib/actions/regularizacao";
import { REG_STATUS_CONFIG } from "@/lib/types/regularizacao";

interface Documento {
  id: string;
  nome: string;
  status: string;
  observacao: string;
}

interface Props {
  regularizacaoId: string;
  documentos: Documento[];
  currentStatus: string;
}

const stageOrder = [
  "analise_inicial",
  "documentacao",
  "protocolo",
  "em_analise_orgao",
  "pendencias",
  "aprovado",
  "registrado",
  "concluido",
] as const;

const docStatusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "protocolado", label: "Protocolado" },
  { value: "obtido", label: "Obtido" },
  { value: "aprovado", label: "Aprovado" },
];

const docStatusBadge: Record<string, { label: string; bg: string; color: string }> = {
  aprovado: { label: "Aprovado", bg: "bg-green-100", color: "text-green-700" },
  obtido: { label: "Obtido", bg: "bg-blue-100", color: "text-blue-600" },
  protocolado: { label: "Protocolado", bg: "bg-purple-100", color: "text-purple-700" },
  pendente: { label: "Pendente", bg: "bg-orange-100", color: "text-orange-600" },
};

function DocIcon({ status }: { status: string }) {
  if (status === "aprovado" || status === "obtido") {
    return (
      <CheckCircle2
        size={14}
        className={status === "aprovado" ? "text-green-600" : "text-blue-500"}
      />
    );
  }
  if (status === "protocolado") return <Clock size={14} className="text-purple-500" />;
  return <AlertCircle size={14} className="text-orange-400" />;
}

export default function RegDocumentosClient({
  regularizacaoId,
  documentos: initialDocumentos,
  currentStatus,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>(initialDocumentos);
  const [novoNome, setNovoNome] = useState("");

  function showSaved() {
    setSavedMsg("Salvo!");
    setTimeout(() => setSavedMsg(null), 2000);
  }

  function handleAddDocumento() {
    const nome = novoNome.trim();
    if (!nome) return;
    setNovoNome("");
    startTransition(async () => {
      await adicionarDocumentoReg(regularizacaoId, nome);
      showSaved();
    });
  }

  function handleStatusChange(doc: Documento, newStatus: string) {
    setDocumentos((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, status: newStatus } : d))
    );
    startTransition(async () => {
      await atualizarStatusDocumento(doc.id, newStatus, regularizacaoId);
      showSaved();
    });
  }

  function handleDelete(doc: Documento) {
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
    startTransition(async () => {
      await excluirDocumentoReg(doc.id, regularizacaoId);
      showSaved();
    });
  }

  const emOrdem = documentos.filter(
    (d) => d.status === "aprovado" || d.status === "obtido"
  ).length;

  // ── Timeline data ─────────────────────────────────────────────────────────
  const currentCfgOrder =
    REG_STATUS_CONFIG[currentStatus as keyof typeof REG_STATUS_CONFIG]?.order ?? 0;

  return (
    <div className="space-y-5">
      {savedMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 shadow-lg">
          {savedMsg}
        </div>
      )}

      {/* ── Documentos ── */}
      <div className="bg-white border border-gray-100 p-5">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
          Documentos ({emOrdem}/{documentos.length} em ordem)
        </h2>

        {documentos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhum documento cadastrado.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {documentos.map((doc) => {
              const badge =
                docStatusBadge[doc.status] ?? {
                  label: doc.status,
                  bg: "bg-gray-100",
                  color: "text-gray-600",
                };
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2.5 bg-gray-50 group"
                >
                  <DocIcon status={doc.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--brand-dark)] truncate">
                      {doc.nome}
                    </p>
                    {doc.observacao && (
                      <p className="text-xs text-orange-500">{doc.observacao}</p>
                    )}
                  </div>
                  <select
                    value={doc.status}
                    onChange={(e) => handleStatusChange(doc, e.target.value)}
                    disabled={isPending}
                    className={`text-[10px] font-bold px-2 py-1 uppercase border-0 cursor-pointer shrink-0 ${badge.bg} ${badge.color}`}
                  >
                    {docStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={isPending}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Adicionar documento */}
        <div className="flex gap-2">
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDocumento()}
            placeholder="Nome do documento..."
            className="flex-1 text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]"
          />
          <button
            onClick={handleAddDocumento}
            disabled={!novoNome.trim() || isPending}
            className="flex items-center gap-1 bg-[var(--brand-dark)] text-white text-xs font-bold px-3 py-2 uppercase hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors disabled:opacity-40"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="bg-white border border-gray-100 p-5">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
          Linha do Tempo
        </h2>
        <div className="relative">
          {stageOrder.map((stage, i) => {
            const sc = REG_STATUS_CONFIG[stage];
            const isCurrent = stage === currentStatus;
            const isPast = sc.order < currentCfgOrder && currentStatus !== "cancelado";
            const isLast = i === stageOrder.length - 1;
            return (
              <div key={stage} className="flex gap-3">
                {/* Dot + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full border-2 shrink-0 mt-0.5 ${
                      isCurrent
                        ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]"
                        : isPast
                        ? "border-green-500 bg-green-500"
                        : "border-gray-300 bg-white"
                    }`}
                  />
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 my-0.5 min-h-[16px] ${
                        isPast ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
                {/* Label */}
                <div className="pb-3">
                  <span
                    className={`text-xs ${
                      isCurrent
                        ? "font-bold text-[var(--brand-dark)]"
                        : isPast
                        ? "text-green-600 font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {sc.label}
                  </span>
                  {isCurrent && (
                    <span
                      className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 uppercase ${sc.bgColor} ${sc.color}`}
                    >
                      atual
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
