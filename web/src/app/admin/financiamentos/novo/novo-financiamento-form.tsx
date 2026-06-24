"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { TIPO_CONFIG, BANCO_CONFIG } from "@/lib/types/financiamento";
import { criarFinanciamento } from "@/lib/actions/financiamentos";
import { SubmitButton } from "@/components/ui/submit-button";

type Lead = { id: string; nome: string; telefone: string; email: string | null };
type Imovel = { id: string; titulo: string; bairro: string; cidade: string };

interface Props {
  leads: Lead[];
  imoveis: Imovel[];
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

function CurrencyInput({ name, placeholder }: { name: string; placeholder?: string }) {
  const [display, setDisplay] = useState("");
  const raw = currencyToFloat(display);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder ?? "0,00"}
        onChange={(e) => setDisplay(maskCurrency(e.target.value))}
        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
      />
      <input type="hidden" name={name} value={raw} />
    </div>
  );
}

export function NovoFinanciamentoForm({ leads, imoveis }: Props) {
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const [imovelTipo, setImovelTipo] = useState<"existente" | "manual">("manual");
  const [imovelId, setImovelId] = useState("");
  const [imovelSearch, setImovelSearch] = useState("");
  const [imovelManual, setImovelManual] = useState("");

  function selectLead(lead: Lead) {
    setLeadId(lead.id);
    setLeadSearch(`${lead.nome} — ${lead.telefone}`);
    setNome(lead.nome);
    setTelefone(maskPhone(lead.telefone));
    setEmail(lead.email ?? "");
  }

  function selectImovel(im: Imovel) {
    setImovelId(im.id);
    setImovelSearch(`${im.titulo} — ${im.bairro}`);
    setImovelManual(im.titulo);
  }

  const leadsFiltered = leadSearch && !leadId
    ? leads.filter((l) => l.nome.toLowerCase().includes(leadSearch.toLowerCase()) || l.telefone.includes(leadSearch))
    : [];

  const imoveisFiltered = imovelSearch && !imovelId && imovelTipo === "existente"
    ? imoveis.filter((i) => i.titulo.toLowerCase().includes(imovelSearch.toLowerCase()) || i.bairro.toLowerCase().includes(imovelSearch.toLowerCase()))
    : [];

  const imovelValue = imovelTipo === "existente" ? imovelManual : imovelManual;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/financiamentos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Financiamentos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Novo Financiamento</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={criarFinanciamento} className="space-y-5">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="imovelVinculadoId" value={imovelId} />

          {/* Lead vinculado */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Lead Vinculado</p>
            <div className="relative">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Buscar Lead *</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Busque pelo nome ou telefone do lead..."
                  value={leadSearch}
                  onChange={(e) => { setLeadSearch(e.target.value); setLeadId(""); setNome(""); setTelefone(""); setEmail(""); }}
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
              {leadId && (
                <p className="text-xs text-green-600 mt-1 font-medium">✓ Lead vinculado — dados preenchidos automaticamente</p>
              )}
            </div>
          </div>

          {/* Dados do Cliente */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Dados do Cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Cliente *</label>
                <input name="clienteNome" type="text" required placeholder="Nome completo"
                  value={nome} onChange={(e) => setNome(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                <input name="clienteTel" type="tel" placeholder="(62) 9 9999-9999"
                  value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
                <input name="clienteEmail" type="email" placeholder="email@exemplo.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
                <input name="clienteCpf" type="text" placeholder="000.000.000-00"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

          {/* Imóvel */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Imóvel</p>
            <div className="flex gap-3 mb-3">
              <button type="button" onClick={() => { setImovelTipo("existente"); setImovelId(""); setImovelSearch(""); setImovelManual(""); }}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-colors ${imovelTipo === "existente" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                Vincular imóvel do sistema
              </button>
              <button type="button" onClick={() => { setImovelTipo("manual"); setImovelId(""); setImovelSearch(""); }}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-colors ${imovelTipo === "manual" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                Informar manualmente
              </button>
            </div>

            {imovelTipo === "existente" ? (
              <div className="relative">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Busque pelo título ou bairro..."
                    value={imovelSearch}
                    onChange={(e) => { setImovelSearch(e.target.value); setImovelId(""); setImovelManual(""); }}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                {imoveisFiltered.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {imoveisFiltered.map((im) => (
                      <button key={im.id} type="button" onClick={() => selectImovel(im)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <span className="font-medium text-[var(--brand-dark)]">{im.titulo}</span>
                        <span className="text-gray-400 text-xs ml-2">{im.bairro} — {im.cidade}</span>
                      </button>
                    ))}
                  </div>
                )}
                {imovelId && <p className="text-xs text-green-600 mt-1 font-medium">✓ Imóvel vinculado</p>}
                <input type="hidden" name="imovel" value={imovelManual} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome / Endereço do Imóvel *</label>
                <input name="imovel" type="text" required placeholder="Ex: Apto 302, Residencial Aurora"
                  value={imovelManual} onChange={(e) => setImovelManual(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            )}
          </div>

          {/* Tipo e Banco */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Tipo e Banco</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Financiamento *</label>
                <select name="tipo" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione...</option>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banco / Convênio *</label>
                <select name="banco" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione...</option>
                  {Object.entries(BANCO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Valores</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Imóvel *</label>
                <CurrencyInput name="valorImovel" placeholder="280.000,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Financiamento *</label>
                <CurrencyInput name="valorFinanciado" placeholder="250.000,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Entrada</label>
                <CurrencyInput name="entrada" placeholder="30.000,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Taxa de Juros (% a.a.) *</label>
                <input name="taxa" type="number" step="0.01" required placeholder="8,5"
                  className="w-full px-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo (meses) *</label>
                <input name="prazo" type="number" required placeholder="360"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Cadastrando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cadastrar Financiamento
            </SubmitButton>
            <Link href="/admin/financiamentos" className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
