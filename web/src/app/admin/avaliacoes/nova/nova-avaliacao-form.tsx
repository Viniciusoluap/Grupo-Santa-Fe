"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { criarAvaliacao } from "@/lib/actions/avaliacoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";

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

export function NovaAvaliacaoForm({ leads }: Props) {
  const [leadSearch, setLeadSearch] = useState("");
  const [leadId, setLeadId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  const leadsFiltered = leadSearch && !leadId
    ? leads.filter((l) =>
        l.nome.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.telefone.includes(leadSearch)
      )
    : [];

  function selectLead(lead: Lead) {
    setLeadId(lead.id);
    setLeadSearch(`${lead.nome} — ${lead.telefone}`);
    setNome(lead.nome);
    setTelefone(maskPhone(lead.telefone));
    setEmail(lead.email ?? "");
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/avaliacoes" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)] mb-2">
          <ArrowLeft size={14} /> Avaliações
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">Nova Avaliação</h1>
      </div>

      <form action={criarAvaliacao} className="bg-white border border-gray-100 p-6 space-y-6">
        {/* Lead vinculado */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lead Vinculado <span className="font-normal text-gray-400">(opcional)</span></p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Busque pelo nome ou telefone do lead..."
              value={leadSearch}
              onChange={(e) => {
                setLeadSearch(e.target.value);
                setLeadId("");
                setNome("");
                setTelefone("");
                setEmail("");
              }}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
            />
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

        {/* Tipo e finalidade */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tipo de Avaliação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Laudo *</label>
              <select name="tipo" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="mercado">Avaliação de Mercado</option>
                <option value="locacao">Avaliação para Locação</option>
                <option value="judicial">Avaliação Judicial</option>
                <option value="parecer_tecnico">Parecer Técnico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Finalidade *</label>
              <select name="finalidade" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="compra_venda">Compra e Venda</option>
                <option value="locacao">Locação</option>
                <option value="judicial">Processo Judicial</option>
                <option value="garantia">Garantia Bancária</option>
                <option value="inventario">Inventário</option>
                <option value="seguro">Seguro Patrimonial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Metodologia</label>
              <select name="metodologia" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="comparativo">Método Comparativo</option>
                <option value="renda">Método da Renda</option>
                <option value="custo">Método do Custo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Avaliador Responsável *</label>
              <input name="avaliador" type="text" required placeholder="Nome do avaliador / CREA"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dados do Solicitante</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo *</label>
              <input name="clienteNome" type="text" required placeholder="Nome do solicitante"
                value={nome} onChange={(e) => setNome(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
              <input name="clienteCpf" type="text" placeholder="000.000.000-00"
                value={cpf} onChange={(e) => setCpf(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone *</label>
              <PhoneInput name="clienteTel" required defaultValue={telefone} key={telefone}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
              <input name="clienteEmail" type="email" placeholder="email@exemplo.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Imóvel */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dados do Imóvel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
              <input name="endereco" type="text" required placeholder="Rua, número, complemento"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bairro *</label>
              <input name="bairro" type="text" required placeholder="Bairro"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cidade</label>
              <input name="cidade" type="text" defaultValue="Canaã dos Carajás"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área Construída (m²)</label>
              <input name="areaConstruida" type="number" step="0.01" placeholder="Ex: 120"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área do Terreno (m²)</label>
              <input name="areaTerreno" type="number" step="0.01" placeholder="Ex: 300"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Quartos</label>
              <input name="quartos" type="number" min="0" placeholder="0"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banheiros</label>
              <input name="banheiros" type="number" min="0" placeholder="0"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data da Vistoria</label>
            <input name="dataVistoria" type="date"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo de Entrega</label>
            <input name="prazoEntrega" type="date"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
        </div>

        {/* Valor do Serviço */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cobrança do Serviço</p>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Serviço (R$)</label>
            <input name="valorServico" type="number" step="0.01" min="0" placeholder="Ex: 1500,00"
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            <p className="text-[10px] text-gray-400 mt-1">Ao marcar a avaliação como entregue, uma cobrança será criada automaticamente no BPO Financeiro.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
          <textarea name="observacoes" rows={3} placeholder="Informações adicionais sobre o imóvel ou solicitação..."
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <SubmitButton
            pendingText="Salvando..."
            className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Abrir Avaliação
          </SubmitButton>
          <Link href="/admin/avaliacoes" className="px-4 py-2.5 border border-gray-200 text-xs font-bold uppercase text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
