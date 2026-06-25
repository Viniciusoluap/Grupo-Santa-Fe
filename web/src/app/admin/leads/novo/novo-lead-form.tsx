"use client";

import { useState } from "react";
import Link from "next/link";
import { criarLead } from "@/lib/actions/leads";

const SERVICOS = [
  "Compra de imóvel",
  "Financiamento MCMV",
  "Financiamento Convencional",
  "Venda de imóvel",
  "Locação",
  "Obra e reforma",
  "Projeto de engenharia",
  "Regularização imobiliária",
  "Avaliação de imóvel",
  "Compra de lote",
  "Outro",
];

const ORIGENS = ["site", "whatsapp", "indicacao", "instagram", "facebook", "outro"];

interface Props {
  corretores: { id: string; nome: string }[];
}

export function NovoLeadForm({ corretores }: Props) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState(false);

  function toggle(s: string) {
    setSelecionados((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setErro(false);
  }

  async function handleSubmit(formData: FormData) {
    if (selecionados.length === 0) {
      setErro(true);
      return;
    }
    selecionados.forEach((s) => formData.append("servicos", s));
    await criarLead(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo *</label>
          <input
            type="text"
            name="nome"
            required
            placeholder="Nome do lead"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone / WhatsApp *</label>
          <input
            type="tel"
            name="telefone"
            required
            placeholder="(94) 9 9999-9999"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
          <input
            type="email"
            name="email"
            placeholder="email@exemplo.com"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Senha de Acesso</label>
          <input
            type="text"
            name="senha"
            placeholder="Senha para acesso do cliente"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
            <input
              type="number"
              name="orcamento"
              placeholder="0"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Origem</label>
          <select
            name="origem"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none capitalize"
          >
            {ORIGENS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Corretor Responsável</label>
          <select
            name="corretorId"
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
          >
            <option value="">Sem corretor</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Serviços — multi-seleção */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Serviços de Interesse *
          <span className="ml-2 text-[10px] text-gray-400 normal-case font-normal">(selecione um ou mais)</span>
        </label>
        {erro && (
          <p className="text-red-500 text-xs mb-2">Selecione pelo menos um serviço.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICOS.map((s) => {
            const ativo = selecionados.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`text-left text-xs font-medium px-3 py-2 border transition-colors ${
                  ativo
                    ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/10 text-[var(--brand-dark)] font-bold"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50"
                }`}
              >
                {ativo && <span className="mr-1">✓</span>}
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
        <textarea
          name="notas"
          rows={3}
          placeholder="Informações adicionais sobre o lead..."
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          type="submit"
          className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
        >
          Cadastrar Lead
        </button>
        <Link
          href="/admin/leads"
          className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
