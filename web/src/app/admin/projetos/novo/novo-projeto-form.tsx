"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { criarProjeto } from "@/lib/actions/projetos";
import { SubmitButton } from "@/components/ui/submit-button";
import { LeadSelector, type LeadOpcao } from "@/components/crm/lead-selector";

interface Props {
  leads: LeadOpcao[];
  leadIdInicial?: string;
}

function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currencyToFloat(masked: string): string {
  return masked.replace(/\./g, "").replace(",", ".");
}

export function NovoProjetoForm({ leads, leadIdInicial = "" }: Props) {
  const [leadId, setLeadId] = useState(leads.some((l) => l.id === leadIdInicial) ? leadIdInicial : "");
  const [leadErro, setLeadErro] = useState(false);

  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [tiposErro, setTiposErro] = useState(false);

  const [valorDisplay, setValorDisplay] = useState("");
  const valorRaw = currencyToFloat(valorDisplay);

  function toggleTipo(tipo: string) {
    setTiposErro(false);
    setTiposSelecionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  }

  async function handleSubmit(formData: FormData) {
    if (!leadId) { setLeadErro(true); return; }
    if (tiposSelecionados.length === 0) { setTiposErro(true); return; }
    tiposSelecionados.forEach((t) => formData.append("tipos", t));
    await criarProjeto(formData);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/projetos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Projetos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Novo Projeto</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={handleSubmit} className="space-y-5">
          <LeadSelector
            leads={leads}
            leadId={leadId}
            onChange={(id) => { setLeadId(id); setLeadErro(false); }}
            erro={leadErro}
          />

          {/* Tipos de projeto — multi-select */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">
              Tipos de Projeto
              <span className="ml-2 text-[10px] text-gray-400 normal-case font-normal">(selecione um ou mais)</span>
            </p>
            {tiposErro && <p className="text-red-500 text-xs mb-2">Selecione pelo menos um tipo de projeto.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(PROJETO_TIPO_CONFIG) as [string, { label: string; icon: string }][]).map(([k, v]) => {
                const ativo = tiposSelecionados.includes(k);
                return (
                  <button key={k} type="button" onClick={() => toggleTipo(k)}
                    className={`text-left text-xs font-medium px-3 py-2 border transition-colors ${
                      ativo
                        ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/10 text-[var(--brand-dark)] font-bold"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50"
                    }`}>
                    {ativo && <span className="mr-1">✓</span>}
                    {v.icon} {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dados do projeto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Projeto *</label>
              <input name="nome" type="text" required placeholder="Ex: Projeto Residência João Silva"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Engenheiro Responsável</label>
              <input name="engenheiro" type="text" placeholder="Nome do engenheiro"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Projeto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="text" inputMode="numeric" value={valorDisplay} placeholder="0,00"
                  onChange={(e) => setValorDisplay(maskCurrency(e.target.value))}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                <input type="hidden" name="valorProjeto" value={valorRaw} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição do Escopo</label>
            <textarea name="descricao" rows={4} placeholder="Descreva o escopo do projeto..."
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Cadastrando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cadastrar Projeto
            </SubmitButton>
            <Link href="/admin/projetos" className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
