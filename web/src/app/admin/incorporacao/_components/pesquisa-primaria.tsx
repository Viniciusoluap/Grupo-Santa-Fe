"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, ClipboardList } from "lucide-react";
import {
  resumoPesquisaPrimaria,
  ITENS_CONDOMINIO,
  type Entrevistado,
  type FaixaEtaria,
  type FaixaRenda,
  type ItemCondominio,
  type NivelImportancia,
  type TipoImovel,
} from "@/lib/incorporacao/pesquisa-primaria";
import { salvarPesquisaPrimaria } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Pesquisa primária com compradores — questionário aplicado a potenciais
// clientes (metodologia Carolina Caribé), complementando a pesquisa de
// mercado feita por IA com dados reais de campo.

interface Dados {
  entrevistados: Entrevistado[];
}

const TIPOS: { value: TipoImovel; label: string }[] = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa_condominio", label: "Casa em condomínio" },
  { value: "casa_rua_aberta", label: "Casa em rua aberta" },
  { value: "lote", label: "Lote" },
];

const FAIXAS_ETARIAS: FaixaEtaria[] = ["18-25", "26-35", "36-45", "46-55", "56+"];
const FAIXAS_RENDA: { value: FaixaRenda; label: string }[] = [
  { value: "ate_2sm", label: "Até 2 SM" },
  { value: "2_4sm", label: "2 a 4 SM" },
  { value: "4_8sm", label: "4 a 8 SM" },
  { value: "8_15sm", label: "8 a 15 SM" },
  { value: "acima_15sm", label: "Acima de 15 SM" },
];
const NIVEIS: { value: NivelImportancia; label: string }[] = [
  { value: "importante_paga_mais", label: "Importante, paga mais" },
  { value: "decisivo_sem_pagar_mais", label: "Decisivo, não paga mais" },
  { value: "pouco_importante", label: "Pouco importante" },
];

function defaults(): Dados {
  return { entrevistados: [] };
}

function novoEntrevistado(): Entrevistado {
  return {
    id: Math.random().toString(36).slice(2),
    nome: "",
    faixaEtaria: "",
    faixaRenda: "",
    temImovelProprio: false,
    interesseComprar12Meses: true,
    tiposInteresse: [],
    notaApartamento: 0,
    notaCasaCondominio: 0,
    notaCasaRuaAberta: 0,
    tamanhoIdealM2: 0,
    quartosNecessarios: 0,
    itensImportancia: {},
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function PesquisaPrimaria({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.pesquisaPrimariaJson) {
      try {
        const salvo = JSON.parse(estudo.pesquisaPrimariaJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoPesquisaPrimaria(dados.entrevistados), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addEntrevistado() {
    setDados((d) => ({ entrevistados: [...d.entrevistados, novoEntrevistado()] }));
    setAberto(true);
    marcarAlterado();
  }
  function removerEntrevistado(id: string) {
    setDados((d) => ({ entrevistados: d.entrevistados.filter((e) => e.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof Entrevistado>(id: string, campo: K, valor: Entrevistado[K]) {
    setDados((d) => ({ entrevistados: d.entrevistados.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)) }));
    marcarAlterado();
  }
  function toggleTipo(id: string, tipo: TipoImovel) {
    setDados((d) => ({
      entrevistados: d.entrevistados.map((e) => {
        if (e.id !== id) return e;
        const tem = e.tiposInteresse.includes(tipo);
        return { ...e, tiposInteresse: tem ? e.tiposInteresse.filter((t) => t !== tipo) : [...e.tiposInteresse, tipo] };
      }),
    }));
    marcarAlterado();
  }
  function updItem(id: string, item: ItemCondominio, nivel: NivelImportancia | "") {
    setDados((d) => ({
      entrevistados: d.entrevistados.map((e) => {
        if (e.id !== id) return e;
        const itens = { ...e.itensImportancia };
        if (nivel === "") delete itens[item];
        else itens[item] = nivel;
        return { ...e, itensImportancia: itens };
      }),
    }));
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarPesquisaPrimaria(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="bg-white border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <ClipboardList size={13} /> Pesquisa Primária com Compradores {dados.entrevistados.length > 0 && `(${dados.entrevistados.length})`}
        </button>
        <button onClick={salvar} disabled={pending}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
          {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 max-w-xl">
        Questionário de perfil e interesse aplicado a potenciais compradores — complementa a pesquisa de mercado por IA com dados reais de campo.
      </p>

      {dados.entrevistados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Entrevistados" valor={String(resumo.totalEntrevistados)} />
          <Kpi label="Interesse em comprar (12m)" valor={`${resumo.pctInteresseComprar12Meses}%`} />
          <Kpi label="Tamanho ideal médio" valor={`${resumo.tamanhoIdealMedioM2} m²`} />
          <Kpi label="Quartos mais pedidos" valor={resumo.quartosModaNecessarios ? String(resumo.quartosModaNecessarios) : "—"} destaque />
        </div>
      )}

      {dados.entrevistados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-gray-100 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Tipologia de interesse</p>
            <div className="space-y-1.5">
              {resumo.distribuicaoTipoImovel.map((d) => (
                <div key={d.tipo} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-gray-500">{TIPOS.find((t) => t.value === d.tipo)?.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 overflow-hidden"><div className="h-full bg-[var(--brand-yellow)]" style={{ width: `${d.pct}%` }} /></div>
                  <span className="w-10 text-right font-bold text-[var(--brand-dark)]">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-100 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Itens mais valorizados (pagam mais por isso)</p>
            <div className="space-y-1.5">
              {resumo.rankingItens.slice(0, 5).map((r) => (
                <div key={r.item} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-gray-500 truncate">{r.item}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 overflow-hidden"><div className="h-full bg-[var(--brand-yellow)]" style={{ width: `${r.pctImportantePagaMais}%` }} /></div>
                  <span className="w-10 text-right font-bold text-[var(--brand-dark)]">{r.pctImportantePagaMais}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {aberto && (
        <div className="space-y-3">
          {dados.entrevistados.map((e) => (
            <div key={e.id} className="border border-gray-100 p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input value={e.nome} onChange={(ev) => upd(e.id, "nome", ev.target.value)} className={inputCls} placeholder="Nome do entrevistado" />
                <input value={e.contato ?? ""} onChange={(ev) => upd(e.id, "contato", ev.target.value)} className={inputCls} placeholder="Telefone/e-mail" />
                <select value={e.faixaEtaria} onChange={(ev) => upd(e.id, "faixaEtaria", ev.target.value as FaixaEtaria)} className={inputCls}>
                  <option value="">Faixa etária</option>
                  {FAIXAS_ETARIAS.map((f) => <option key={f} value={f}>{f} anos</option>)}
                </select>
                <select value={e.faixaRenda} onChange={(ev) => upd(e.id, "faixaRenda", ev.target.value as FaixaRenda)} className={inputCls}>
                  <option value="">Faixa de renda</option>
                  {FAIXAS_RENDA.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={e.temImovelProprio} onChange={(ev) => upd(e.id, "temImovelProprio", ev.target.checked)} /> Tem imóvel próprio
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={e.interesseComprar12Meses} onChange={(ev) => upd(e.id, "interesseComprar12Meses", ev.target.checked)} /> Interesse em comprar (12m)
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tamanho ideal (m²)</label>
                  <input type="number" value={e.tamanhoIdealM2 || ""} onChange={(ev) => upd(e.id, "tamanhoIdealM2", parseFloat(ev.target.value) || 0)} className={numCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Quartos necessários</label>
                  <input type="number" value={e.quartosNecessarios || ""} onChange={(ev) => upd(e.id, "quartosNecessarios", parseFloat(ev.target.value) || 0)} className={numCls} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tipos de imóvel de interesse</p>
                <div className="flex flex-wrap gap-3">
                  {TIPOS.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input type="checkbox" checked={e.tiposInteresse.includes(t.value)} onChange={() => toggleTipo(e.id, t.value)} /> {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nota apartamento (0-5)</label>
                  <input type="number" min={0} max={5} value={e.notaApartamento || ""} onChange={(ev) => upd(e.id, "notaApartamento", parseFloat(ev.target.value) || 0)} className={numCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nota casa em condomínio (0-5)</label>
                  <input type="number" min={0} max={5} value={e.notaCasaCondominio || ""} onChange={(ev) => upd(e.id, "notaCasaCondominio", parseFloat(ev.target.value) || 0)} className={numCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nota casa em rua aberta (0-5)</label>
                  <input type="number" min={0} max={5} value={e.notaCasaRuaAberta || ""} onChange={(ev) => upd(e.id, "notaCasaRuaAberta", parseFloat(ev.target.value) || 0)} className={numCls} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Importância dos itens de condomínio</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {ITENS_CONDOMINIO.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{item}</span>
                      <select value={e.itensImportancia[item] ?? ""} onChange={(ev) => updItem(e.id, item, ev.target.value as NivelImportancia | "")} className={inputCls}>
                        <option value="">—</option>
                        {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => removerEntrevistado(e.id)} className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-500">
                  <Trash2 size={13} /> Remover entrevistado
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={addEntrevistado} className="flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
        <Plus size={12} /> Adicionar entrevistado
      </button>
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
