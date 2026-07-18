"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, PartyPopper } from "lucide-react";
import {
  resumoLancamentoImobiliario,
  type VendaLancamento,
} from "@/lib/incorporacao/lancamento-imobiliario";
import { calcularMix, type ItemMixProduto } from "@/lib/finance/loteamento";
import { salvarLancamentoImobiliario } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Lançamento Imobiliário (4.4 Lançamento, Marketing e Vendas) — painel do
// evento de lançamento, comparando as vendas realizadas com o mix
// projetado na Viabilidade/Estudo de Massa (2.3/2.5).

interface Dados {
  vendas: VendaLancamento[];
}

function defaults(): Dados {
  return { vendas: [] };
}

function novaVenda(): VendaLancamento {
  return { id: Math.random().toString(36).slice(2), unidade: "", valorVenda: 0 };
}

function projecaoDoMix(estudo: EstudoData): { totalUnidades: number | null; vgv: number | null } {
  if (!estudo.mixJson) return { totalUnidades: null, vgv: null };
  try {
    const itens = JSON.parse(estudo.mixJson) as ItemMixProduto[];
    if (!Array.isArray(itens) || itens.length === 0) return { totalUnidades: null, vgv: null };
    const r = calcularMix(itens);
    return { totalUnidades: r.totalUnidades, vgv: r.vgv };
  } catch {
    return { totalUnidades: null, vgv: null };
  }
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function LancamentoImobiliarioTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.lancamentoImobiliarioJson) {
      try {
        const salvo = JSON.parse(estudo.lancamentoImobiliarioJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const projecao = useMemo(() => projecaoDoMix(estudo), [estudo]);
  const resumo = useMemo(
    () => resumoLancamentoImobiliario(dados.vendas, projecao.totalUnidades, projecao.vgv),
    [dados, projecao]
  );

  function marcarAlterado() { setSalvo(false); }

  function addVenda() {
    setDados((d) => ({ vendas: [...d.vendas, novaVenda()] }));
    marcarAlterado();
  }
  function removerVenda(id: string) {
    setDados((d) => ({ vendas: d.vendas.filter((v) => v.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof VendaLancamento>(id: string, campo: K, valor: VendaLancamento[K]) {
    setDados((d) => ({ vendas: d.vendas.map((v) => (v.id === id ? { ...v, [campo]: valor } : v)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarLancamentoImobiliario(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <PartyPopper size={13} /> Lançamento Imobiliário
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Registre as vendas realizadas no evento de lançamento. A comparação com o mix projetado (2.3) vem automaticamente
          {projecao.totalUnidades ? `: ${projecao.totalUnidades} unidades / ${formatCurrency(projecao.vgv ?? 0)}` : ", quando o mix estiver preenchido"}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Unidades vendidas" valor={String(resumo.unidadesVendidas)} />
        <Kpi label="VGV vendido" valor={formatCurrency(resumo.vgvVendido)} />
        <Kpi label="% unidades vs. projetado" valor={resumo.pctUnidadesVendidas != null ? `${resumo.pctUnidadesVendidas}%` : "—"} />
        <Kpi label="% VGV vs. projetado" valor={resumo.pctVgvVendido != null ? `${resumo.pctVgvVendido}%` : "—"} destaque />
      </div>

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[600px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Unidade</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-44">Comprador</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Valor (R$)</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Data</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.vendas.map((v) => (
                <tr key={v.id}>
                  <td className="px-1 py-1"><input value={v.unidade} onChange={(e) => upd(v.id, "unidade", e.target.value)} className={inputCls} placeholder="Ex.: Lote 12" /></td>
                  <td className="px-1 py-1"><input value={v.comprador ?? ""} onChange={(e) => upd(v.id, "comprador", e.target.value)} className={inputCls} placeholder="Nome do comprador" /></td>
                  <td className="px-1 py-1"><input type="number" value={v.valorVenda || ""} onChange={(e) => upd(v.id, "valorVenda", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                  <td className="px-1 py-1"><input type="date" value={v.data ?? ""} onChange={(e) => upd(v.id, "data", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerVenda(v.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addVenda} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar venda
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
