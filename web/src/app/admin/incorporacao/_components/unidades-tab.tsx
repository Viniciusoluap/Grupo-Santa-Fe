"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NumeroBRField } from "@/components/ui/numero-br-field";
import { listarUnidades, criarUnidade, mudarEstadoUnidade, conciliarVendaLegada } from "@/lib/actions/unidades-incorporacao";

type Snapshot = Awaited<ReturnType<typeof listarUnidades>>;
const input = "min-w-0 w-full border border-gray-300 px-2 py-2 text-sm";
const action = "border border-[var(--brand-dark)] px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function UnidadesTab({ estudoId }: { estudoId: string }) {
  const router = useRouter(); const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  const [code, setCode] = useState(""); const [kind, setKind] = useState("lote");
  const [buyers, setBuyers] = useState<Record<string, string>>({}); const [prices, setPrices] = useState<Record<string, number>>({});
  const refresh = useCallback(() => { void listarUnidades(estudoId).then(setData).catch((e: Error) => setError(e.message)); }, [estudoId]);
  useEffect(() => { refresh(); }, [refresh]);
  function run(actionFn: () => Promise<unknown>) {
    setError(""); start(async () => { try { await actionFn(); refresh(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Operação falhou."); refresh(); } });
  }
  const counters = { disponivel: 0, reservada: 0, vendida: 0 };
  for (const unit of data?.unidades ?? []) counters[unit.status as keyof typeof counters]++;
  const locked = !!data?.legacyInvalid || !!data?.legacyPending.length;
  return <section className="space-y-4" aria-label="Unidades à Venda">
    <h2 className="text-lg font-bold text-[var(--brand-dark)]">Unidades à Venda</h2>
    <p className="text-sm text-gray-600">{data?.unidades.length ?? 0} unidades · {counters.disponivel} disponíveis · {counters.reservada} reservadas · {counters.vendida} vendidas</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data?.legacyInvalid && <p role="alert" className="border border-amber-500 p-3 text-amber-900">Vendas históricas ambíguas ou incompletas. Revise o lançamento anterior; nenhum registro foi descartado.</p>}
    {!!data?.legacyPending.length && <div className="border border-amber-500 p-3 space-y-2"><strong>Concilie {data.legacyPending.length} venda(s) histórica(s) antes de movimentar unidades.</strong>
      {data.legacyPending.map((sale) => <div key={sale.id} className="flex flex-wrap gap-2 items-center text-sm"><span>{sale.unidade} · {sale.comprador} · {sale.valorVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
        <button type="button" className={action} disabled={pending} onClick={() => { if (window.confirm(`Conciliar a venda histórica da unidade ${sale.unidade}?`)) run(() => conciliarVendaLegada(estudoId, sale.id, "lote")); }}>Conciliar</button></div>)}
    </div>}
    <div className="flex flex-wrap gap-2 items-end"><label className="min-w-36 flex-1 text-sm">Código da unidade<input value={code} maxLength={120} onChange={(e) => setCode(e.target.value)} className={input} /></label><label className="w-40 text-sm">Tipo<input value={kind} maxLength={40} onChange={(e) => setKind(e.target.value)} className={input} /></label><button type="button" className={action} disabled={pending || !code.trim() || !kind.trim()} onClick={() => run(async () => { await criarUnidade(estudoId, code, kind); setCode(""); })}>Adicionar unidade</button></div>
    {!data && <p>Carregando inventário...</p>}
    <div className="grid gap-3">{data?.unidades.map((unit) => <article key={unit.id} className="border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><strong>{unit.codigo} · {unit.tipo}</strong><span>{unit.status}</span></div>
      {unit.status === "vendida" ? <p className="text-sm">{unit.comprador} · {Number(unit.valorVenda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p> : <div className="flex flex-wrap gap-2 items-end">
        <label className="min-w-40 flex-1 text-sm">Comprador<input value={buyers[unit.id] ?? ""} onChange={(e) => setBuyers((v) => ({ ...v, [unit.id]: e.target.value }))} className={input} /></label>
        <label className="w-40 text-sm">Valor da venda<NumeroBRField value={prices[unit.id] ?? 0} onValueChange={(v) => setPrices((old) => ({ ...old, [unit.id]: v }))} className={input} /></label>
        {unit.status === "disponivel" && <button type="button" className={action} disabled={pending || locked} onClick={() => run(() => mudarEstadoUnidade(estudoId, unit.id, "reservar"))}>Reservar</button>}
        <button type="button" className={action} disabled={pending || locked || !buyers[unit.id]?.trim() || !prices[unit.id]} onClick={() => { if (window.confirm(`Registrar venda de ${unit.codigo}?`)) run(() => mudarEstadoUnidade(estudoId, unit.id, "vender", buyers[unit.id], prices[unit.id].toFixed(2))); }}>Vender</button>
        {unit.status === "reservada" && <button type="button" className={action} disabled={pending || locked} onClick={() => run(() => mudarEstadoUnidade(estudoId, unit.id, "liberar"))}>Liberar reserva</button>}
      </div>}
    </article>)}</div>
  </section>;
}
