"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { criarProjeto } from "@/lib/actions/projetos";
import { SubmitButton } from "@/components/ui/submit-button";

type Lead = { id: string; nome: string; telefone: string; email: string | null };

interface Props {
  leads: Lead[];
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
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

export function NovoProjetoForm({ leads }: Props) {
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");

  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [tiposErro, setTiposErro] = useState(false);

  const [valorDisplay, setValorDisplay] = useState("");
  const valorRaw = currencyToFloat(valorDisplay);

  const leadsFiltered = leadSearch && !leadId
    ? leads.filter((l) => l.nome.toLowerCase().includes(leadSearch.toLowerCase()) || l.telefone.includes(leadSearch))
    : [];

  function selectLead(lead: Lead) {
    setLeadId(lead.id);
    setLeadSearch(`${lead.nome} — ${lead.telefone}`);
    setClienteNome(lead.nome);
    setClienteTel(maskPhone(lead.telefone));
  }

  function toggleTipo(tipo: string) {
    setTiposErro(false);
    setTiposSelecionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  }

  async function handleSubmit(formData: FormData) {
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
          <input type="hidden" name="leadId" value={leadId} />

          {/* Lead vinculado — OBRIGATÓRIO */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Cliente (Lead Vinculado)</p>
            <div className="relative mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Buscar Lead *</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Busque pelo nome ou telefone do lead..."
                  value={leadSearch}
                  onChange={(e) => { setLeadSearch(e.target.value); setLeadId(""); setClienteNome(""); setClienteTel(""); }}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
              {leadsFiltered.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {leadsFiltered.map((l) => (
                    <button key={l.id} type="button" onClick={() => selectLead(l)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="font-medium text-[var(--brand-dark)]">{l.nome}</span>
                      <span className="text-gray-400 text-xs ml-2">{l.telefone}</span>
                    </button>
                  ))}
                </div>
              )}
              {leadId && <p className="text-xs text-green-600 mt-1 font-medium">✓ Lead vinculado — dados preenchidos automaticamente</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Cliente</label>
                <input name="clienteNome" type="text" required placeholder="Preenchido ao selecionar lead"
                  value={clienteNome} onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                <input name="clienteTel" type="tel" placeholder="(62) 9 9999-9999"
                  value={clienteTel} onChange={(e) => setClienteTel(maskPhone(e.target.value))}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

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
