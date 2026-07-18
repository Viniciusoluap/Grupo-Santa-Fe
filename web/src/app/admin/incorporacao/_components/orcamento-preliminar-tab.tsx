"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Wallet, AlertTriangle } from "lucide-react";
import {
  resumoOrcamentoPreliminar,
  CATEGORIAS_ORCAMENTO_PRELIMINAR,
  type CategoriaOrcamentoPreliminar,
  type ItemOrcamentoPreliminar,
} from "@/lib/incorporacao/orcamento-preliminar";
import { calcularOrcamentoParametrizado, type PremissasOrcamentoParametrizado } from "@/lib/orcamento/parametrizado";
import { salvarOrcamentoPreliminar } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Orçamento Preliminar e EVE (3.5 Incorporação e Produto) — orçamento de
// obra detalhado por disciplina, reconciliado com o custo total já
// calculado no Orçamento Parametrizado (2.4).

interface Dados {
  itens: ItemOrcamentoPreliminar[];
}

function defaults(): Dados {
  return { itens: [] };
}

function novoItem(): ItemOrcamentoPreliminar {
  return { id: Math.random().toString(36).slice(2), categoria: "Estrutura", valorOrcado: 0 };
}

function custoParametrizadoDoEstudo(estudo: EstudoData): number | null {
  if (!estudo.orcamentoParametrizadoJson) return null;
  try {
    const salvo = JSON.parse(estudo.orcamentoParametrizadoJson) as PremissasOrcamentoParametrizado;
    const r = calcularOrcamentoParametrizado(salvo);
    return r.custoTotal > 0 ? r.custoTotal : null;
  } catch {
    return null;
  }
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function OrcamentoPreliminarTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.orcamentoPreliminarJson) {
      try {
        const salvo = JSON.parse(estudo.orcamentoPreliminarJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const referencia = useMemo(() => custoParametrizadoDoEstudo(estudo), [estudo]);
  const resumo = useMemo(() => resumoOrcamentoPreliminar(dados.itens, referencia), [dados, referencia]);

  function marcarAlterado() { setSalvo(false); }

  function addItem() {
    setDados((d) => ({ itens: [...d.itens, novoItem()] }));
    marcarAlterado();
  }
  function removerItem(id: string) {
    setDados((d) => ({ itens: d.itens.filter((i) => i.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ItemOrcamentoPreliminar>(id: string, campo: K, valor: ItemOrcamentoPreliminar[K]) {
    setDados((d) => ({ itens: d.itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarOrcamentoPreliminar(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Wallet size={13} /> Orçamento Preliminar e EVE
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um item por disciplina. O total é reconciliado automaticamente com o custo total já calculado no Orçamento Parametrizado (2.4){referencia ? `: ${formatCurrency(referencia)}` : ", quando ele estiver preenchido"}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total orçado (preliminar)" valor={formatCurrency(resumo.totalOrcado)} destaque />
        <Kpi label="Referência (Orçamento Parametrizado)" valor={resumo.custoParametrizadoReferencia ? formatCurrency(resumo.custoParametrizadoReferencia) : "—"} />
        <Kpi label="Variação vs. referência" valor={resumo.variacaoPct != null ? `${resumo.variacaoPct > 0 ? "+" : ""}${resumo.variacaoPct}%` : "—"} negativo={resumo.variacaoPct != null && Math.abs(resumo.variacaoPct) > 15} />
      </div>

      {resumo.variacaoPct != null && Math.abs(resumo.variacaoPct) > 15 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            O orçamento preliminar diverge {Math.abs(resumo.variacaoPct)}% do custo parametrizado usado na Viabilidade — revise os itens ou atualize as premissas de custo em 2.4/2.5.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[600px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Categoria</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Valor orçado (R$)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Observações</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-1 py-1">
                    <select value={item.categoria} onChange={(e) => upd(item.id, "categoria", e.target.value as CategoriaOrcamentoPreliminar)} className={inputCls}>
                      {CATEGORIAS_ORCAMENTO_PRELIMINAR.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="number" value={item.valorOrcado || ""} onChange={(e) => upd(item.id, "valorOrcado", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                  <td className="px-1 py-1"><input value={item.observacoes ?? ""} onChange={(e) => upd(item.id, "observacoes", e.target.value)} className={inputCls} placeholder="Observações" /></td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerItem(item.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar item
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque, negativo }: { label: string; valor: string; destaque?: boolean; negativo?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : negativo ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
