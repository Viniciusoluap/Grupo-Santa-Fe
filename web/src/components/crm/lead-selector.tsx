"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, UserCheck, Mail, Phone, X, UserPlus } from "lucide-react";
import { formatTelefone } from "@/lib/utils";

export type LeadOpcao = { id: string; nome: string; telefone: string; email: string | null };

interface Props {
  leads: LeadOpcao[];
  /** Lead selecionado (controlado pelo formulário pai). */
  leadId: string;
  onChange: (leadId: string) => void;
  /** Mostra a mensagem de obrigatoriedade (o pai seta ao tentar enviar sem lead). */
  erro?: boolean;
  titulo?: string;
}

/**
 * Seletor de cliente do CRM (EPIC-007). Substitui o cadastro manual de cliente
 * nos serviços: o serviço só pode ser aberto para um lead já cadastrado, e os
 * dados do cliente (nome, telefone, e-mail) vêm do lead — exibidos aqui apenas
 * para conferência, copiados no servidor a partir do próprio lead.
 */
export function LeadSelector({ leads, leadId, onChange, erro, titulo = "Cliente (lead do CRM)" }: Props) {
  const [busca, setBusca] = useState("");
  const selecionado = leads.find((l) => l.id === leadId) ?? null;

  const q = busca.trim().toLowerCase();
  const qDigitos = busca.replace(/\D/g, "");
  const filtrados = q
    ? leads
        .filter(
          (l) =>
            l.nome.toLowerCase().includes(q) ||
            (qDigitos.length > 0 && l.telefone.replace(/\D/g, "").includes(qDigitos)),
        )
        .slice(0, 30)
    : [];

  return (
    <div>
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">{titulo} *</p>

      {selecionado ? (
        <div className="border border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 font-bold text-[var(--brand-dark)] text-sm">
                <UserCheck size={14} className="text-[var(--brand-yellow)] shrink-0" />
                <span className="truncate">{selecionado.nome}</span>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone size={11} className="shrink-0" /> {formatTelefone(selecionado.telefone) || "Sem telefone"}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Mail size={11} className="shrink-0" /> {selecionado.email || "Sem e-mail"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { onChange(""); setBusca(""); }}
              className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={12} /> Trocar
            </button>
          </div>
          <p className="text-[11px] text-green-700 mt-3">
            ✓ Dados do cliente vindos do CRM — sem recadastro. Para corrigir, edite o lead.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Busque o cliente pelo nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 border text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 ${erro ? "border-red-300" : "border-gray-200"}`}
            />
          </div>
          {filtrados.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg mt-1 max-h-56 overflow-y-auto">
              {filtrados.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { onChange(l.id); setBusca(""); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <span className="font-medium text-[var(--brand-dark)]">{l.nome}</span>
                  <span className="text-gray-400 text-xs ml-2">{formatTelefone(l.telefone)}</span>
                </button>
              ))}
            </div>
          )}
          {q && filtrados.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Nenhum lead encontrado.</p>
          )}
          {erro && <p className="text-red-500 text-xs mt-1">Selecione o cliente no CRM para abrir o serviço.</p>}
          <Link
            href="/admin/leads/novo"
            className="inline-flex items-center gap-1 text-xs text-[var(--brand-dark)] font-bold hover:underline mt-2"
          >
            <UserPlus size={12} /> Cliente ainda não está no CRM? Cadastre o lead primeiro
          </Link>
        </div>
      )}
    </div>
  );
}
