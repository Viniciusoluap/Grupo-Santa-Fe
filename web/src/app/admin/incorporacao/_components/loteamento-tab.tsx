"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import {
  calcularCenarios,
  type PremissasLoteamento,
  type ResultadoLoteamento,
  type PerfilVendas,
} from "@/lib/finance/loteamento";
import { salvarLoteamento } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Aba "Loteamento": premissas editáveis + resultados 100% por fórmula, recalculados
// em tempo real a cada alteração (sem IA, sem requisições — o motor roda no browser).
// Percentuais são exibidos em % (ex.: 10) e convertidos para fração no motor.

type CenarioId = "conservador" | "ideal" | "agressivo";

interface PremissasForm {
  areaBrutaM2: number;
  areaMediaLoteM2: number;
  precoM2: number;
  pctAreaPublica: number;   // em %
  pctAreaVerde: number;
  pctSistemaViario: number;
  pctAPP: number;
  pctFaixaServidao: number;
  duracaoVendasMeses: number;
  perfilVendas: PerfilVendas;
  entradaPct: number;
  prazoParcelamentoMeses: number;
  jurosClienteMensal: number;   // % a.m.
  indexacaoMensal: number;      // % a.m.
  vendasAVistaPct: number;
  descontoAVistaPct: number;
  inadimplenciaPct: number;
  comissaoPctVgv: number;
  despesasGeraisPctVgv: number;
  impostosPctVgv: number;
  inicioObraMes: number;
  duracaoObraMeses: number;
  inicioVendasMes: number;
  custoInfraM2Lote: number;
  projetosLicencas: number;
  marketing: number;
  registroPorLote: number;
  contingenciaPctInfra: number;
  bdiPct: number;
  permutaPctVgv: number;
  taxaDescontoAnual: number;    // % a.a.
}

const PERFIS: { value: PerfilVendas; label: string }[] = [
  { value: "lancamento_forte", label: "Lançamento Forte" },
  { value: "organico", label: "Crescimento Orgânico" },
  { value: "constante", label: "Ritmo Constante" },
  { value: "fechamento_forte", label: "Fechamento Forte" },
];

function defaults(areaM2: number): PremissasForm {
  return {
    areaBrutaM2: Math.round(areaM2) || 100_000,
    areaMediaLoteM2: 160,
    precoM2: 500,
    pctAreaPublica: 10,
    pctAreaVerde: 5,
    pctSistemaViario: 25,
    pctAPP: 0,
    pctFaixaServidao: 0,
    duracaoVendasMeses: 24,
    perfilVendas: "lancamento_forte",
    entradaPct: 10,
    prazoParcelamentoMeses: 180,
    jurosClienteMensal: 0.52,
    indexacaoMensal: 0.4,
    vendasAVistaPct: 5,
    descontoAVistaPct: 10,
    inadimplenciaPct: 5,
    comissaoPctVgv: 5,
    despesasGeraisPctVgv: 3,
    impostosPctVgv: 6.58,
    inicioObraMes: 0,
    duracaoObraMeses: 24,
    inicioVendasMes: 12,
    custoInfraM2Lote: 245,
    projetosLicencas: 500_000,
    marketing: 500_000,
    registroPorLote: 400,
    contingenciaPctInfra: 10,
    bdiPct: 10,
    permutaPctVgv: 40,
    taxaDescontoAnual: 12,
  };
}

function paraMotor(f: PremissasForm): PremissasLoteamento {
  const pct = (v: number) => v / 100;
  return {
    areaBrutaM2: f.areaBrutaM2,
    areaMediaLoteM2: f.areaMediaLoteM2,
    precoM2: f.precoM2,
    pctAreaPublica: pct(f.pctAreaPublica),
    pctAreaVerde: pct(f.pctAreaVerde),
    pctSistemaViario: pct(f.pctSistemaViario),
    pctAPP: pct(f.pctAPP),
    pctFaixaServidao: pct(f.pctFaixaServidao),
    duracaoVendasMeses: f.duracaoVendasMeses,
    perfilVendas: f.perfilVendas,
    entradaPct: pct(f.entradaPct),
    prazoParcelamentoMeses: f.prazoParcelamentoMeses,
    jurosClienteMensal: pct(f.jurosClienteMensal),
    indexacaoMensal: pct(f.indexacaoMensal),
    vendasAVistaPct: pct(f.vendasAVistaPct),
    descontoAVistaPct: pct(f.descontoAVistaPct),
    inadimplenciaPct: pct(f.inadimplenciaPct),
    comissaoPctVgv: pct(f.comissaoPctVgv),
    despesasGeraisPctVgv: pct(f.despesasGeraisPctVgv),
    impostosPctVgv: pct(f.impostosPctVgv),
    inicioObraMes: f.inicioObraMes,
    duracaoObraMeses: f.duracaoObraMeses,
    inicioVendasMes: f.inicioVendasMes,
    custoInfraM2Lote: f.custoInfraM2Lote,
    projetosLicencas: f.projetosLicencas,
    marketing: f.marketing,
    registroPorLote: f.registroPorLote,
    contingenciaPctInfra: pct(f.contingenciaPctInfra),
    bdiPct: pct(f.bdiPct),
    permutaPctVgv: pct(f.permutaPctVgv),
    taxaDescontoAnual: pct(f.taxaDescontoAnual),
  };
}

const inputCls =
  "w-full border border-gray-200 px-2.5 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";

function Num({
  label, value, onChange, sufixo, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void; sufixo?: string; step?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
        {label}{sufixo ? <span className="text-gray-300 normal-case font-normal"> ({sufixo})</span> : null}
      </label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={inputCls}
      />
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{titulo}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function fmtM2(v: number) {
  return `${Math.round(v).toLocaleString("pt-BR")} m²`;
}

function fmtPct(v: number, casas = 1) {
  return `${(v * 100).toFixed(casas)}%`;
}

export function LoteamentoTab({ estudo }: { estudo: EstudoData }) {
  const [form, setForm] = useState<PremissasForm>(() => {
    if (estudo.loteamentoJson) {
      try { return { ...defaults(estudo.areaM2), ...(JSON.parse(estudo.loteamentoJson) as Partial<PremissasForm>) }; }
      catch { /* premissas corrompidas → defaults */ }
    }
    return defaults(estudo.areaM2);
  });
  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioId>("ideal");
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const set = <K extends keyof PremissasForm>(k: K) => (v: PremissasForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvo(false);
  };

  const cenarios = useMemo(() => calcularCenarios(paraMotor(form)), [form]);
  const r: ResultadoLoteamento = cenarios[cenarioAtivo];
  const urb = r.urbanistico;

  const dadosGrafico = useMemo(
    () => r.fluxo.map((f) => ({ mes: f.mes, saldo: f.saldoAcumulado })),
    [r]
  );

  function salvar() {
    startTransition(async () => {
      await salvarLoteamento(estudo.id, JSON.stringify(form));
      setSalvo(true);
    });
  }

  const CENARIO_META: { id: CenarioId; label: string; cor: string }[] = [
    { id: "conservador", label: "Conservador", cor: "border-orange-300" },
    { id: "ideal", label: "Ideal", cor: "border-blue-400" },
    { id: "agressivo", label: "Agressivo", cor: "border-green-400" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Premissas ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Premissas do estudo — os resultados recalculam <b>em tempo real</b>, só com fórmulas (sem IA, sem créditos).
        </p>
        <button
          onClick={salvar}
          disabled={pending}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {pending ? "Salvando..." : salvo ? "Premissas salvas" : "Salvar premissas"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Secao titulo="Projeto & Urbanístico">
          <Num label="Área bruta" sufixo="m²" value={form.areaBrutaM2} onChange={set("areaBrutaM2")} step={100} />
          <Num label="Área média do lote" sufixo="m²" value={form.areaMediaLoteM2} onChange={set("areaMediaLoteM2")} />
          <Num label="Preço" sufixo="R$/m²" value={form.precoM2} onChange={set("precoM2")} />
          <Num label="Área pública" sufixo="%" value={form.pctAreaPublica} onChange={set("pctAreaPublica")} step={0.1} />
          <Num label="Área verde" sufixo="%" value={form.pctAreaVerde} onChange={set("pctAreaVerde")} step={0.1} />
          <Num label="Sistema viário" sufixo="%" value={form.pctSistemaViario} onChange={set("pctSistemaViario")} step={0.1} />
          <Num label="APP" sufixo="%" value={form.pctAPP} onChange={set("pctAPP")} step={0.1} />
          <Num label="Faixa de servidão" sufixo="%" value={form.pctFaixaServidao} onChange={set("pctFaixaServidao")} step={0.1} />
        </Secao>

        <Secao titulo="Vendas & Financeiro">
          <Num label="Duração das vendas" sufixo="meses" value={form.duracaoVendasMeses} onChange={set("duracaoVendasMeses")} />
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Perfil da curva</label>
            <select
              value={form.perfilVendas}
              onChange={(e) => set("perfilVendas")(e.target.value as PerfilVendas)}
              className={inputCls}
            >
              {PERFIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <Num label="Entrada" sufixo="%" value={form.entradaPct} onChange={set("entradaPct")} step={0.5} />
          <Num label="Parcelamento" sufixo="meses" value={form.prazoParcelamentoMeses} onChange={set("prazoParcelamentoMeses")} />
          <Num label="Juros ao cliente" sufixo="% a.m." value={form.jurosClienteMensal} onChange={set("jurosClienteMensal")} step={0.01} />
          <Num label="Correção (IPCA)" sufixo="% a.m." value={form.indexacaoMensal} onChange={set("indexacaoMensal")} step={0.01} />
          <Num label="Vendas à vista" sufixo="%" value={form.vendasAVistaPct} onChange={set("vendasAVistaPct")} step={0.5} />
          <Num label="Desconto à vista" sufixo="%" value={form.descontoAVistaPct} onChange={set("descontoAVistaPct")} step={0.5} />
          <Num label="Inadimplência" sufixo="%" value={form.inadimplenciaPct} onChange={set("inadimplenciaPct")} step={0.5} />
          <Num label="Comissão" sufixo="% VGV" value={form.comissaoPctVgv} onChange={set("comissaoPctVgv")} step={0.5} />
          <Num label="Despesas gerais" sufixo="% VGV" value={form.despesasGeraisPctVgv} onChange={set("despesasGeraisPctVgv")} step={0.5} />
          <Num label="Impostos" sufixo="% VGV" value={form.impostosPctVgv} onChange={set("impostosPctVgv")} step={0.01} />
        </Secao>

        <Secao titulo="Cronograma & Terreno">
          <Num label="Início da obra" sufixo="mês" value={form.inicioObraMes} onChange={set("inicioObraMes")} />
          <Num label="Duração da obra" sufixo="meses" value={form.duracaoObraMeses} onChange={set("duracaoObraMeses")} />
          <Num label="Início das vendas" sufixo="mês" value={form.inicioVendasMes} onChange={set("inicioVendasMes")} />
          <Num label="Permuta ao terreneiro" sufixo="% VGV" value={form.permutaPctVgv} onChange={set("permutaPctVgv")} step={0.5} />
          <Num label="Taxa de desconto (VPL)" sufixo="% a.a." value={form.taxaDescontoAnual} onChange={set("taxaDescontoAnual")} step={0.5} />
        </Secao>

        <Secao titulo="Custos">
          <Num label="Infra por m² de lote" sufixo="R$/m²" value={form.custoInfraM2Lote} onChange={set("custoInfraM2Lote")} />
          <Num label="Projetos e licenças" sufixo="R$" value={form.projetosLicencas} onChange={set("projetosLicencas")} step={1000} />
          <Num label="Marketing" sufixo="R$" value={form.marketing} onChange={set("marketing")} step={1000} />
          <Num label="Registro por lote" sufixo="R$" value={form.registroPorLote} onChange={set("registroPorLote")} />
          <Num label="Contingência" sufixo="% infra" value={form.contingenciaPctInfra} onChange={set("contingenciaPctInfra")} step={0.5} />
          <Num label="BDI" sufixo="% infra" value={form.bdiPct} onChange={set("bdiPct")} step={0.5} />
        </Secao>
      </div>

      {/* ── Resultado urbanístico ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resultado do estudo urbanístico</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kpi label="Total de lotes" valor={urb.totalLotes.toLocaleString("pt-BR")} destaque />
          <Kpi label="Área líquida vendável" valor={fmtM2(urb.areaVendavelM2)} />
          <Kpi label="Taxa de aproveitamento" valor={fmtPct(urb.taxaAproveitamento)} />
          <Kpi label="Preço médio do lote" valor={formatCurrency(r.precoLote)} />
        </div>
        <div className="space-y-1 text-xs">
          {[
            { label: "Área bruta total", v: urb.areaBrutaM2 },
            { label: "Área pública", v: urb.areaPublicaM2 },
            { label: "Área verde", v: urb.areaVerdeM2 },
            { label: "Sistema viário", v: urb.areaViarioM2 },
            { label: "APP", v: urb.areaAppM2 },
            { label: "Faixa de servidão", v: urb.areaServidaoM2 },
          ].map(({ label, v }) => (
            <div key={label} className="flex items-center justify-between border-b border-gray-50 py-1">
              <span className="text-gray-500">{label}</span>
              <span className="font-bold text-[var(--brand-dark)]">{fmtM2(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cenários ── */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Análise por cenário</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CENARIO_META.map(({ id, label, cor }) => {
            const c = cenarios[id];
            const ativo = cenarioAtivo === id;
            return (
              <button
                key={id}
                onClick={() => setCenarioAtivo(id)}
                className={`text-left bg-white border-2 p-4 transition-colors ${ativo ? cor : "border-gray-100 hover:border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500 uppercase">{label}</p>
                  {ativo && <span className="text-[9px] font-black bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-1.5 py-0.5 uppercase">Ativo</span>}
                </div>
                <p className="font-black text-[var(--brand-dark)] text-lg leading-none">
                  VGV {formatCurrency(c.vgvGross)}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  VPL: <span className={c.vpl >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{formatCurrency(c.vpl)}</span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Indicadores do cenário ativo ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="VPL" valor={formatCurrency(r.vpl)} negativo={r.vpl < 0} destaque />
        <Kpi label="TIR" valor={r.tirAnual != null ? `${(r.tirAnual * 100).toFixed(2)}% a.a.` : "—"} />
        <Kpi label="ROI" valor={fmtPct(r.roi, 1)} negativo={r.roi < 0} />
        <Kpi label="Margem líquida" valor={fmtPct(r.margemLiquida, 1)} negativo={r.margemLiquida < 0} />
        <Kpi label="Payback" valor={r.paybackMes != null ? `${r.paybackMes} meses` : "não recupera"} />
        <Kpi label="Exposição máx." valor={formatCurrency(r.exposicaoMaxima)} sub={`pico no mês ${r.mesPico}`} negativo />
      </div>

      {/* ── VGV, custos e recebíveis ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">VGV de referência</p>
          <Linha label="VGV bruto (tabela)" valor={formatCurrency(r.vgvGross)} />
          <Linha label="VGV líquido" valor={formatCurrency(r.vgvNet)} sub="após comissões, despesas e impostos" />
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custos</p>
          <Linha label="Infraestrutura (c/ BDI)" valor={formatCurrency(r.custoInfra)} />
          <Linha label="Pré-venda (capital próprio)" valor={formatCurrency(r.custosPreVenda)} />
          <Linha label="Durante vendas (com receita)" valor={formatCurrency(r.custosDuranteVenda)} />
          <Linha label="Total geral" valor={formatCurrency(r.custoTotal)} forte />
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Distribuição de recebíveis</p>
          <Linha label={`Você recebe (${(100 - form.permutaPctVgv).toFixed(0)}%)`} valor={formatCurrency(r.recebiveis.voce)} forte />
          <Linha label={`Terreneiro (${form.permutaPctVgv.toFixed(0)}%)`} valor={formatCurrency(r.recebiveis.terreneiro)} />
          <Linha label="Total a receber" valor={formatCurrency(r.recebiveis.total)} />
          <div className="mt-2 pt-2 border-t border-gray-50">
            <Linha
              label="Break-even"
              valor={`${r.breakEven.lotesNecessarios.toLocaleString("pt-BR")} lotes`}
              sub={urb.totalLotes > 0 ? `${((r.breakEven.lotesNecessarios / urb.totalLotes) * 100).toFixed(1)}% do total` : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Fluxo de caixa acumulado ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Fluxo de caixa acumulado — incorporador ({CENARIO_META.find((c) => c.id === cenarioAtivo)?.label})
        </p>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={dadosGrafico} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(m) => `M${m}`} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10 }}
                width={80}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), "Caixa acumulado"]}
                labelFormatter={(m) => `Mês ${m}`}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="saldo" stroke="#16a34a" strokeWidth={2} fill="url(#saldoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Valores calculados por fórmulas determinísticas (VPL a {form.taxaDescontoAnual}% a.a., parcelas indexadas, inadimplência e permuta consideradas). Estudo preliminar — não substitui projeto executivo nem análise contratual.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, valor, sub, destaque, negativo }: {
  label: string; valor: string; sub?: string; destaque?: boolean; negativo?: boolean;
}) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-400" : "text-gray-400"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${
        destaque ? (negativo ? "text-red-400" : "text-[var(--brand-yellow)]") : negativo ? "text-red-500" : "text-[var(--brand-dark)]"
      }`}>
        {valor}
      </p>
      {sub && <p className={`text-[10px] mt-0.5 ${destaque ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

function Linha({ label, valor, sub, forte }: { label: string; valor: string; sub?: string; forte?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <span className="text-xs text-gray-500">{label}</span>
        {sub && <p className="text-[10px] text-gray-300">{sub}</p>}
      </div>
      <span className={`text-xs shrink-0 ${forte ? "font-black text-[var(--brand-dark)]" : "font-bold text-gray-700"}`}>{valor}</span>
    </div>
  );
}
