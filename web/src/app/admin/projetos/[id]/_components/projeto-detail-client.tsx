"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Trash2, Plus, Paperclip, X } from "lucide-react";
import {
  salvarChecklistProjeto,
  salvarArquivosProjeto,
  alterarStatusProjetoFromDetail,
} from "@/lib/actions/projetos";

interface ChecklistItem {
  id: string;
  texto: string;
  feito: boolean;
}

interface ArquivoItem {
  nome: string;
  url: string;
  data: string;
}

interface Props {
  projetoId: string;
  checklistJson: string;
  arquivosJson: string;
  status: string;
  statusConfig: Record<string, { label: string; bgColor: string; color: string }>;
}

export default function ProjetoDetailClient({
  projetoId,
  checklistJson,
  arquivosJson,
  status,
  statusConfig,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // --- Checklist state ---
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      return JSON.parse(checklistJson) as ChecklistItem[];
    } catch {
      return [];
    }
  });
  const [novoItem, setNovoItem] = useState("");

  // --- Arquivos state ---
  const [arquivos, setArquivos] = useState<ArquivoItem[]>(() => {
    try {
      return JSON.parse(arquivosJson) as ArquivoItem[];
    } catch {
      return [];
    }
  });

  function showSaved() {
    setSavedMsg("Salvo!");
    setTimeout(() => setSavedMsg(null), 2000);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  function handleStatusChange(newStatus: string) {
    if (newStatus === status) return;
    startTransition(async () => {
      await alterarStatusProjetoFromDetail(projetoId, newStatus);
      showSaved();
    });
  }

  // ── Checklist ─────────────────────────────────────────────────────────────

  function toggleItem(index: number) {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, feito: !item.feito } : item
    );
    setChecklist(updated);
    startTransition(async () => {
      await salvarChecklistProjeto(projetoId, JSON.stringify(updated));
      showSaved();
    });
  }

  function removerItem(index: number) {
    const updated = checklist.filter((_, i) => i !== index);
    setChecklist(updated);
    startTransition(async () => {
      await salvarChecklistProjeto(projetoId, JSON.stringify(updated));
      showSaved();
    });
  }

  function adicionarItem() {
    const texto = novoItem.trim();
    if (!texto) return;
    const updated = [
      ...checklist,
      { id: String(checklist.length), texto, feito: false },
    ];
    setChecklist(updated);
    setNovoItem("");
    startTransition(async () => {
      await salvarChecklistProjeto(projetoId, JSON.stringify(updated));
      showSaved();
    });
  }

  // ── Arquivos ──────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const updated = [
        ...arquivos,
        {
          nome: file.name,
          url,
          data: new Date().toLocaleDateString("pt-BR"),
        },
      ];
      setArquivos(updated);
      startTransition(async () => {
        await salvarArquivosProjeto(projetoId, JSON.stringify(updated));
        showSaved();
      });
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-added
    e.target.value = "";
  }

  function removerArquivo(index: number) {
    const updated = arquivos.filter((_, i) => i !== index);
    setArquivos(updated);
    startTransition(async () => {
      await salvarArquivosProjeto(projetoId, JSON.stringify(updated));
      showSaved();
    });
  }

  const currentCfg = statusConfig[status] ?? {
    label: status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
  };
  const feitos = checklist.filter((i) => i.feito).length;

  return (
    <div className="space-y-5">
      {/* Saved feedback */}
      {savedMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 shadow-lg">
          {savedMsg}
        </div>
      )}

      {/* ── Status ── */}
      <div className="bg-white border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 flex-wrap gap-2">
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
            Status do Projeto
          </h2>
          <span
            className={`text-xs font-bold px-2 py-0.5 uppercase ${currentCfg.bgColor} ${currentCfg.color}`}
          >
            {currentCfg.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const isActive = key === status;
            return (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                disabled={isActive || isPending}
                className={`text-[10px] font-bold px-3 py-1.5 uppercase transition-colors border ${
                  isActive
                    ? `${cfg.bgColor} ${cfg.color} border-transparent cursor-default`
                    : "border-gray-200 text-gray-400 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Checklist ── */}
      <div className="bg-white border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
            Checklist
          </h2>
          {checklist.length > 0 && (
            <span className="text-xs text-gray-400">
              {feitos}/{checklist.length} concluídos
            </span>
          )}
        </div>

        {checklist.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">
            Nenhum item no checklist.
          </p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {checklist.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 bg-gray-50 group"
              >
                <button
                  onClick={() => toggleItem(i)}
                  disabled={isPending}
                  className="shrink-0 text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
                >
                  {item.feito ? (
                    <CheckSquare size={16} className="text-green-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    item.feito ? "line-through text-gray-400" : "text-[var(--brand-dark)]"
                  }`}
                >
                  {item.texto}
                </span>
                <button
                  onClick={() => removerItem(i)}
                  disabled={isPending}
                  className="shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarItem()}
            placeholder="Adicionar item..."
            className="flex-1 text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]"
          />
          <button
            onClick={adicionarItem}
            disabled={!novoItem.trim() || isPending}
            className="flex items-center gap-1 bg-[var(--brand-dark)] text-white text-xs font-bold px-3 py-2 uppercase hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors disabled:opacity-40"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>

      {/* ── Arquivos ── */}
      <div className="bg-white border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
            Arquivos
          </h2>
          <label className="flex items-center gap-1 bg-[var(--brand-dark)] text-white text-xs font-bold px-3 py-1.5 uppercase cursor-pointer hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors">
            <Paperclip size={12} /> Enviar arquivo
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {arquivos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">
            Nenhum arquivo anexado.
          </p>
        ) : (
          <div className="space-y-1.5">
            {arquivos.map((arq, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 bg-gray-50 group"
              >
                <Paperclip size={13} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={arq.url}
                    download={arq.nome}
                    className="text-sm text-[var(--brand-dark)] hover:underline truncate block"
                  >
                    {arq.nome}
                  </a>
                  <span className="text-xs text-gray-400">{arq.data}</span>
                </div>
                <button
                  onClick={() => removerArquivo(i)}
                  disabled={isPending}
                  className="shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
