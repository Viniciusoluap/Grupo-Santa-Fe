"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { exigirResultado, type ErroAcao } from "@/lib/acao-resultado";
import { NumeroBRField } from "@/components/ui/numero-br-field";
import { listarUnidades, criarUnidade, conciliarVendaLegada, sincronizarUnidades, clientesUnidades, editarUnidade, excluirUnidade } from "@/lib/actions/unidades-incorporacao";
type Snapshot = Exclude<Awaited<ReturnType<typeof listarUnidades>>, ErroAcao>;
type Unidade = Snapshot["unidades"][number];
type Cliente = { id: string; nome: string; telefone: string };
const input = "min-w-0 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const action = "rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
const brl = (v: string | number | null) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function UnidadesTab({ estudoId }: { estudoId: string }) {
  const [data, setData] = useState<Snapshot | null>(null); const [error, setError] = useState("");
  const [pending, start] = useTransition(); const [code, setCode] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]); const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Unidade | null>(null);
  const [form, setForm] = useState({ comprador: "", compradorLeadId: "", valor: 0, status: "disponivel" as "disponivel" | "reservada" | "vendida" });
  const refresh = useCallback(async () => { setData(exigirResultado(await listarUnidades(estudoId))); }, [estudoId]);
  useEffect(() => { let ativo = true; void (async () => { try { exigirResultado(await sincronizarUnidades(estudoId)); const r = exigirResultado(await listarUnidades(estudoId)); if (ativo) setData(r); } catch(e) { if (ativo) setError(e instanceof Error ? e.message : "Falha ao carregar unidades."); } })(); return () => { ativo = false; }; }, [estudoId]);
  useEffect(() => { let ativo = true; const timer = setTimeout(() => { void clientesUnidades(busca).then((r) => { if (ativo) setClientes(exigirResultado(r)); }).catch(() => { if (ativo) setClientes([]); }); }, 250); return () => { ativo = false; clearTimeout(timer); }; }, [busca]);
  function run(fn: () => Promise<unknown>, fechar = false) {
    setError(""); start(async () => { try { exigirResultado(await fn()); if (fechar) setEdit(null); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Operação falhou."); } });
  }
  function abrir(unit: Unidade) {
    setEdit(unit); setForm({ comprador: unit.comprador ?? "", compradorLeadId: unit.compradorLeadId ?? "", valor: Number(unit.valorVenda ?? 0), status: unit.status as typeof form.status });
  }
  const counters = { disponivel: 0, reservada: 0, vendida: 0 };
  for (const u of data?.unidades ?? []) if (u.status in counters) counters[u.status as keyof typeof counters]++;
  const locked = !!data?.legacyInvalid || !!data?.legacyPending.length;
  return <section className="space-y-4" aria-label="Unidades à Venda">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Unidades à Venda</h2><p className="mt-1 text-sm text-gray-600">{data?.unidades.length ?? 0} unidades · {counters.disponivel} disponíveis · {counters.reservada} reservadas · {counters.vendida} vendidas</p></div><button className={action} disabled={pending} onClick={() => run(() => sincronizarUnidades(estudoId))}>Atualizar do cenário</button></div>
    <p className="text-xs text-gray-600">O cenário gera os lotes automaticamente. Reservas, vendas e exclusões são preservadas. Unidades de cenários anteriores permanecem para revisão comercial.</p>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {data?.legacyInvalid && <p role="alert" className="border border-amber-500 p-3 text-amber-900">Vendas históricas ambíguas ou incompletas. Revise os registros antes de movimentar unidades.</p>}
    {!!data?.legacyPending.length && <div className="space-y-2 rounded-lg border border-amber-500 p-3"><strong>Concilie {data.legacyPending.length} venda(s) histórica(s).</strong>{data.legacyPending.map((sale) => <div key={sale.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{sale.unidade} · {sale.comprador} · {brl(sale.valorVenda)}</span><button className={action} disabled={pending} onClick={() => { if (confirm(`Conciliar venda de ${sale.unidade}?`)) run(() => conciliarVendaLegada(estudoId, sale.id, "lote")); }}>Conciliar</button></div>)}</div>}
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-40 flex-1 text-sm">Unidade avulsa<input value={code} maxLength={120} onChange={(e) => setCode(e.target.value)} className={input} placeholder="Quadra / lote ou código da unidade" /></label><button className={action} disabled={pending || !code.trim()} onClick={() => run(async () => { const r = exigirResultado(await criarUnidade(estudoId, code, "lote")); setCode(""); return r; })}>Adicionar unidade</button></div>
    {!data && <p role="status">Carregando inventário…</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data?.unidades.map((u) => <article key={u.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><strong>{u.codigo}</strong><span className={`rounded-full px-2 py-1 text-xs ${u.status === "vendida" ? "bg-green-100 text-green-900" : u.status === "reservada" ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>{u.status === "vendida" ? "Vendido" : u.status === "reservada" ? "Reservado" : "Disponível"}</span></div>
      <p className="break-words text-sm">{u.comprador || "Sem comprador"} · {brl(u.valorVenda)}</p><p className="text-xs text-gray-500">{u.cenarioId ? `Origem: ${u.cenarioId}` : "Cadastro avulso"}</p>
      <div className="flex flex-wrap gap-2"><button className={action} disabled={pending || locked} onClick={() => abrir(u)}>Editar</button><button className={`${action} text-red-700`} disabled={pending} onClick={() => { if (confirm(`Excluir ${u.codigo}? Ela não será recriada pelo cenário. Vínculos comerciais impedem a exclusão.`)) run(() => excluirUnidade(estudoId, u.id)); }}>Excluir</button></div>
    </article>)}</div>
    {edit && <section aria-label={`Editar ${edit.codigo}`} className="space-y-3 rounded-xl border-2 border-gray-700 bg-white p-4">
      <h3 className="font-bold">Editar {edit.codigo}</h3><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">Buscar cliente no CRM<input value={busca} onChange={(e) => setBusca(e.target.value)} className={input} placeholder="Digite o nome" /></label>
        <label className="min-w-0 text-sm">Cliente<select value={form.compradorLeadId} className={input} onChange={(e) => { const c = clientes.find((c) => c.id === e.target.value); setForm({ ...form, compradorLeadId: c?.id ?? "", comprador: c?.nome ?? form.comprador }); }}><option value="">Nome avulso</option>{form.compradorLeadId && !clientes.some((c) => c.id === form.compradorLeadId) && <option value={form.compradorLeadId}>{form.comprador}</option>}{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}</select></label>
        <label className="min-w-0 text-sm">Nome do comprador<input value={form.comprador} disabled={!!form.compradorLeadId} maxLength={255} onChange={(e) => setForm({ ...form, comprador: e.target.value })} className={input} /></label>
        <label className="min-w-0 text-sm">Valor negociado (R$)<NumeroBRField value={form.valor} onValueChange={(v) => setForm({ ...form, valor: Math.max(0, v) })} className={input} /></label>
        <label className="min-w-0 text-sm">Status<select value={form.status} className={input} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}><option value="disponivel">Disponível</option><option value="reservada">Reservado</option><option value="vendida">Vendido</option></select></label>
      </fieldset>
      <div className="flex flex-wrap gap-2"><button disabled={pending || locked} className={action} onClick={() => { if (form.status !== "vendida" || confirm(`Salvar venda/correção comercial de ${edit.codigo}?`)) run(() => editarUnidade(estudoId, edit.id, { status: form.status, comprador: form.comprador || null, compradorLeadId: form.compradorLeadId || null, valor: form.valor > 0 ? form.valor.toFixed(2) : null, esperadoEm: edit.atualizadoEm }), true); }}>Salvar unidade</button><button disabled={pending} className={action} onClick={() => setEdit(null)}>Cancelar</button></div>
    </section>}
  </section>;
}
