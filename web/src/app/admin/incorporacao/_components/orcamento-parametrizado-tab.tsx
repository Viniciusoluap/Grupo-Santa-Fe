"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Calculator } from "lucide-react";
import {
  calcularOrcamentoParametrizado,
  type ItemOrcamentoParametrizado,
  type PremissasOrcamentoParametrizado,
} from "@/lib/orcamento/parametrizado";
import { salvarOrcamentoParametrizado } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import { NumeroBRField } from "@/components/ui/numero-br-field";
import { urbanismoDoCenario } from "@/lib/incorporacao/premissas-loteamento";
import { OrcamentoImportacao } from "./orcamento-importacao";
import type { EstudoData } from "./incorporacao-detail";

// Orçamento Parametrizado (2.4 Novos Negócios) — custo de obra por m²
// equivalente, discriminado por pavimento, com coeficiente de equivalência
// por pavimento (garagem custa menos por m² que um pavimento tipo, por
// exemplo). Antecede o orçamento preliminar formal (3.5) e alimenta
// automaticamente o custo de infraestrutura/obra da Viabilidade.

function defaults(): PremissasOrcamentoParametrizado {
  return {
    itens: [{ pavimento: "Torre padrão", areaM2: 0, coeficienteEquivalencia: 1 }],
    custoM2Equivalente: 2500,
    passivoAmbiental: 0,
    decoracaoEquipamentos: 0,
    projetos: 0,
    previsaoInfra: 0,
    outros: 0,
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

export function OrcamentoParametrizadoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<PremissasOrcamentoParametrizado>(() => {
    if (estudo.orcamentoParametrizadoJson) {
      try {
        const salvo = JSON.parse(estudo.orcamentoParametrizadoJson) as Partial<PremissasOrcamentoParametrizado>;
        if (salvo.itens?.length) return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    const base = defaults();
    const c = urbanismoDoCenario(estudo);
    const tipo = estudo.tipoIncorporacao ?? "";
    if (["loteamento", "desmembramento_simples", "condominio_lotes"].includes(tipo)) return { ...base, metodo: "infraestrutura", areaReferenciaM2: c?.quadroAreas?.areaLiquidaVendavelM2 ?? 0,
      infraestrutura: c?.quadroAreas ? [
        { descricao: "Sistema viário", unidade: "m²", quantidade: c.quadroAreas.sistemaViarioM2, unitario: 0, total: 0 },
        { descricao: "Terraplanagem", unidade: "m²", quantidade: c.quadroAreas.areaParcelavelM2, unitario: 0, total: 0 },
        { descricao: "Infraestrutura por lote", unidade: "un", quantidade: c.lotes.length, unitario: 0, total: 0 },
      ] : [] };
    return { ...base, metodo: "construcao" };
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resultado = useMemo(() => calcularOrcamentoParametrizado(dados), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function set<K extends keyof PremissasOrcamentoParametrizado>(campo: K) {
    return (valor: string) => {
      setDados((d) => ({ ...d, [campo]: parseFloat(valor) || 0 }));
      marcarAlterado();
    };
  }
  function addItem() {
    setDados((d) => ({ ...d, itens: [...d.itens, { pavimento: "Novo pavimento", areaM2: 0, coeficienteEquivalencia: 1 }] }));
    marcarAlterado();
  }
  function removerItem(i: number) {
    setDados((d) => ({ ...d, itens: d.itens.filter((_, j) => j !== i) }));
    marcarAlterado();
  }
  function updItem(i: number, campo: keyof ItemOrcamentoParametrizado, valor: string | number) {
    setDados((d) => {
      const itens = [...d.itens];
      itens[i] = { ...itens[i], [campo]: campo === "pavimento" ? valor : (typeof valor === "number" ? valor : parseFloat(valor) || 0) };
      return { ...d, itens };
    });
    marcarAlterado();
  }

  function salvar() {
    startTransition(async () => {
      await salvarOrcamentoParametrizado(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calculator size={13} /> Orçamento Parametrizado
          </p>
          <button onClick={salvar} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 max-w-xl">
          Selecione o método conforme o empreendimento. Lotes usam infraestrutura e quantidades do cenário; edificações usam área construída equivalente. A importação Excel tem conferência antes de aplicar e preserva o arquivo original. Salve para integrar os custos à Viabilidade.
        </p>
      </div>

      <OrcamentoImportacao dados={dados} onChange={(d) => { setDados(d); marcarAlterado(); }} areaReferencia={urbanismoDoCenario(estudo)?.quadroAreas?.areaLiquidaVendavelM2 ?? 0} />
      {(dados.metodo ?? "construcao") === "construcao" && <>
      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[520px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-48">Pavimento</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-28">Área (m²)</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Coef. equivalência</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-28">Área equivalente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((it, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><input value={it.pavimento} onChange={(e) => updItem(i, "pavimento", e.target.value)} className={inputCls} placeholder="Ex.: Torre A" /></td>
                  <td className="px-1 py-1"><NumeroBRField value={it.areaM2} onValueChange={(v) => updItem(i, "areaM2", v)} className={numCls} /></td>
                  <td className="px-1 py-1"><NumeroBRField value={it.coeficienteEquivalencia} onValueChange={(v) => updItem(i, "coeficienteEquivalencia", v)} decimals={4} className={numCls} /></td>
                  <td className="px-1 py-1 text-right text-gray-600">{Math.round(it.areaM2 * it.coeficienteEquivalencia).toLocaleString("pt-BR")} m²</td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerItem(i)} className="text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
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

      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custos adicionais</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Num label="Custo/m² equivalente" sufixo="R$" value={dados.custoM2Equivalente} onChange={set("custoM2Equivalente")} />
          <Num label="Passivo ambiental" sufixo="R$" value={dados.passivoAmbiental} onChange={set("passivoAmbiental")} step={1000} />
          <Num label="Decoração/equipamentos" sufixo="R$" value={dados.decoracaoEquipamentos} onChange={set("decoracaoEquipamentos")} step={1000} />
          <Num label="Todos os projetos" sufixo="R$" value={dados.projetos} onChange={set("projetos")} step={1000} />
          <Num label="Previsão de infraestrutura" sufixo="R$" value={dados.previsaoInfra} onChange={set("previsaoInfra")} step={1000} />
          <Num label="Outros" sufixo="R$" value={dados.outros} onChange={set("outros")} step={1000} />
        </div>
      </div>

      </>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Área total" valor={`${Math.round(resultado.areaTotalM2).toLocaleString("pt-BR")} m²`} />
        <Kpi label="Área equivalente total" valor={`${Math.round(resultado.areaEquivalenteTotalM2).toLocaleString("pt-BR")} m²`} />
        <Kpi label="Custo de obra base" valor={formatCurrency(resultado.custoObraBase)} />
        <Kpi label="Custo total" valor={formatCurrency(resultado.custoTotal)} />
        <Kpi label="Custo/m² real (p/ Viabilidade)" valor={formatCurrency(resultado.custoM2Real)} destaque />
      </div>
    </div>
  );
}

function Num({ label, value, onChange, sufixo, step = 1 }: { label: string; value: number; onChange: (v: string) => void; sufixo?: string; step?: number }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
        {label}{sufixo ? <span className="text-gray-500 normal-case font-normal"> ({sufixo})</span> : null}
      </label>
      <input type="number" value={Number.isFinite(value) ? value : ""} step={step} onChange={(e) => onChange(e.target.value)} className={inputCls} />
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
