"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Wallet, AlertTriangle } from "lucide-react";
import {
  resumoOrcamentoObra,
  CATEGORIAS_ORCAMENTO_OBRA,
  type CategoriaOrcamentoObra,
  type ItemOrcamentoObra,
} from "@/lib/incorporacao/orcamento-obra";
import { resumoOrcamentoPreliminar, type ItemOrcamentoPreliminar } from "@/lib/incorporacao/orcamento-preliminar";
import { salvarOrcamentoObra } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Orçamentos (5.2 Projetos Executivos e Obras) — orçamento executivo real
// da obra, reconciliado automaticamente com o orçamento preliminar (3.5).

interface Dados {
  itens: ItemOrcamentoObra[];
}

function defaults(): Dados {
  return { itens: [] };
}

function novoItem(): ItemOrcamentoObra {
  return { id: Math.random().toString(36).slice(2), categoria: "Estrutura", valorOrcado: 0, valorRealizado: 0 };
}

function totalOrcamentoPreliminarDoEstudo(estudo: EstudoData): number | null {
  if (!estudo.orcamentoPreliminarJson) return null;
  try {
    const salvo = JSON.parse(estudo.orcamentoPreliminarJson) as { itens?: ItemOrcamentoPreliminar[] };
    const r = resumoOrcamentoPreliminar(salvo.itens ?? []);
    return r.totalOrcado > 0 ? r.totalOrcado : null;
  } catch {
    return null;
  }
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function OrcamentoObraTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.orcamentoObraJson) {
      try {
        const salvo = JSON.parse(estudo.orcamentoObraJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const referencia = useMemo(() => totalOrcamentoPreliminarDoEstudo(estudo), [estudo]);
  const resumo = useMemo(() => resumoOrcamentoObra(dados.itens, referencia), [dados, referencia]);

  function marcarAlterado() { setSalvo(false); }

  function addItem() {
    setDados((d) => ({ itens: [...d.itens, novoItem()] }));
    marcarAlterado();
  }
  function removerItem(id: string) {
    setDados((d) => ({ itens: d.itens.filter((i) => i.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ItemOrcamentoObra>(id: string, campo: K, valor: ItemOrcamentoObra[K]) {
    setDados((d) => ({ itens: d.itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarOrcamentoObra(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Wallet size={13} /> Orçamentos (execução da obra)
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um item por disciplina, com o orçado e o realizado até o momento. O total orçado é reconciliado automaticamente com o Orçamento Preliminar (3.5){referencia ? `: ${formatCurrency(referencia)}` : ", quando ele estiver preenchido"}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total orçado" valor={formatCurrency(resumo.totalOrcado)} />
        <Kpi label="Total realizado" valor={formatCurrency(resumo.totalRealizado)} />
        <Kpi label="% executado" valor={`${resumo.pctExecutado}%`} destaque />
        <Kpi label="Variação vs. preliminar" valor={resumo.variacaoVsPreliminarPct != null ? `${resumo.variacaoVsPreliminarPct > 0 ? "+" : ""}${resumo.variacaoVsPreliminarPct}%` : "—"} negativo={resumo.variacaoVsPreliminarPct != null && Math.abs(resumo.variacaoVsPreliminarPct) > 15} />
      </div>

      {resumo.variacaoVsPreliminarPct != null && Math.abs(resumo.variacaoVsPreliminarPct) > 15 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            O orçamento executivo diverge {Math.abs(resumo.variacaoVsPreliminarPct)}% do orçamento preliminar (3.5) — revise os itens.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[600px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Categoria</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Orçado (R$)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Realizado (R$)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-1 py-1">
                    <select value={item.categoria} onChange={(e) => upd(item.id, "categoria", e.target.value as CategoriaOrcamentoObra)} className={inputCls}>
                      {CATEGORIAS_ORCAMENTO_OBRA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="number" value={item.valorOrcado || ""} onChange={(e) => upd(item.id, "valorOrcado", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                  <td className="px-1 py-1"><input type="number" value={item.valorRealizado || ""} onChange={(e) => upd(item.id, "valorRealizado", parseFloat(e.target.value) || 0)} className={numCls} /></td>
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
