"use client";

import { useRef, useState } from "react";
import { criarContrato } from "@/lib/actions/contratos";

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface Empresa {
  razaoSocial: string;
  cnpj: string;
}

interface Props {
  leads: Lead[];
  empresa: Empresa;
}

const TIPOS_CONTRATO = [
  { value: "compra_venda",             label: "Compra e Venda" },
  { value: "locacao",                  label: "Locação" },
  { value: "permuta",                  label: "Permuta" },
  { value: "comodato",                 label: "Comodato" },
  { value: "assessoria_imobiliaria",   label: "Assessoria Imobiliária" },
  { value: "administracao_imovel",     label: "Administração de Imóvel" },
  { value: "avaliacao_imobiliaria",    label: "Avaliação Imobiliária" },
  { value: "regularizacao_imovel",     label: "Regularização de Imóvel" },
  { value: "financiamento_imobiliario",label: "Financiamento Imobiliário" },
  { value: "bpo_financeiro",           label: "BPO Financeiro" },
  { value: "prestacao_servicos",       label: "Prestação de Serviços" },
  { value: "consultoria_juridica",     label: "Consultoria Jurídica" },
  { value: "parceria",                 label: "Parceria" },
  { value: "outro",                    label: "Outro" },
];

type ParteKey = "A" | "B";

function ParteSearch({
  parteKey,
  label,
  leads,
  empresa,
}: {
  parteKey: ParteKey;
  label: string;
  leads: Lead[];
  empresa: Empresa;
}) {
  const [search, setSearch] = useState("");
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [showList, setShowList] = useState(false);

  const filtrados = search.length >= 2
    ? leads.filter((l) =>
        l.nome.toLowerCase().includes(search.toLowerCase()) ||
        (l.telefone ?? "").includes(search) ||
        (l.email ?? "").toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  function selectLead(lead: Lead) {
    setNome(lead.nome);
    setDoc("");
    setSearch(lead.nome);
    setShowList(false);
  }

  function selectEmpresa() {
    setNome(empresa.razaoSocial);
    setDoc(empresa.cnpj);
    setSearch(empresa.razaoSocial);
    setShowList(false);
  }

  return (
    <div className="relative">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
        {label} *
      </label>
      <input
        type="text"
        placeholder="Buscar lead ou digitar nome..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setNome(e.target.value);
          setDoc("");
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 180)}
        required
        className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
      />
      {showList && (search.length >= 2 || search === "") && (
        <div className="absolute z-40 left-0 right-0 bg-white border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {/* Company option */}
          <button
            type="button"
            onMouseDown={selectEmpresa}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--brand-yellow)]/10 border-b border-gray-100 font-medium text-[var(--brand-dark)]"
          >
            🏢 {empresa.razaoSocial} (empresa)
            {empresa.cnpj && <span className="text-gray-400 ml-2 font-normal text-xs">{empresa.cnpj}</span>}
          </button>
          {filtrados.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onMouseDown={() => selectLead(lead)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{lead.nome}</span>
              {lead.telefone && <span className="text-gray-400 ml-2 text-xs">{lead.telefone}</span>}
            </button>
          ))}
          {filtrados.length === 0 && search.length >= 2 && (
            <p className="px-3 py-2 text-xs text-gray-400">Nenhum lead encontrado — usando nome digitado</p>
          )}
        </div>
      )}
      {/* Hidden name for form submission */}
      <input type="hidden" name={`parte${parteKey}`} value={nome || search} />
      {/* Doc field: auto-filled (hidden) or manual */}
      {doc ? (
        <>
          <input type="hidden" name={`parte${parteKey}Doc`} value={doc} />
          <p className="text-xs text-gray-400 mt-1">Doc: {doc}</p>
        </>
      ) : (
        <input
          type="text"
          name={`parte${parteKey}Doc`}
          placeholder={`CPF/CNPJ — ${label}`}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 mt-2"
        />
      )}
    </div>
  );
}

export function JuridicoNovoContrato({ leads, empresa }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={criarContrato} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo *</label>
        <select
          name="tipo"
          required
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        >
          {TIPOS_CONTRATO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 lg:col-span-1">
        <ParteSearch parteKey="A" label="Parte A (Contratante)" leads={leads} empresa={empresa} />
      </div>

      <div className="sm:col-span-2 lg:col-span-1">
        <ParteSearch parteKey="B" label="Parte B (Contratado)" leads={leads} empresa={empresa} />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
        <input
          name="valor"
          type="number"
          step="0.01"
          required
          placeholder="Ex: 350000"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento</label>
        <input
          name="vencimento"
          type="date"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
        <input
          name="descricao"
          type="text"
          placeholder="Resumo do contrato..."
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
        <button
          type="submit"
          className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
        >
          Criar Contrato
        </button>
      </div>
    </form>
  );
}
