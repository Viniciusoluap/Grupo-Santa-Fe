"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Scale } from "lucide-react";
import {
  calcularPrecificacaoPorComparaveis,
  type AtributoComparavel,
  type Comparavel,
} from "@/lib/mercado/precificacao";
import { salvarPrecificacaoComparaveis } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Precificação por comparáveis ponderados (2.2 Inteligência de Mercado):
// compara o empreendimento novo com concorrentes atributo por atributo (com
// peso por atributo) e sugere o preço/m² proporcional à nota ponderada —
// mais rigoroso do que uma sugestão isolada de preço médio de mercado.

interface Dados {
  atributos: AtributoComparavel[];
  notasNovo: number[];
  comparaveis: Comparavel[];
}

function defaults(): Dados {
  return {
    atributos: [
      { nome: "Localização", peso: 3 },
      { nome: "Lazer e amenidades", peso: 2 },
      { nome: "Padrão construtivo", peso: 2 },
    ],
    notasNovo: [3, 3, 3],
    comparaveis: [],
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const notaCls = "w-16 text-sm border border-gray-200 px-2 py-1.5 text-center focus:outline-none focus:border-[var(--brand-yellow)]";

export function PrecificacaoComparaveis({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.precificacaoComparaveisJson) {
      try {
        const salvo = JSON.parse(estudo.precificacaoComparaveisJson) as Partial<Dados>;
        if (salvo.atributos?.length) return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resultado = useMemo(
    () => calcularPrecificacaoPorComparaveis(dados.atributos, dados.notasNovo, dados.comparaveis),
    [dados]
  );

  function marcarAlterado() {
    setSalvo(false);
  }

  function addAtributo() {
    setDados((d) => ({
      atributos: [...d.atributos, { nome: "Novo atributo", peso: 1 }],
      notasNovo: [...d.notasNovo, 1],
      comparaveis: d.comparaveis.map((c) => ({ ...c, notas: [...c.notas, 1] })),
    }));
    marcarAlterado();
  }
  function removerAtributo(i: number) {
    setDados((d) => ({
      atributos: d.atributos.filter((_, j) => j !== i),
      notasNovo: d.notasNovo.filter((_, j) => j !== i),
      comparaveis: d.comparaveis.map((c) => ({ ...c, notas: c.notas.filter((_, j) => j !== i) })),
    }));
    marcarAlterado();
  }
  function updAtributo(i: number, campo: "nome" | "peso", valor: string) {
    setDados((d) => {
      const atributos = [...d.atributos];
      atributos[i] = { ...atributos[i], [campo]: campo === "nome" ? valor : parseFloat(valor) || 0 };
      return { ...d, atributos };
    });
    marcarAlterado();
  }
  function updNotaNovo(i: number, valor: string) {
    setDados((d) => {
      const notasNovo = [...d.notasNovo];
      notasNovo[i] = parseFloat(valor) || 0;
      return { ...d, notasNovo };
    });
    marcarAlterado();
  }

  function addComparavel() {
    setDados((d) => ({
      ...d,
      comparaveis: [...d.comparaveis, { nome: "", precoM2: null, notas: d.atributos.map(() => 1) }],
    }));
    marcarAlterado();
  }
  function removerComparavel(i: number) {
    setDados((d) => ({ ...d, comparaveis: d.comparaveis.filter((_, j) => j !== i) }));
    marcarAlterado();
  }
  function updComparavel(i: number, campo: "nome" | "precoM2", valor: string) {
    setDados((d) => {
      const comparaveis = [...d.comparaveis];
      comparaveis[i] = {
        ...comparaveis[i],
        [campo]: campo === "nome" ? valor : (parseFloat(valor) || null),
      };
      return { ...d, comparaveis };
    });
    marcarAlterado();
  }
  function updNotaComparavel(i: number, atributoIdx: number, valor: string) {
    setDados((d) => {
      const comparaveis = [...d.comparaveis];
      const notas = [...comparaveis[i].notas];
      notas[atributoIdx] = parseFloat(valor) || 0;
      comparaveis[i] = { ...comparaveis[i], notas };
      return { ...d, comparaveis };
    });
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarPrecificacaoComparaveis(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="bg-white border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Scale size={13} /> Precificação por comparáveis ponderados
          </p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-xl">
            Dê um peso (0–3) para o que mais importa na decisão de compra, uma nota (0–3) para o seu empreendimento e para cada concorrente com preço/m² conhecido. O preço sugerido escala o preço médio dos concorrentes pela proporção entre as notas ponderadas.
          </p>
        </div>
        <button onClick={salvar} disabled={pending}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
          {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
        </button>
      </div>

      {/* Atributos + nota do novo empreendimento */}
      <div>
        <div className="grid grid-cols-12 gap-2 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-0.5">
          <span className="col-span-6">Atributo</span>
          <span className="col-span-2">Peso (0–3)</span>
          <span className="col-span-3">Nota do seu empreendimento</span>
        </div>
        <div className="space-y-1.5">
          {dados.atributos.map((a, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input value={a.nome} onChange={(e) => updAtributo(i, "nome", e.target.value)}
                className={`col-span-6 ${inputCls}`} placeholder="Ex.: Localização" />
              <input type="number" min={0} max={3} step={0.5} value={a.peso}
                onChange={(e) => updAtributo(i, "peso", e.target.value)} className={`col-span-2 ${inputCls}`} />
              <input type="number" min={0} max={3} step={0.5} value={dados.notasNovo[i] ?? 0}
                onChange={(e) => updNotaNovo(i, e.target.value)} className={`col-span-3 ${inputCls}`} />
              <button type="button" onClick={() => removerAtributo(i)}
                className="col-span-1 text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addAtributo} className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar atributo
        </button>
      </div>

      {/* Concorrentes */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Concorrentes</p>
        {dados.comparaveis.length === 0 && (
          <p className="text-xs text-gray-400 mb-2">Nenhum concorrente cadastrado ainda.</p>
        )}
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Nome</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-28">R$/m²</th>
                {dados.atributos.map((a, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-20">{a.nome || `Atrib. ${i + 1}`}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.comparaveis.map((c, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><input value={c.nome} onChange={(e) => updComparavel(i, "nome", e.target.value)} className={inputCls} placeholder="Concorrente" /></td>
                  <td className="px-1 py-1"><input type="number" value={c.precoM2 ?? ""} onChange={(e) => updComparavel(i, "precoM2", e.target.value)} className={inputCls} placeholder="R$/m²" /></td>
                  {dados.atributos.map((_, ai) => (
                    <td key={ai} className="px-1 py-1">
                      <input type="number" min={0} max={3} step={0.5} value={c.notas[ai] ?? 0}
                        onChange={(e) => updNotaComparavel(i, ai, e.target.value)} className={notaCls} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerComparavel(i)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addComparavel} className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar concorrente
        </button>
      </div>

      {/* Resultado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-50">
        <div className="bg-[var(--brand-dark)] p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preço sugerido/m²</p>
          <p className="font-black text-[var(--brand-yellow)] text-lg leading-none">
            {resultado.precoSugeridoM2 > 0 ? formatCurrency(resultado.precoSugeridoM2) : "—"}
          </p>
        </div>
        <div className="border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nota ponderada — você</p>
          <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{resultado.notaPonderadaNovo.toFixed(2)}</p>
        </div>
        <div className="border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nota ponderada média — mercado</p>
          <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{resultado.notaPonderadaMediaComparaveis.toFixed(2)}</p>
        </div>
        <div className="border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Concorrentes válidos</p>
          <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{resultado.comparaveisValidos}</p>
        </div>
      </div>
      {resultado.comparaveisIncompletos.length > 0 && (
        <p className="text-[11px] text-gray-400">
          Fora do cálculo (preço ou nota faltando): {resultado.comparaveisIncompletos.join(", ")}
        </p>
      )}
      {resultado.comparaveisValidos > 0 && (
        <p className="text-[11px] text-gray-400">
          Esse preço sugerido é usado automaticamente como ponto de partida do mix de produtos na aba Viabilidade, enquanto você não define um preço próprio ali.
        </p>
      )}
    </div>
  );
}
