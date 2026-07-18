"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Handshake, BadgeCheck } from "lucide-react";
import {
  resumoNegociacao,
  valorEstimadoProposta,
  type DadosNegociacao,
  type Proposta,
  type StatusProposta,
  type TipoProposta,
} from "@/lib/incorporacao/negociacao";
import { calcularLoteamento } from "@/lib/finance/loteamento";
import { salvarNegociacaoTerreno } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";
import { montarPremissasLoteamento } from "./viabilidade-tab";

// Negociação do Terreno (2.7 Novos Negócios) — histórico de propostas
// trocadas com o proprietário/terreneiro até o fechamento. O valor da
// permuta financeira é estimado automaticamente a partir do VGV bruto já
// calculado na Viabilidade (2.5), quando disponível.

const TIPOS: { value: TipoProposta; label: string }[] = [
  { value: "compra_avista", label: "Compra à vista" },
  { value: "compra_parcelada", label: "Compra parcelada" },
  { value: "permuta_fisica", label: "Permuta física" },
  { value: "permuta_financeira", label: "Permuta financeira" },
  { value: "misto", label: "Misto" },
];

const STATUS: { value: StatusProposta; label: string; cor: string }[] = [
  { value: "enviada", label: "Enviada", cor: "text-gray-500 bg-gray-50" },
  { value: "em_analise", label: "Em análise", cor: "text-blue-600 bg-blue-50" },
  { value: "contraproposta", label: "Contraproposta", cor: "text-amber-600 bg-amber-50" },
  { value: "aceita", label: "Aceita", cor: "text-green-600 bg-green-50" },
  { value: "recusada", label: "Recusada", cor: "text-red-600 bg-red-50" },
];

function defaults(): DadosNegociacao {
  return { proprietarioNome: "", proprietarioContato: "", propostas: [] };
}

function novaProposta(): Proposta {
  return {
    id: Math.random().toString(36).slice(2),
    data: new Date().toISOString().slice(0, 10),
    autor: "grupo_santa_fe",
    tipo: "compra_avista",
    status: "enviada",
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2.5 py-2 focus:outline-none focus:border-[var(--brand-yellow)]";

export function NegociacaoTerrenoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<DadosNegociacao>(() => {
    if (estudo.negociacaoTerrenoJson) {
      try {
        const salvo = JSON.parse(estudo.negociacaoTerrenoJson) as Partial<DadosNegociacao>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const vgvGross = useMemo(() => {
    const premissas = montarPremissasLoteamento(estudo);
    if (!premissas) return 0;
    try {
      return calcularLoteamento(premissas).vgvGross;
    } catch {
      return 0;
    }
  }, [estudo]);

  const resumo = useMemo(() => resumoNegociacao(dados, vgvGross), [dados, vgvGross]);

  function marcarAlterado() { setSalvo(false); }

  function setCampo<K extends keyof DadosNegociacao>(campo: K, valor: DadosNegociacao[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    marcarAlterado();
  }

  function addProposta() {
    setDados((d) => ({ ...d, propostas: [...d.propostas, novaProposta()] }));
    marcarAlterado();
  }
  function removerProposta(id: string) {
    setDados((d) => ({ ...d, propostas: d.propostas.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function updProposta<K extends keyof Proposta>(id: string, campo: K, valor: Proposta[K]) {
    setDados((d) => ({
      ...d,
      propostas: d.propostas.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)),
    }));
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarNegociacaoTerreno(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Handshake size={13} /> Negociação do Terreno
          </p>
          <button onClick={salvar} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Registre cada proposta trocada com o proprietário/terreneiro. O valor da permuta financeira é estimado automaticamente a partir do VGV bruto da Viabilidade (2.5){vgvGross > 0 ? ` — atual: ${formatCurrency(vgvGross)}` : ", quando a Viabilidade estiver preenchida"}.
        </p>
      </div>

      <div className="bg-white border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Proprietário/Terreneiro</label>
            <input value={dados.proprietarioNome} onChange={(e) => setCampo("proprietarioNome", e.target.value)} className={inputCls} placeholder="Nome" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Contato</label>
            <input value={dados.proprietarioContato} onChange={(e) => setCampo("proprietarioContato", e.target.value)} className={inputCls} placeholder="Telefone/e-mail" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Propostas registradas" valor={String(resumo.totalPropostas)} />
        <Kpi label="Status atual" valor={resumo.propostaAtual ? (STATUS.find((s) => s.value === resumo.propostaAtual!.status)?.label ?? "—") : "—"} />
        <Kpi label="Valor estimado (proposta atual)" valor={formatCurrency(resumo.valorEstimadoAtual)} destaque />
      </div>

      {resumo.fechada && (
        <div className="bg-green-50 border border-green-100 p-3 flex items-center gap-2">
          <BadgeCheck size={16} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700 font-bold">Negociação fechada — proposta aceita registrada abaixo.</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="space-y-3">
          {dados.propostas.length === 0 && (
            <p className="text-xs text-gray-400">Nenhuma proposta registrada ainda.</p>
          )}
          {dados.propostas.map((p) => (
            <div key={p.id} className="border border-gray-100 p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Data</label>
                  <input type="date" value={p.data} onChange={(e) => updProposta(p.id, "data", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Autor</label>
                  <select value={p.autor} onChange={(e) => updProposta(p.id, "autor", e.target.value as Proposta["autor"])} className={inputCls}>
                    <option value="grupo_santa_fe">Grupo Santa Fé</option>
                    <option value="proprietario">Proprietário</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tipo</label>
                  <select value={p.tipo} onChange={(e) => updProposta(p.id, "tipo", e.target.value as TipoProposta)} className={inputCls}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</label>
                  <select value={p.status} onChange={(e) => updProposta(p.id, "status", e.target.value as StatusProposta)} className={inputCls}>
                    {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button type="button" onClick={() => removerProposta(p.id)} className="text-gray-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(p.tipo === "compra_avista" || p.tipo === "compra_parcelada" || p.tipo === "permuta_fisica" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Valor (R$)</label>
                    <input type="number" value={p.valorTotal ?? ""} onChange={(e) => updProposta(p.id, "valorTotal", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                )}
                {p.tipo === "compra_parcelada" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Entrada (%)</label>
                      <input type="number" value={p.entradaPct ?? ""} onChange={(e) => updProposta(p.id, "entradaPct", parseFloat(e.target.value) || 0)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prazo (meses)</label>
                      <input type="number" value={p.prazoParcelamentoMeses ?? ""} onChange={(e) => updProposta(p.id, "prazoParcelamentoMeses", parseFloat(e.target.value) || 0)} className={inputCls} />
                    </div>
                  </>
                )}
                {(p.tipo === "permuta_financeira" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Permuta (% do VGV)</label>
                    <input type="number" value={p.permutaPctVgv ?? ""} onChange={(e) => updProposta(p.id, "permutaPctVgv", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                )}
                {(p.tipo === "permuta_fisica" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Unidades entregues</label>
                    <input type="number" value={p.unidadesPermuta ?? ""} onChange={(e) => updProposta(p.id, "unidadesPermuta", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                )}
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Condições / observações</label>
                  <input value={p.condicoes ?? ""} onChange={(e) => updProposta(p.id, "condicoes", e.target.value)} className={inputCls} placeholder="Ex.: prazo de escritura, cláusulas específicas..." />
                </div>
              </div>

              <p className="text-[11px] text-right text-gray-400">
                Valor estimado: <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(valorEstimadoProposta(p, vgvGross))}</span>
              </p>
            </div>
          ))}
        </div>
        <button type="button" onClick={addProposta} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar proposta
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
