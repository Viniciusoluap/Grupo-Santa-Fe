"use client";

import { useState } from "react";
import { Plus, Trash2, Calculator, Sparkles, Loader2, Save } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { calcularEve, type EveInput, type EveResultado, type UnidadeMix, type TipoTerreno } from "@/lib/finance/eve";
import { salvarViabilidade } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

const num = (v: FormDataEntryValue | null) => parseFloat((v as string) || "0") || 0;

export function ViabilidadeTab({ estudo }: { estudo: EstudoData }) {
  const salvo = estudo.viabilidadeJson ? JSON.parse(estudo.viabilidadeJson) : null;
  const [mix, setMix] = useState<UnidadeMix[]>(
    salvo?.inputs?.mix ?? [{ nome: "Lote padrão", quantidade: 100, areaUnidadeM2: 300, precoM2: 500 }]
  );
  const [resultado, setResultado] = useState<EveResultado | null>(salvo?.resultado ?? null);
  const [tipoTerreno, setTipoTerreno] = useState<TipoTerreno>(salvo?.inputs?.terreno?.tipo ?? "compra");
  const [parecer, setParecer] = useState<string | null>(estudo.parecerIa);
  const [busy, setBusy] = useState(false);
  const [ultimoInput, setUltimoInput] = useState<EveInput | null>(salvo?.inputs ?? null);

  function addProduto() {
    setMix([...mix, { nome: "Novo produto", quantidade: 0, areaUnidadeM2: 0, precoM2: 0 }]);
  }
  function updProduto(i: number, campo: keyof UnidadeMix, valor: string) {
    const novo = [...mix];
    novo[i] = { ...novo[i], [campo]: campo === "nome" ? valor : parseFloat(valor) || 0 };
    setMix(novo);
  }

  function calcular(formData: FormData) {
    const input: EveInput = {
      mix,
      terreno: {
        tipo: tipoTerreno,
        valorCompra: num(formData.get("valorCompra")),
        mesPagamento: num(formData.get("mesPagamento")),
        percentualVgv: num(formData.get("percentualVgv")) / 100,
        unidadesPermutadas: num(formData.get("unidadesPermutadas")),
      },
      custos: {
        custoObraM2: num(formData.get("custoObraM2")),
        indiretosPercentualVgv: num(formData.get("indiretos")) / 100,
        comissaoPercentualVgv: num(formData.get("comissao")) / 100,
      },
      cronograma: {
        mesesObra: num(formData.get("mesesObra")),
        mesesVendas: num(formData.get("mesesVendas")),
        inicioObraMes: num(formData.get("inicioObraMes")),
        inicioVendasMes: num(formData.get("inicioVendasMes")),
      },
      financeiro: {
        taxaDescontoMensal: num(formData.get("taxaDesconto")) / 100,
        indexacaoMensal: num(formData.get("indexacao")) / 100,
        entradaPercentual: num(formData.get("entrada")) / 100,
      },
    };
    setUltimoInput(input);
    setResultado(calcularEve(input));
    setParecer(null);
  }

  async function salvar() {
    if (!resultado || !ultimoInput) return;
    setBusy(true);
    try { await salvarViabilidade(estudo.id, { inputs: ultimoInput, resultado, parecerIa: parecer ?? undefined }); }
    finally { setBusy(false); }
  }

  async function gerarParecer() {
    if (!resultado) return;
    setBusy(true);
    try {
      const res = await fetch("/api/incorporacao/parecer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: estudo.nome, municipio: estudo.municipio, estado: estudo.estado, areaM2: estudo.areaM2,
          vgv: resultado.vgv, custoTotal: resultado.custoTotal, lucroBruto: resultado.lucroBruto,
          margemLiquida: resultado.margemLiquida, vpl: resultado.vpl, tir: resultado.tir,
          paybackMes: resultado.paybackMes, exposicaoMaxima: resultado.exposicaoMaxima,
        }),
      });
      const json = await res.json();
      if (res.ok) setParecer(json.parecer);
      else setParecer(`Erro: ${json.error}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <form action={calcular} className="space-y-4">
        {/* Mix de produtos */}
        <Bloco titulo="Mix de produtos (VGV)">
          <div className="space-y-2">
            {mix.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={p.nome} onChange={(e) => updProduto(i, "nome", e.target.value)}
                  className="col-span-4 text-sm border border-gray-200 px-2 py-1.5" placeholder="Produto" />
                <input type="number" value={p.quantidade || ""} onChange={(e) => updProduto(i, "quantidade", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="Qtd" />
                <input type="number" value={p.areaUnidadeM2 || ""} onChange={(e) => updProduto(i, "areaUnidadeM2", e.target.value)}
                  className="col-span-3 text-sm border border-gray-200 px-2 py-1.5" placeholder="Área m²" />
                <input type="number" value={p.precoM2 || ""} onChange={(e) => updProduto(i, "precoM2", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="R$/m²" />
                <button type="button" onClick={() => setMix(mix.filter((_, j) => j !== i))}
                  className="col-span-1 text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addProduto} className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
            <Plus size={12} /> Adicionar produto
          </button>
        </Bloco>

        {/* Terreno */}
        <Bloco titulo="Terreno / Terreneiro">
          <div className="flex gap-2 mb-3">
            {(["compra", "permuta_fisica", "permuta_financeira"] as TipoTerreno[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipoTerreno(t)}
                className={`text-xs font-bold px-3 py-1.5 border ${tipoTerreno === t ? "bg-[var(--brand-yellow)] border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-gray-200 text-gray-500"}`}>
                {t === "compra" ? "Compra" : t === "permuta_fisica" ? "Permuta física" : "Permuta financeira"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tipoTerreno === "compra" && <>
              <Campo name="valorCompra" label="Valor de compra (R$)" def={salvo?.inputs?.terreno?.valorCompra} />
              <Campo name="mesPagamento" label="Mês do pagamento" def={salvo?.inputs?.terreno?.mesPagamento ?? 0} />
            </>}
            {tipoTerreno === "permuta_financeira" &&
              <Campo name="percentualVgv" label="% do VGV ao terreneiro" def={(salvo?.inputs?.terreno?.percentualVgv ?? 0.15) * 100} />}
            {tipoTerreno === "permuta_fisica" &&
              <Campo name="unidadesPermutadas" label="Unidades permutadas" def={salvo?.inputs?.terreno?.unidadesPermutadas} />}
          </div>
        </Bloco>

        {/* Custos + Cronograma + Financeiro */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Bloco titulo="Custos">
            <Campo name="custoObraM2" label="Obra/infra por m² (R$)" def={salvo?.inputs?.custos?.custoObraM2 ?? 150} />
            <Campo name="indiretos" label="Indiretos (% VGV)" def={(salvo?.inputs?.custos?.indiretosPercentualVgv ?? 0.12) * 100} />
            <Campo name="comissao" label="Comissão (% VGV)" def={(salvo?.inputs?.custos?.comissaoPercentualVgv ?? 0.05) * 100} />
          </Bloco>
          <Bloco titulo="Cronograma (meses)">
            <Campo name="mesesObra" label="Meses de obra" def={salvo?.inputs?.cronograma?.mesesObra ?? 12} />
            <Campo name="mesesVendas" label="Meses de vendas" def={salvo?.inputs?.cronograma?.mesesVendas ?? 18} />
            <Campo name="inicioObraMes" label="Início da obra" def={salvo?.inputs?.cronograma?.inicioObraMes ?? 0} />
            <Campo name="inicioVendasMes" label="Início das vendas" def={salvo?.inputs?.cronograma?.inicioVendasMes ?? 0} />
          </Bloco>
          <Bloco titulo="Financeiro">
            <Campo name="taxaDesconto" label="Taxa desconto (% a.m.)" def={(salvo?.inputs?.financeiro?.taxaDescontoMensal ?? 0.008) * 100} step="0.01" />
            <Campo name="indexacao" label="Indexação INCC (% a.m.)" def={(salvo?.inputs?.financeiro?.indexacaoMensal ?? 0.005) * 100} step="0.01" />
            <Campo name="entrada" label="Entrada na venda (%)" def={(salvo?.inputs?.financeiro?.entradaPercentual ?? 0.2) * 100} />
          </Bloco>
        </div>

        <button type="submit" className="flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90">
          <Calculator size={14} /> Calcular viabilidade
        </button>
      </form>

      {resultado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="VGV" value={formatCurrency(resultado.vgv)} destaque />
            <KPI label="Lucro bruto" value={formatCurrency(resultado.lucroBruto)} />
            <KPI label="Margem líquida" value={`${(resultado.margemLiquida * 100).toFixed(1)}%`} />
            <KPI label="VPL" value={formatCurrency(resultado.vpl)} />
            <KPI label="TIR" value={resultado.tir != null ? `${(resultado.tir * 100).toFixed(2)}% a.m.` : "—"} />
            <KPI label="TIR anual" value={resultado.tir != null ? `${((Math.pow(1 + resultado.tir, 12) - 1) * 100).toFixed(1)}% a.a.` : "—"} />
            <KPI label="Payback" value={resultado.paybackMes != null ? `${resultado.paybackMes} meses` : "—"} />
            <KPI label="Exposição máx." value={formatCurrency(resultado.exposicaoMaxima)} />
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Fluxo de caixa acumulado (R$)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={resultado.fluxo} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFluxo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5C400" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F5C400" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10 }} width={44} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Acumulado"]} labelFormatter={(l) => `Mês ${l}`} />
                <Area type="monotone" dataKey="saldoAcumulado" stroke="#F5C400" strokeWidth={2.5} fill="url(#gradFluxo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={gerarParecer} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Gerar parecer (IA)
            </button>
            <button onClick={salvar} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50">
              <Save size={14} /> Salvar viabilidade
            </button>
          </div>

          {parecer && (
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Sparkles size={12} /> Parecer de viabilidade
              </p>
              <p className="text-sm text-[var(--brand-dark)] leading-relaxed whitespace-pre-wrap">{parecer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{titulo}</p>
      {children}
    </div>
  );
}

function Campo({ name, label, def, step }: { name: string; label: string; def?: number; step?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{label}</label>
      <input type="number" name={name} defaultValue={def ?? ""} step={step ?? "any"}
        className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
    </div>
  );
}

function KPI({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className={`border p-4 ${destaque ? "bg-[var(--brand-dark)] border-[var(--brand-dark)]" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-[var(--brand-yellow)]" : "text-gray-400"}`}>{label}</p>
      <p className={`font-black text-lg leading-none ${destaque ? "text-white" : "text-[var(--brand-dark)]"}`}>{value}</p>
    </div>
  );
}
