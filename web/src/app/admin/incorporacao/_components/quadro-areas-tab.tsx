"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, LayoutGrid, AlertTriangle } from "lucide-react";
import { calcularQuadroAreas, type ItemQuadroAreas } from "@/lib/urbanismo/quadro-areas";
import { salvarQuadroAreas } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Quadro de Áreas (padrão NBR 12721) — etapas 2.3 (Estudo de Massa e Quadro
// de Áreas) e 3.3 (Quadro da NBR 12721, registro formal da incorporação):
// área construída coberta/descoberta, área computável e área privativa por
// pavimento — necessário para dimensionar produtos verticais (apartamentos,
// torres) e validar contra o coeficiente de aproveitamento do terreno.

interface Dados {
  coeficienteAproveitamento: number;
  itens: ItemQuadroAreas[];
}

function coeficienteLegado(estudo: EstudoData): number {
  if (estudo.parametrosJson) {
    try {
      const p = JSON.parse(estudo.parametrosJson) as { coefAproveitamento?: number };
      if (p.coefAproveitamento) return p.coefAproveitamento;
    } catch { /* ignora */ }
  }
  return 1.0;
}

function defaults(estudo: EstudoData): Dados {
  return {
    coeficienteAproveitamento: coeficienteLegado(estudo),
    itens: [
      { pavimento: "Torre padrão", areaConstCobertaM2: 0, areaConstDescobertaM2: 0, areaUrbanizadaM2: 0, areaDescontarM2: 0, areaComputavelM2: 0, areaPrivativaM2: 0 },
    ],
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

function fmtM2(v: number) {
  return `${Math.round(v).toLocaleString("pt-BR")} m²`;
}
function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function QuadroAreasTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.quadroAreasJson) {
      try {
        const salvo = JSON.parse(estudo.quadroAreasJson) as Partial<Dados>;
        if (salvo.itens?.length) return { ...defaults(estudo), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults(estudo);
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resultado = useMemo(
    () => calcularQuadroAreas(dados.itens, estudo.areaM2, dados.coeficienteAproveitamento),
    [dados, estudo.areaM2]
  );

  function marcarAlterado() { setSalvo(false); }

  function updCoeficiente(valor: string) {
    setDados((d) => ({ ...d, coeficienteAproveitamento: parseFloat(valor) || 0 }));
    marcarAlterado();
  }
  function addItem() {
    setDados((d) => ({
      ...d,
      itens: [...d.itens, { pavimento: "Novo pavimento", areaConstCobertaM2: 0, areaConstDescobertaM2: 0, areaUrbanizadaM2: 0, areaDescontarM2: 0, areaComputavelM2: 0, areaPrivativaM2: 0 }],
    }));
    marcarAlterado();
  }
  function removerItem(i: number) {
    setDados((d) => ({ ...d, itens: d.itens.filter((_, j) => j !== i) }));
    marcarAlterado();
  }
  function updItem(i: number, campo: keyof ItemQuadroAreas, valor: string) {
    setDados((d) => {
      const itens = [...d.itens];
      itens[i] = { ...itens[i], [campo]: campo === "pavimento" ? valor : (parseFloat(valor) || 0) };
      return { ...d, itens };
    });
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarQuadroAreas(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  const COLS: { campo: keyof ItemQuadroAreas; label: string }[] = [
    { campo: "areaConstCobertaM2", label: "Const. coberta" },
    { campo: "areaConstDescobertaM2", label: "Const. descoberta" },
    { campo: "areaUrbanizadaM2", label: "Urbanizada" },
    { campo: "areaDescontarM2", label: "A descontar" },
    { campo: "areaComputavelM2", label: "Computável" },
    { campo: "areaPrivativaM2", label: "Privativa (APV)" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <LayoutGrid size={13} /> Quadro de Áreas (NBR 12721)
          </p>
          <button onClick={salvar} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um pavimento por linha. A área computável de cada pavimento é lançada por julgamento legal/municipal (nem sempre coincide com a área construída) — use as colunas de referência para decidir.
        </p>
      </div>

      <div className="bg-white border border-gray-100 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Área do terreno</label>
            <div className={`${inputCls} bg-gray-50 text-gray-500`}>{fmtM2(estudo.areaM2)}</div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Coeficiente de aproveitamento (CA)</label>
            <input type="number" step={0.05} value={dados.coeficienteAproveitamento} onChange={(e) => updCoeficiente(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Área computável máxima</label>
            <div className={`${inputCls} bg-gray-50 text-gray-500`}>{fmtM2(resultado.areaComputavelMaximaM2)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs min-w-[720px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Pavimento</th>
                {COLS.map((c) => (
                  <th key={c.campo} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-24">{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((it, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><input value={it.pavimento} onChange={(e) => updItem(i, "pavimento", e.target.value)} className={inputCls} placeholder="Ex.: Torre A" /></td>
                  {COLS.map((c) => (
                    <td key={c.campo} className="px-1 py-1">
                      <input type="number" value={it[c.campo] as number || ""} onChange={(e) => updItem(i, c.campo, e.target.value)} className={numCls} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerItem(i)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar pavimento
        </button>
      </div>

      {resultado.excedeCoeficiente && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            A área computável total ({fmtM2(resultado.areaComputavelTotalM2)}) excede a área computável máxima permitida pelo coeficiente de aproveitamento ({fmtM2(resultado.areaComputavelMaximaM2)}). Revise o mix ou confirme o coeficiente com a prefeitura.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Área const. coberta (ACC)" valor={fmtM2(resultado.areaConstCobertaTotalM2)} />
        <Kpi label="Área const. total (ACT)" valor={fmtM2(resultado.areaConstTotalM2)} />
        <Kpi label="Área privativa (APV)" valor={fmtM2(resultado.areaPrivativaTotalM2)} destaque />
        <Kpi label="Área computável total" valor={fmtM2(resultado.areaComputavelTotalM2)} />
        <Kpi label="Eficiência (APV/ACC)" valor={fmtPct(resultado.indiceApvAcc)} />
        <Kpi label="Aproveitamento do coeficiente" valor={fmtPct(resultado.aproveitamentoPct)} negativo={resultado.excedeCoeficiente} />
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque, negativo }: { label: string; valor: string; destaque?: boolean; negativo?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : negativo ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
