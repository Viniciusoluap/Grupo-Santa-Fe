"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, PiggyBank } from "lucide-react";
import {
  calcularBusinessPlan,
  type FonteCaptacao,
  type PeriodoRemuneracao,
} from "@/lib/finance/captacao";
import { calcularLoteamento } from "@/lib/finance/loteamento";
import { salvarBusinessPlan } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";
import { montarPremissasLoteamento } from "./viabilidade-tab";

// Business Plan e Investidores (2.6 Novos Negócios) — simulação de captação
// com fundos/investidores, comparada ao investimento total (custo total)
// já apurado na Viabilidade (2.5), sem exigir que o usuário digite esse
// valor de novo.

interface Dados {
  fontes: FonteCaptacao[];
}

function defaults(): Dados {
  return { fontes: [] };
}

function novaFonte(): FonteCaptacao {
  return {
    id: Math.random().toString(36).slice(2),
    nome: "Novo investidor",
    capitalAportado: 0,
    remuneracaoPct: 1,
    periodoRemuneracao: "mensal",
    prazoResgateMeses: 24,
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function BusinessPlanTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.businessPlanJson) {
      try {
        const salvo = JSON.parse(estudo.businessPlanJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const investimentoTotal = useMemo(() => {
    const premissas = montarPremissasLoteamento(estudo);
    if (!premissas) return null;
    try {
      return calcularLoteamento(premissas).custoTotal;
    } catch {
      return null;
    }
  }, [estudo]);

  const resultado = useMemo(() => calcularBusinessPlan(dados.fontes, investimentoTotal), [dados, investimentoTotal]);

  function marcarAlterado() { setSalvo(false); }

  function addFonte() {
    setDados((d) => ({ fontes: [...d.fontes, novaFonte()] }));
    marcarAlterado();
  }
  function removerFonte(id: string) {
    setDados((d) => ({ fontes: d.fontes.filter((f) => f.id !== id) }));
    marcarAlterado();
  }
  function updFonte<K extends keyof FonteCaptacao>(id: string, campo: K, valor: FonteCaptacao[K]) {
    setDados((d) => ({ fontes: d.fontes.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) }));
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarBusinessPlan(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <PiggyBank size={13} /> Business Plan e Investidores
          </p>
          <button onClick={salvar} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Uma fonte de captação por linha (fundo, investidor-anjo, sócio capitalista). O investimento total comparado abaixo vem automaticamente do custo total já calculado na Viabilidade (2.5){investimentoTotal ? `: ${formatCurrency(investimentoTotal)}` : ", quando ela estiver preenchida"}.
        </p>
      </div>

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[680px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Fonte</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-28">Capital (R$)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-24">Remuneração (%)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-24">Período</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-24">Resgate (meses)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-28">Valor no resgate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.fontes.map((f) => {
                const r = resultado.fontes.find((x) => x.id === f.id);
                return (
                  <tr key={f.id}>
                    <td className="px-1 py-1"><input value={f.nome} onChange={(e) => updFonte(f.id, "nome", e.target.value)} className={inputCls} placeholder="Ex.: Fundo X" /></td>
                    <td className="px-1 py-1"><input type="number" value={f.capitalAportado || ""} onChange={(e) => updFonte(f.id, "capitalAportado", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                    <td className="px-1 py-1"><input type="number" step={0.1} value={f.remuneracaoPct} onChange={(e) => updFonte(f.id, "remuneracaoPct", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                    <td className="px-1 py-1">
                      <select value={f.periodoRemuneracao} onChange={(e) => updFonte(f.id, "periodoRemuneracao", e.target.value as PeriodoRemuneracao)} className={inputCls}>
                        <option value="mensal">Mensal</option>
                        <option value="anual">Anual</option>
                      </select>
                    </td>
                    <td className="px-1 py-1"><input type="number" value={f.prazoResgateMeses} onChange={(e) => updFonte(f.id, "prazoResgateMeses", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                    <td className="px-1 py-1 text-right font-bold text-[var(--brand-dark)]">{r ? formatCurrency(r.valorResgate) : "—"}</td>
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => removerFonte(f.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addFonte} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar fonte de captação
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Capital total captado" valor={formatCurrency(resultado.capitalTotalCaptado)} />
        <Kpi label="Custo total da captação" valor={formatCurrency(resultado.custoTotalCaptacao)} />
        <Kpi label="% do investimento total" valor={resultado.pctDoInvestimentoTotal != null ? `${resultado.pctDoInvestimentoTotal.toFixed(1)}%` : "—"} />
        <Kpi
          label="Capital próprio necessário"
          valor={resultado.capitalProprioNecessario != null ? formatCurrency(resultado.capitalProprioNecessario) : "—"}
          destaque
        />
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
