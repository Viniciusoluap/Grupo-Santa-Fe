"use client";
// Paridade BPO (13/11): filtros de Cobranças, Despesas e A classificar e o painel de valores que acompanha o filtro.
// Gêmeo de Prospecta client/src/components/bpo/FiltrosBpo.tsx (regras em src/lib/financeiro/bpo-filtros.ts).
import { formatCurrency } from "@/lib/utils";
import { MESES_DRE } from "@/lib/financeiro/bpo-resultado";
import { FILTROS_VAZIOS, ROTULOS_STATUS, algumFiltro, type FiltrosTela, type StatusFiltro } from "@/lib/financeiro/bpo-filtros";
import type { CentroCustoOpcao } from "./centros-custo";

const cls = "mt-1 w-full min-w-0 border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 normal-case focus:outline-none focus:border-[var(--brand-yellow)]";

export function FiltrosBpo({ valor, onChange, anos, centros, semStatus = false, semCentro = false, extra }: {
  valor: FiltrosTela; onChange: (f: FiltrosTela) => void; anos: string[]; centros: CentroCustoOpcao[];
  semStatus?: boolean; semCentro?: boolean; extra?: React.ReactNode;
}) {
  const set = (p: Partial<FiltrosTela>) => onChange({ ...valor, ...p });
  return (
    <div className="grid grid-cols-1 gap-3 border border-gray-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="col-span-full block text-xs font-bold text-gray-500 uppercase lg:col-span-2">Busca
        <input aria-label="Busca" value={valor.busca} onChange={(e) => set({ busca: e.target.value })} placeholder="cliente, titular ou descrição" className={cls} />
      </label>
      <label className="block text-xs font-bold text-gray-500 uppercase">Mês (competência)
        <select aria-label="Mês" className={cls} value={valor.mes} onChange={(e) => set({ mes: e.target.value })}>
          <option value="">Todos os meses</option>
          {MESES_DRE.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-gray-500 uppercase">Ano
        <select aria-label="Ano" className={cls} value={valor.ano} onChange={(e) => set({ ano: e.target.value })}>
          <option value="">Todos os anos</option>
          {Array.from(new Set([...anos, ...(valor.ano ? [valor.ano] : [])])).sort().reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-gray-500 uppercase">Valor mínimo (R$)
        <input aria-label="Valor mínimo" inputMode="decimal" value={valor.valorMin} onChange={(e) => set({ valorMin: e.target.value })} placeholder="0,00" className={cls} />
      </label>
      <label className="block text-xs font-bold text-gray-500 uppercase">Valor máximo (R$)
        <input aria-label="Valor máximo" inputMode="decimal" value={valor.valorMax} onChange={(e) => set({ valorMax: e.target.value })} placeholder="igual ao mínimo = valor exato" className={cls} />
      </label>
      {!semStatus && <label className="block text-xs font-bold text-gray-500 uppercase">Status
        <select aria-label="Status" className={cls} value={valor.status} onChange={(e) => set({ status: e.target.value as StatusFiltro })}>
          {(Object.keys(ROTULOS_STATUS) as StatusFiltro[]).map((s) => <option key={s} value={s}>{ROTULOS_STATUS[s]}</option>)}
        </select>
      </label>}
      {!semCentro && <label className="block text-xs font-bold text-gray-500 uppercase">Centro de custo
        <select aria-label="Centro de custo do filtro" className={cls} value={valor.centroCusto} onChange={(e) => set({ centroCusto: e.target.value })}>
          <option value="">Todos</option>
          {centros.map((c) => <option key={c.id} value={c.nome}>{c.nome}{c.ativo ? "" : " (inativo)"}</option>)}
        </select>
      </label>}
      {extra}
      {algumFiltro(valor) && <div className="col-span-full"><button type="button" className="text-xs font-bold text-gray-600 underline" onClick={() => onChange(FILTROS_VAZIOS)}>Limpar filtros</button></div>}
    </div>
  );
}

/** Painel de valores do que está visível (acompanha os filtros). */
export function PainelValores({ resumo, despesa = false, vencido }: { resumo: { quantidade: number; total: number; recebido: number; emAberto: number }; despesa?: boolean; vencido?: number }) {
  const card = "min-w-0 bg-white border border-gray-100 p-4";
  const rot = "text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 [&_p]:break-words">
      <div className={card}><p className={rot}>Lançamentos</p><p className="font-black text-[var(--brand-dark)] text-lg leading-none">{resumo.quantidade}</p></div>
      <div className={card}><p className={rot}>Total</p><p className="font-black text-[var(--brand-dark)] text-lg leading-none">{formatCurrency(resumo.total)}</p></div>
      <div className={card}><p className={rot}>{despesa ? "Pago" : "Recebido"}</p><p className="font-black text-green-600 text-lg leading-none">{formatCurrency(resumo.recebido)}</p></div>
      <div className={card}><p className={rot}>Em aberto</p><p className="font-black text-yellow-600 text-lg leading-none">{formatCurrency(resumo.emAberto)}</p>
        {vencido ? <p className="mt-1 text-[10px] font-bold text-red-600">Vencido: {formatCurrency(vencido)}</p> : null}</div>
    </div>
  );
}
