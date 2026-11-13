"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Handshake, BadgeCheck, AlertTriangle } from "lucide-react";
import {
  estimarProposta,
  resolverVgvBruto,
  resumoNegociacaoV2,
  ROTULO_ORIGEM_VGV,
  type DadosNegociacao,
  type EstimativaProposta,
  type Proposta,
  type StatusProposta,
  type TipoProposta,
} from "@/lib/incorporacao/negociacao";
import { calcularLoteamento } from "@/lib/finance/loteamento";
import { excluirPropostaNegociacao, salvarNegociacaoTerreno } from "@/lib/actions/incorporacao";
import { exigirResultado } from "@/lib/acao-resultado";
import { cenarioEscolhido } from "@/lib/incorporacao/estudos-massa";
import type { CenarioMassa } from "@/lib/geo/massa";
import { formatCurrency } from "@/lib/utils";
import { NumeroBRField } from "@/components/ui/numero-br-field";
import { PercentInput } from "@/components/ui/percent-input";
import type { EstudoData } from "./incorporacao-detail";
import { montarPremissasLoteamento } from "@/lib/incorporacao/premissas-loteamento";

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
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
    data: new Date().toISOString().slice(0, 10),
    autor: "grupo_santa_fe",
    tipo: "compra_avista",
    status: "enviada",
  };
}

const inputCls = "min-w-0 max-w-full w-full text-sm border border-gray-200 px-2.5 py-2 focus:outline-none focus:border-[var(--brand-yellow)]";

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
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // propostas já gravadas no servidor (a exclusão delas passa pela ação auditada)
  const idsGravados = useRef(new Set(dados.propostas.map((p) => p.id)));

  // VGV bruto efetivo — Viabilidade > cenário escolhido do Estudo de Massa > manual legado
  // (paridade Prospecta, correção 08). Sem VGV a permuta fica "Cálculo pendente", nunca R$ 0,00.
  const vgv = useMemo(() => {
    let viabilidade: number | null = null;
    const premissas = montarPremissasLoteamento(estudo);
    if (premissas) {
      try { viabilidade = calcularLoteamento(premissas).vgvGross; } catch { viabilidade = null; }
    }
    let cenarioMassa: number | null = null;
    try {
      const salvoMassa = estudo.massaCenariosJson ? (JSON.parse(estudo.massaCenariosJson) as { cenarios?: CenarioMassa[] }) : null;
      cenarioMassa = cenarioEscolhido(salvoMassa?.cenarios ?? [], estudo.cenarioEscolhidoId)?.kpis.vgv ?? null;
    } catch { cenarioMassa = null; }
    return resolverVgvBruto({ viabilidade, cenarioMassa, manualLegado: dados.vgvGrossManual ?? null });
  }, [estudo, dados.vgvGrossManual]);

  const resumo = useMemo(() => resumoNegociacaoV2(dados, vgv), [dados, vgv]);

  function marcarAlterado() { setSalvo(false); }

  function setCampo<K extends keyof DadosNegociacao>(campo: K, valor: DadosNegociacao[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    marcarAlterado();
  }

  function addProposta() {
    setDados((d) => ({ ...d, propostas: [...d.propostas, novaProposta()] }));
    marcarAlterado();
  }

  async function gravar(snapshot: DadosNegociacao) {
    exigirResultado(await salvarNegociacaoTerreno(estudo.id, JSON.stringify(snapshot)));
    idsGravados.current = new Set(snapshot.propostas.map((p) => p.id));
  }

  async function removerProposta(p: Proposta) {
    setErro(null);
    const rotulo = `${TIPOS.find((t) => t.value === p.tipo)?.label ?? p.tipo} de ${p.data.split("-").reverse().join("/")}`;
    if (!window.confirm(`Excluir a proposta "${rotulo}"? Somente esta proposta será removida; as demais são preservadas.`)) return;
    let reforcada = false;
    if (p.status === "aceita") {
      const digitado = window.prompt("ATENÇÃO: esta proposta está ACEITA (negociação fechada). Para confirmar a exclusão, digite EXCLUIR:");
      if ((digitado ?? "").trim().toUpperCase() !== "EXCLUIR") return;
      reforcada = true;
    }
    if (!idsGravados.current.has(p.id)) {
      // ainda não foi gravada: remove só da tela (não há o que auditar no servidor)
      setDados((d) => ({ ...d, propostas: d.propostas.filter((x) => x.id !== p.id), propostaSelecionadaId: d.propostaSelecionadaId === p.id ? null : d.propostaSelecionadaId }));
      marcarAlterado();
      return;
    }
    setExcluindo(true);
    try {
      // grava o que está na tela antes (sem perder edições), depois exclui com auditoria
      await gravar(dados);
      const r = exigirResultado(await excluirPropostaNegociacao(estudo.id, p.id, reforcada));
      setDados((d) => ({
        ...d,
        propostas: d.propostas.filter((x) => x.id !== p.id),
        propostaSelecionadaId: d.propostaSelecionadaId === p.id ? null : d.propostaSelecionadaId,
        historicoExclusoes: r.historicoExclusoes,
      }));
      idsGravados.current.delete(p.id);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir a proposta.");
    } finally {
      setExcluindo(false);
    }
  }
  function updProposta<K extends keyof Proposta>(id: string, campo: K, valor: Proposta[K]) {
    setDados((d) => ({
      ...d,
      propostas: d.propostas.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)),
    }));
    marcarAlterado();
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      try {
        await gravar(dados);
        setSalvo(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao salvar a negociação.");
      }
    });
  }

  return (
    <fieldset disabled={excluindo} className="min-w-0 space-y-4">
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
        <p className="text-[11px] text-gray-600 max-w-xl">
          Registre cada proposta trocada com o proprietário/terreneiro. Permuta financeira = VGV bruto × percentual ÷ 100.{" "}
          {vgv ? <>VGV usado: <strong>{formatCurrency(vgv.valor)}</strong> ({ROTULO_ORIGEM_VGV[vgv.origem]}).</> : <strong className="text-amber-700">VGV não disponível — preencha a Viabilidade ou escolha um cenário no Estudo de Massa.</strong>}
        </p>
        {erro && <p role="alert" className="mt-2 text-xs text-red-700 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{erro}</p>}
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
        <Kpi label="Status consolidado" valor={resumo.fechada ? "Fechada (proposta aceita)" : resumo.referencia ? (STATUS.find((s) => s.value === resumo.referencia!.status)?.label ?? "—") : "—"} />
        <Kpi label="Valor estimado — proposta atual" valor={textoEstimativa(resumo.estimativa)} destaque />
      </div>
      {resumo.referencia && (
        <div className="bg-white border border-gray-100 p-3 text-[11px] text-gray-600 grid gap-1 sm:grid-cols-3">
          <p><strong>Proposta atual:</strong> {resumo.origemReferencia === "selecionada" ? "selecionada manualmente" : resumo.origemReferencia === "aceita" ? "a proposta aceita" : "a mais recente"} (prioridade: selecionada › aceita › mais recente)</p>
          <p><strong>Aceita:</strong> {resumo.propostaAceita ? `${descrever(resumo.propostaAceita)} · ${textoEstimativa(estimarProposta(resumo.propostaAceita, vgv))}` : "nenhuma"}</p>
          <p><strong>Mais recente:</strong> {resumo.propostaMaisRecente ? `${descrever(resumo.propostaMaisRecente)} · ${textoEstimativa(estimarProposta(resumo.propostaMaisRecente, vgv))}` : "—"}</p>
        </div>
      )}

      {resumo.fechada && (
        <div className="bg-green-50 border border-green-100 p-3 flex items-center gap-2">
          <BadgeCheck size={16} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700 font-bold">Negociação fechada — proposta aceita registrada abaixo.</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="space-y-3">
          {dados.propostas.length === 0 && (
            <p className="text-xs text-gray-600">Nenhuma proposta registrada ainda.</p>
          )}
          {dados.propostas.map((p) => (
            <div key={p.id} className="border border-gray-100 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 [&>div]:min-w-0">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Data</label>
                  <input type="date" value={p.data} onChange={(e) => updProposta(p.id, "data", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Autor</label>
                  <select value={p.autor} onChange={(e) => updProposta(p.id, "autor", e.target.value as Proposta["autor"])} className={inputCls}>
                    <option value="grupo_santa_fe">Grupo Santa Fé</option>
                    <option value="proprietario">Proprietário</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Tipo</label>
                  <select value={p.tipo} onChange={(e) => updProposta(p.id, "tipo", e.target.value as TipoProposta)} className={inputCls}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Status</label>
                  <select value={p.status} onChange={(e) => updProposta(p.id, "status", e.target.value as StatusProposta)} className={inputCls}>
                    {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end justify-end gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 min-h-10">
                    <input type="radio" name="proposta-atual" checked={dados.propostaSelecionadaId === p.id}
                      onChange={() => setCampo("propostaSelecionadaId", p.id)} /> Usar como atual
                  </label>
                  <button type="button" aria-label={`Excluir proposta de ${p.data}`} onClick={() => void removerProposta(p)}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 min-h-10 border border-red-200 text-red-700 hover:bg-red-50"><Trash2 size={14} /> Excluir proposta</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 [&>div]:min-w-0">
                {(p.tipo === "compra_avista" || p.tipo === "compra_parcelada" || p.tipo === "permuta_fisica" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Valor (R$)</label>
                    <NumeroBRField value={p.valorTotal ?? 0} onValueChange={(v) => updProposta(p.id, "valorTotal", v)} className={inputCls} />
                  </div>
                )}
                {p.tipo === "compra_parcelada" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Entrada (%)</label>
                      <PercentInput value={p.entradaPct ?? 0} onValueChange={(v) => updProposta(p.id, "entradaPct", v)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Prazo (meses)</label>
                      <input type="number" value={p.prazoParcelamentoMeses ?? ""} onChange={(e) => updProposta(p.id, "prazoParcelamentoMeses", parseFloat(e.target.value) || 0)} className={inputCls} />
                    </div>
                  </>
                )}
                {(p.tipo === "permuta_financeira" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Permuta (% do VGV)</label>
                    <PercentInput value={p.permutaPctVgv ?? 0} onValueChange={(v) => updProposta(p.id, "permutaPctVgv", v)} className={inputCls} />
                  </div>
                )}
                {(p.tipo === "permuta_fisica" || p.tipo === "misto") && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Unidades entregues</label>
                    <input type="number" value={p.unidadesPermuta ?? ""} onChange={(e) => updProposta(p.id, "unidadesPermuta", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                )}
                <div className="sm:col-span-2 xl:col-span-4">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Condições / observações</label>
                  <input value={p.condicoes ?? ""} onChange={(e) => updProposta(p.id, "condicoes", e.target.value)} className={inputCls} placeholder="Ex.: prazo de escritura, cláusulas específicas..." />
                </div>
              </div>

              <p className="text-[11px] text-right text-gray-600">
                Valor estimado: <span className="font-bold text-[var(--brand-dark)]">{textoEstimativa(estimarProposta(p, vgv))}</span>
              </p>
            </div>
          ))}
        </div>
        <button type="button" onClick={addProposta} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar proposta
        </button>
        {dados.propostaSelecionadaId && (
          <button type="button" onClick={() => setCampo("propostaSelecionadaId", null)} className="mt-2 block text-[11px] underline text-gray-600">Limpar seleção (voltar à regra aceita › mais recente)</button>
        )}
        {(dados.historicoExclusoes?.length ?? 0) > 0 && (
          <details className="mt-3 text-[11px] text-gray-600">
            <summary className="cursor-pointer font-bold">Propostas excluídas (auditoria): {dados.historicoExclusoes!.length}</summary>
            <ul className="mt-1 space-y-0.5">
              {dados.historicoExclusoes!.map((h) => (
                <li key={`${h.proposta.id}-${h.excluidaEm}`}>{descrever(h.proposta)}{h.eraAceita ? " (era ACEITA)" : ""} — excluída em {new Date(h.excluidaEm).toLocaleString("pt-BR")} por {h.excluidaPorNome ?? `usuário ${h.excluidaPorId ?? "?"}`}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </fieldset>
  );
}

function textoEstimativa(e: EstimativaProposta | null): string {
  if (!e) return "—";
  if (e.status === "calculado") return formatCurrency(e.valor);
  if (e.status === "pendente") return e.motivo;
  return "Valor não informado";
}

function descrever(p: Proposta): string {
  return `${TIPOS.find((t) => t.value === p.tipo)?.label ?? p.tipo} de ${p.data.split("-").reverse().join("/")} (${STATUS.find((s) => s.value === p.status)?.label ?? p.status})`;
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-400" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
