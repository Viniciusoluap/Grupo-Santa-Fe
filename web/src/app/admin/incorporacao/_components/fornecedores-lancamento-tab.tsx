"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Store } from "lucide-react";
import {
  resumoFornecedoresLancamento,
  CATEGORIAS_FORNECEDOR,
  type CategoriaFornecedor,
  type FornecedorLancamento,
  type StatusFornecedor,
} from "@/lib/incorporacao/fornecedores-lancamento";
import { salvarFornecedoresLancamento } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Contratação de Fornecedores (4.2 Lançamento, Marketing e Vendas) —
// gestão dos fornecedores de marketing, estande de vendas, decoração e
// eventos do lançamento.

const STATUS: { value: StatusFornecedor; label: string }[] = [
  { value: "nao_contratado", label: "Não contratado" },
  { value: "orcamento", label: "Em orçamento" },
  { value: "contratado", label: "Contratado" },
  { value: "entregue", label: "Entregue" },
];

interface Dados {
  fornecedores: FornecedorLancamento[];
}

function defaults(): Dados {
  return { fornecedores: [] };
}

function novoFornecedor(): FornecedorLancamento {
  return {
    id: Math.random().toString(36).slice(2),
    categoria: "Agência de Publicidade",
    nome: "",
    valorContratado: 0,
    status: "nao_contratado",
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function FornecedoresLancamentoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.fornecedoresLancamentoJson) {
      try {
        const salvo = JSON.parse(estudo.fornecedoresLancamentoJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoFornecedoresLancamento(dados.fornecedores), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addFornecedor() {
    setDados((d) => ({ fornecedores: [...d.fornecedores, novoFornecedor()] }));
    marcarAlterado();
  }
  function removerFornecedor(id: string) {
    setDados((d) => ({ fornecedores: d.fornecedores.filter((f) => f.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof FornecedorLancamento>(id: string, campo: K, valor: FornecedorLancamento[K]) {
    setDados((d) => ({ fornecedores: d.fornecedores.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarFornecedoresLancamento(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Store size={13} /> Contratação de Fornecedores
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um fornecedor por linha. A etapa fica concluída quando todos os fornecedores cadastrados estiverem contratados.
        </p>
      </div>

      {dados.fornecedores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Fornecedores" valor={String(resumo.total)} />
          <Kpi label="Contratados" valor={`${resumo.pctContratado}%`} />
          <Kpi label="Valor total contratado" valor={formatCurrency(resumo.valorTotalContratado)} destaque />
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[680px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-44">Categoria</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Fornecedor</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Contato</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-28">Valor (R$)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.fornecedores.map((f) => (
                <tr key={f.id}>
                  <td className="px-1 py-1">
                    <select value={f.categoria} onChange={(e) => upd(f.id, "categoria", e.target.value as CategoriaFornecedor)} className={inputCls}>
                      {CATEGORIAS_FORNECEDOR.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={f.nome} onChange={(e) => upd(f.id, "nome", e.target.value)} className={inputCls} placeholder="Nome" /></td>
                  <td className="px-1 py-1"><input value={f.contato ?? ""} onChange={(e) => upd(f.id, "contato", e.target.value)} className={inputCls} placeholder="Telefone/e-mail" /></td>
                  <td className="px-1 py-1"><input type="number" value={f.valorContratado || ""} onChange={(e) => upd(f.id, "valorContratado", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                  <td className="px-1 py-1">
                    <select value={f.status} onChange={(e) => upd(f.id, "status", e.target.value as StatusFornecedor)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerFornecedor(f.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addFornecedor} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar fornecedor
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
