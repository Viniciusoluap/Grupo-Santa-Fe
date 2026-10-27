"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Headset } from "lucide-react";
import {
  resumoAtendimentoClientes,
  TIPOS_CHAMADO,
  type ChamadoAtendimento,
  type StatusChamado,
  type TipoChamado,
} from "@/lib/incorporacao/atendimento-clientes";
import { salvarAtendimentoClientes } from "@/lib/actions/incorporacao";
import { clientesUnidades, listarUnidades } from "@/lib/actions/unidades-incorporacao";
import { exigirResultado } from "@/lib/acao-resultado";
import type { EstudoData } from "./incorporacao-detail";

// Atendimento aos Clientes (5.4 Projetos Executivos e Obras) — central de
// atendimento pós-venda: repasses bancários, assembleias de condomínio,
// entrega de chaves, assistência técnica e documentação.

const STATUS: { value: StatusChamado; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

interface Dados {
  chamados: ChamadoAtendimento[];
}

function defaults(): Dados {
  return { chamados: [] };
}

function novoChamado(): ChamadoAtendimento {
  return { id: Math.random().toString(36).slice(2), cliente: "", tipo: "Entrega de Chaves", status: "aberto" };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function AtendimentoClientesTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.atendimentoClientesJson) {
      try {
        const salvo = JSON.parse(estudo.atendimentoClientesJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string }[]>([]);
  const [unidades, setUnidades] = useState<{ id: string; codigo: string; status: string; comprador: string | null }[]>([]);
  const [busca, setBusca] = useState("");
  const [erroUnidades, setErroUnidades] = useState("");
  useEffect(() => { let ativo = true;
    void listarUnidades(estudo.id).then((r) => { if (ativo) setUnidades(exigirResultado(r).unidades); }).catch((e) => { if (ativo) setErroUnidades(e instanceof Error ? e.message : "Falha ao consultar unidades."); });
    return () => { ativo = false; };
  }, [estudo.id]);
  useEffect(() => { let ativo = true; const timer = setTimeout(() => { void clientesUnidades(busca).then((r) => { if (ativo) setClientes(exigirResultado(r)); }).catch(() => { if (ativo) setClientes([]); }); }, 250); return () => { ativo = false; clearTimeout(timer); }; }, [busca]);
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoAtendimentoClientes(dados.chamados), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addChamado() {
    setDados((d) => ({ chamados: [...d.chamados, novoChamado()] }));
    marcarAlterado();
  }
  function removerChamado(id: string) {
    setDados((d) => ({ chamados: d.chamados.filter((c) => c.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ChamadoAtendimento>(id: string, campo: K, valor: ChamadoAtendimento[K]) {
    setDados((d) => ({ chamados: d.chamados.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarAtendimentoClientes(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Headset size={13} /> Atendimento aos Clientes
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 max-w-xl">
          Um chamado por cliente/solicitação. A etapa fica concluída quando todos os chamados cadastrados estiverem concluídos.
        </p>
      </div>

      {dados.chamados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Chamados" valor={String(resumo.total)} />
          <Kpi label="Abertos" valor={String(resumo.abertos)} />
          <Kpi label="Em andamento" valor={String(resumo.emAndamento)} />
          <Kpi label="Concluídos" valor={`${resumo.pctConcluido}%`} destaque />
        </div>
      )}

      <label className="block text-sm">Buscar cliente no CRM<input value={busca} onChange={(e) => setBusca(e.target.value)} className={inputCls} placeholder="Digite o nome do cliente" /></label>
      <p className="text-xs text-gray-600">Registrar um atendimento não altera a disponibilidade, reserva ou venda da unidade.</p>
      {erroUnidades && <p role="alert" className="text-sm text-red-700">{erroUnidades}</p>}
      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[680px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-40">Cliente</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-28">Unidade</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-44">Tipo</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.chamados.map((c) => (
                <tr key={c.id}>
                  <td className="px-1 py-1 space-y-1">
                    <select aria-label="Cliente do CRM" value={c.clienteLeadId ?? ""} className={inputCls} onChange={(e) => { const lead = clientes.find((l) => l.id === e.target.value); setDados((d) => ({ chamados: d.chamados.map((item) => item.id === c.id ? { ...item, clienteLeadId: lead?.id, cliente: lead?.nome ?? item.cliente } : item) })); marcarAlterado(); }}>
                      <option value="">Cliente avulso</option>{c.clienteLeadId && !clientes.some((l) => l.id === c.clienteLeadId) && <option value={c.clienteLeadId}>{c.cliente}</option>}{clientes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>
                    <input aria-label="Nome do cliente avulso" disabled={!!c.clienteLeadId} value={c.cliente} onChange={(e) => upd(c.id, "cliente", e.target.value)} className={inputCls} placeholder="Nome do cliente" />
                  </td>
                  <td className="px-1 py-1"><select aria-label="Unidade do empreendimento" value={c.unidadeId ?? ""} className={inputCls} onChange={(e) => { const unit = unidades.find((u) => u.id === e.target.value); setDados((d) => ({ chamados: d.chamados.map((item) => item.id === c.id ? { ...item, unidadeId: unit?.id, unidade: unit?.codigo ?? item.unidade } : item) })); marcarAlterado(); }}>
                    <option value="">{c.unidade && !c.unidadeId ? `Registro anterior: ${c.unidade}` : "Sem unidade"}</option>{c.unidadeId && !unidades.some((u) => u.id === c.unidadeId) && <option value={c.unidadeId}>{c.unidade ?? "Unidade anterior"}</option>}{unidades.map((u) => <option key={u.id} value={u.id}>{u.codigo} · {u.status} · {u.comprador || "sem comprador"}</option>)}
                  </select></td>
                  <td className="px-1 py-1">
                    <select value={c.tipo} onChange={(e) => upd(c.id, "tipo", e.target.value as TipoChamado)} className={inputCls}>
                      {TIPOS_CHAMADO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select value={c.status} onChange={(e) => upd(c.id, "status", e.target.value as StatusChamado)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerChamado(c.id)} className="text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addChamado} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar chamado
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-400" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
