"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Save, Loader2, CheckCircle2, FileText, Download, Plus, Trash2 } from "lucide-react";
import {
  calcularCenarios,
  type PremissasLoteamento,
  type ResultadoLoteamento,
  type ItemMixProduto,
  type PerfilVendas,
} from "@/lib/finance/loteamento";
import {
  calcularPrecificacaoPorComparaveis,
  type AtributoComparavel,
  type Comparavel,
} from "@/lib/mercado/precificacao";
import {
  calcularOrcamentoParametrizado,
  type PremissasOrcamentoParametrizado,
} from "@/lib/orcamento/parametrizado";
import {
  gerarRelatorioExecutivo,
  gerarRelatorioCustos,
  gerarRelatorioTerreneiro,
  recebimentosPorAno,
  custosPorAno,
  type MetaRelatorio,
} from "@/lib/pdf/loteamento";
import { salvarViabilidade } from "@/lib/actions/incorporacao";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

// Aba "Viabilidade" (antes "Loteamento" + "Urbanístico" + "Viabilidade (EVE)" —
// unificadas): premissas editáveis + mix de produtos (lotes, casas, apartamentos
// ou qualquer combinação) + resultados 100% por fórmula, recalculados em tempo
// real a cada alteração (sem IA, sem requisições — o motor roda no browser).
//
// A área de APP NUNCA é editada manualmente aqui: vem sempre do cálculo
// automático feito no mapa (aba Terreno) e é somada como % da área bruta.
//
// Percentuais são exibidos em % (ex.: 10) e convertidos para fração no motor.

type CenarioId = "conservador" | "ideal" | "agressivo";

interface PremissasForm {
  areaBrutaM2: number;
  pctAreaPublica: number;   // em %
  pctAreaVerde: number;
  pctSistemaViario: number;
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
  taxaIncorporacaoPctVgv: number;
  inicioObraMes: number;
  duracaoObraMeses: number;
  inicioVendasMes: number;
  custoInfraM2Lote: number;
  projetosLicencas: number;
  marketing: number;
  registroPorUnidade: number;
  contingenciaPctInfra: number;
  bdiPct: number;
  taxaAdministracaoObraPct: number;
  manutencaoPctObra: number;
  inccObraMensal: number;
  permutaPctVgv: number;
  taxaDescontoAnual: number;    // % a.a.
}

const PERFIS: { value: PerfilVendas; label: string }[] = [
  { value: "lancamento_forte", label: "Lançamento Forte" },
  { value: "organico", label: "Crescimento Orgânico" },
  { value: "constante", label: "Ritmo Constante" },
  { value: "fechamento_forte", label: "Fechamento Forte" },
];

/**
 * Custo/m² real vindo do Orçamento Parametrizado (2.4), quando já preenchido —
 * substitui o valor genérico de custoInfraM2Lote enquanto o usuário não
 * definir um valor próprio na Viabilidade.
 */
function custoInfraDoOrcamentoParametrizado(estudo: EstudoData): number {
  if (!estudo.orcamentoParametrizadoJson) return 0;
  try {
    const salvo = JSON.parse(estudo.orcamentoParametrizadoJson) as PremissasOrcamentoParametrizado;
    const r = calcularOrcamentoParametrizado(salvo);
    return r.custoM2Real > 0 ? r.custoM2Real : 0;
  } catch {
    return 0;
  }
}

function defaultsForm(estudo: EstudoData): PremissasForm {
  const custoParametrizado = custoInfraDoOrcamentoParametrizado(estudo);
  return {
    areaBrutaM2: Math.round(estudo.areaM2) || 100_000,
    pctAreaPublica: 10,
    pctAreaVerde: 5,
    pctSistemaViario: 25,
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
    taxaIncorporacaoPctVgv: 1,
    inicioObraMes: 0,
    duracaoObraMeses: 24,
    inicioVendasMes: 12,
    custoInfraM2Lote: custoParametrizado || 245,
    projetosLicencas: 500_000,
    marketing: 500_000,
    registroPorUnidade: 400,
    contingenciaPctInfra: 10,
    bdiPct: 10,
    taxaAdministracaoObraPct: 10,
    manutencaoPctObra: 1.5,
    inccObraMensal: 0.3,
    permutaPctVgv: 40,
    taxaDescontoAnual: 12,
  };
}

function defaultsMix(estudo: EstudoData): ItemMixProduto[] {
  // 1) mix vindo do Estudo de Massa (cenário gerador), se existir.
  if (estudo.mixJson) {
    try {
      const mix = JSON.parse(estudo.mixJson) as ItemMixProduto[];
      if (Array.isArray(mix) && mix.length > 0) return mix;
    } catch { /* ignora JSON corrompido */ }
  }
  // 2) preço sugerido pela precificação por comparáveis ponderados (2.2), se existir.
  let precoM2 = 0;
  if (estudo.precificacaoComparaveisJson) {
    try {
      const salvo = JSON.parse(estudo.precificacaoComparaveisJson) as {
        atributos: AtributoComparavel[]; notasNovo: number[]; comparaveis: Comparavel[];
      };
      const r = calcularPrecificacaoPorComparaveis(salvo.atributos, salvo.notasNovo, salvo.comparaveis);
      if (r.precoSugeridoM2 > 0) precoM2 = r.precoSugeridoM2;
    } catch { /* ignora */ }
  }
  // 3) senão, preço sugerido pela pesquisa de Cidade & Mercado (IA), se existir.
  if (!precoM2 && estudo.estudoMercadoJson) {
    try {
      const m = JSON.parse(estudo.estudoMercadoJson) as { precoM2Lote?: number };
      if (m.precoM2Lote) precoM2 = m.precoM2Lote;
    } catch { /* ignora */ }
  }
  return [{ nome: "Lotes", quantidade: 100, areaUnidadeM2: 160, precoM2: precoM2 || 500 }];
}

function paraMotor(f: PremissasForm, itensMix: ItemMixProduto[], pctAPP: number): PremissasLoteamento {
  const pct = (v: number) => v / 100;
  return {
    areaBrutaM2: f.areaBrutaM2,
    pctAreaPublica: pct(f.pctAreaPublica),
    pctAreaVerde: pct(f.pctAreaVerde),
    pctSistemaViario: pct(f.pctSistemaViario),
    pctAPP,
    pctFaixaServidao: pct(f.pctFaixaServidao),
    itensMix,
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
    taxaIncorporacaoPctVgv: pct(f.taxaIncorporacaoPctVgv),
    inicioObraMes: f.inicioObraMes,
    duracaoObraMeses: f.duracaoObraMeses,
    inicioVendasMes: f.inicioVendasMes,
    custoInfraM2Lote: f.custoInfraM2Lote,
    projetosLicencas: f.projetosLicencas,
    marketing: f.marketing,
    registroPorUnidade: f.registroPorUnidade,
    contingenciaPctInfra: pct(f.contingenciaPctInfra),
    bdiPct: pct(f.bdiPct),
    taxaAdministracaoObraPct: pct(f.taxaAdministracaoObraPct),
    manutencaoPctObra: pct(f.manutencaoPctObra),
    inccObraMensal: pct(f.inccObraMensal),
    permutaPctVgv: pct(f.permutaPctVgv),
    taxaDescontoAnual: pct(f.taxaDescontoAnual),
  };
}

/**
 * Reconstrói as premissas completas do motor a partir do estudo salvo — usada
 * pelo Relatório consolidado para gerar os mesmos indicadores da aba
 * Viabilidade sem duplicar a lógica de conversão de formulário → motor.
 * Retorna null se o estudo ainda não tem premissas de viabilidade salvas.
 */
export function montarPremissasLoteamento(estudo: EstudoData): PremissasLoteamento | null {
  if (!estudo.loteamentoJson) return null;
  let salvo: (Partial<PremissasForm> & { itensMix?: ItemMixProduto[] }) | null = null;
  try {
    salvo = JSON.parse(estudo.loteamentoJson);
  } catch {
    return null;
  }
  if (!salvo) return null;

  const form: PremissasForm = { ...defaultsForm(estudo), ...salvo };
  const itensMix = salvo.itensMix && salvo.itensMix.length > 0 ? salvo.itensMix : defaultsMix(estudo);
  const appAreaM2 = estudo.appAreaM2 ?? 0;
  const pctAPP = form.areaBrutaM2 > 0 ? appAreaM2 / form.areaBrutaM2 : 0;
  return paraMotor(form, itensMix, pctAPP);
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

export function ViabilidadeTab({ estudo }: { estudo: EstudoData }) {
  const salvo = estudo.loteamentoJson ? JSON.parse(estudo.loteamentoJson) : null;

  const [form, setForm] = useState<PremissasForm>(() => {
    if (salvo) {
      try { return { ...defaultsForm(estudo), ...(salvo as Partial<PremissasForm>) }; }
      catch { /* premissas corrompidas → defaults */ }
    }
    return defaultsForm(estudo);
  });
  const [mix, setMix] = useState<ItemMixProduto[]>(() => {
    if (salvo?.itensMix && Array.isArray(salvo.itensMix) && salvo.itensMix.length > 0) {
      return salvo.itensMix as ItemMixProduto[];
    }
    return defaultsMix(estudo);
  });

  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioId>("ideal");
  const [pending, startTransition] = useTransition();
  const [salvoOk, setSalvoOk] = useState(false);

  const set = <K extends keyof PremissasForm>(k: K) => (v: PremissasForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvoOk(false);
  };

  function addProduto() {
    setMix((m) => [...m, { nome: "Novo produto", quantidade: 0, areaUnidadeM2: 0, precoM2: 0 }]);
    setSalvoOk(false);
  }
  function updProduto(i: number, campo: keyof ItemMixProduto, valor: string) {
    setMix((m) => {
      const novo = [...m];
      novo[i] = { ...novo[i], [campo]: campo === "nome" ? valor : parseFloat(valor) || 0 };
      return novo;
    });
    setSalvoOk(false);
  }
  function removerProduto(i: number) {
    setMix((m) => m.filter((_, j) => j !== i));
    setSalvoOk(false);
  }

  // APP: SEMPRE calculada automaticamente a partir do mapa (aba Terreno) — nunca
  // um campo editável. Se o mapa ainda não calculou nada, assume 0.
  const appAreaM2 = estudo.appAreaM2 ?? 0;
  const pctAPP = form.areaBrutaM2 > 0 ? appAreaM2 / form.areaBrutaM2 : 0;

  const cenarios = useMemo(
    () => calcularCenarios(paraMotor(form, mix, pctAPP)),
    [form, mix, pctAPP]
  );
  const r: ResultadoLoteamento = cenarios[cenarioAtivo];
  const urb = r.urbanistico;

  const dadosGrafico = useMemo(
    () => r.fluxo.map((f) => ({ mes: f.mes, saldo: f.saldoAcumulado })),
    [r]
  );

  const anosReceita = useMemo(() => recebimentosPorAno(r), [r]);
  const anosCusto = useMemo(() => custosPorAno(r), [r]);

  const metaRelatorio: MetaRelatorio = {
    nome: estudo.nome,
    municipio: estudo.municipio,
    estado: estudo.estado,
    permutaPct: form.permutaPctVgv,
    taxaDescontoAnual: form.taxaDescontoAnual,
  };

  function salvar() {
    startTransition(async () => {
      await salvarViabilidade(estudo.id, JSON.stringify({ ...form, itensMix: mix }));
      setSalvoOk(true);
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
          {pending ? <Loader2 size={13} className="animate-spin" /> : salvoOk ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {pending ? "Salvando..." : salvoOk ? "Premissas salvas" : "Salvar premissas"}
        </button>
      </div>

      {/* ── Mix de produtos ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mix de produtos</p>
        <p className="text-[11px] text-gray-400 mb-3">
          Aqui você define o que vai ser vendido: só lotes, lotes + casas, área de prédio para apartamentos, comercial — qualquer combinação. Cada linha é um produto do mix (VGV = quantidade × área × preço/m²).
        </p>
        <div className="grid grid-cols-12 gap-2 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-0.5">
          <span className="col-span-5">Produto</span>
          <span className="col-span-2">Quantidade</span>
          <span className="col-span-2">Área/unid. (m²)</span>
          <span className="col-span-2">R$/m²</span>
        </div>
        <div className="space-y-3">
          {mix.map((p, i) => (
            <div key={i} className="border border-gray-100 p-2.5 space-y-1.5">
              <div className="grid grid-cols-12 gap-2 items-center">
                <input value={p.nome} onChange={(e) => updProduto(i, "nome", e.target.value)}
                  className="col-span-5 text-sm border border-gray-200 px-2 py-1.5" placeholder="Ex.: Lotes, Casas, Apartamentos" />
                <input type="number" value={p.quantidade || ""} onChange={(e) => updProduto(i, "quantidade", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="Qtd" />
                <input type="number" value={p.areaUnidadeM2 || ""} onChange={(e) => updProduto(i, "areaUnidadeM2", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="Área m²" />
                <input type="number" value={p.precoM2 || ""} onChange={(e) => updProduto(i, "precoM2", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="R$/m²" />
                <button type="button" onClick={() => removerProduto(i)}
                  className="col-span-1 text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
              </div>
              <p className="text-xs text-right text-gray-500">
                VGV do produto: <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(p.quantidade * p.areaUnidadeM2 * p.precoM2)}</span>
              </p>
            </div>
          ))}
        </div>
        <button type="button" onClick={addProduto} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar produto
        </button>
        <p className="text-[11px] text-gray-400 mt-2">
          Capacidade estimada do terreno com o tamanho médio atual do mix: <b>{urb.capacidadeEstimadaUnidades.toLocaleString("pt-BR")} unidades</b>
          {" "}({fmtM2(urb.areaVendavelM2)} vendável ÷ {r.mix.totalUnidades > 0 ? Math.round(r.mix.areaVendidaM2 / r.mix.totalUnidades) : 0} m² médios por unidade).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Secao titulo="Terreno & Urbanístico">
          <Num label="Área bruta" sufixo="m²" value={form.areaBrutaM2} onChange={set("areaBrutaM2")} step={100} />
          <Num label="Área pública" sufixo="%" value={form.pctAreaPublica} onChange={set("pctAreaPublica")} step={0.1} />
          <Num label="Área verde" sufixo="%" value={form.pctAreaVerde} onChange={set("pctAreaVerde")} step={0.1} />
          <Num label="Sistema viário" sufixo="%" value={form.pctSistemaViario} onChange={set("pctSistemaViario")} step={0.1} />
          <Num label="Faixa de servidão" sufixo="%" value={form.pctFaixaServidao} onChange={set("pctFaixaServidao")} step={0.1} />
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">APP (automática)</label>
            <div className="w-full border border-green-200 bg-green-50 px-2.5 py-2 text-sm text-green-800 font-bold">
              {fmtM2(appAreaM2)} ({(pctAPP * 100).toFixed(1)}%)
            </div>
          </div>
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
          <Num label="Taxa de desconto (VPL/TMA)" sufixo="% a.a." value={form.taxaDescontoAnual} onChange={set("taxaDescontoAnual")} step={0.5} />
        </Secao>

        <Secao titulo="Custos">
          <Num label="Infra por m² vendido" sufixo="R$/m²" value={form.custoInfraM2Lote} onChange={set("custoInfraM2Lote")} />
          <Num label="Projetos e licenças" sufixo="R$" value={form.projetosLicencas} onChange={set("projetosLicencas")} step={1000} />
          <Num label="Marketing" sufixo="R$" value={form.marketing} onChange={set("marketing")} step={1000} />
          <Num label="Registro por unidade" sufixo="R$" value={form.registroPorUnidade} onChange={set("registroPorUnidade")} />
          <Num label="Contingência" sufixo="% infra" value={form.contingenciaPctInfra} onChange={set("contingenciaPctInfra")} step={0.5} />
          <Num label="BDI" sufixo="% infra" value={form.bdiPct} onChange={set("bdiPct")} step={0.5} />
          <Num label="Taxa adm. da obra" sufixo="% obra" value={form.taxaAdministracaoObraPct} onChange={set("taxaAdministracaoObraPct")} step={0.5} />
          <Num label="Manutenção pós-obra" sufixo="% obra" value={form.manutencaoPctObra} onChange={set("manutencaoPctObra")} step={0.1} />
          <Num label="Taxa de incorporação" sufixo="% VGV" value={form.taxaIncorporacaoPctVgv} onChange={set("taxaIncorporacaoPctVgv")} step={0.1} />
          <Num label="Correção INCC da obra" sufixo="% a.m." value={form.inccObraMensal} onChange={set("inccObraMensal")} step={0.05} />
        </Secao>
      </div>

      {/* ── Resultado urbanístico ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resultado do estudo urbanístico</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kpi label="Capacidade estimada" valor={urb.capacidadeEstimadaUnidades.toLocaleString("pt-BR")} destaque />
          <Kpi label="Área líquida vendável" valor={fmtM2(urb.areaVendavelM2)} />
          <Kpi label="Taxa de aproveitamento" valor={fmtPct(urb.taxaAproveitamento)} />
          <Kpi label="Preço médio/unidade (mix)" valor={formatCurrency(r.mix.precoMedioUnidade)} />
        </div>
        <div className="space-y-1 text-xs">
          {[
            { label: "Área bruta total", v: urb.areaBrutaM2 },
            { label: "Área pública", v: urb.areaPublicaM2 },
            { label: "Área verde", v: urb.areaVerdeM2 },
            { label: "Sistema viário", v: urb.areaViarioM2 },
            { label: "APP (automática)", v: urb.areaAppM2 },
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
          <Linha label="VGV bruto (mix de produtos)" valor={formatCurrency(r.vgvGross)} />
          <Linha label="VGV líquido" valor={formatCurrency(r.vgvNet)} sub="após comissões, despesas e impostos" />
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custos</p>
          <Linha label="Infraestrutura (c/ BDI)" valor={formatCurrency(r.custoInfra)} />
          <Linha label="Pré-venda (capital próprio, hoje)" valor={formatCurrency(r.custosPreVenda)} />
          <Linha label="Durante vendas (com receita)" valor={formatCurrency(r.custosDuranteVenda)} />
          <Linha label="Total geral (hoje)" valor={formatCurrency(r.custoTotal)} forte />
          <Linha label="Total nominal (futuro, c/ INCC)" valor={formatCurrency(r.custoTotalNominal)} sub="estimativa de custos totais futuros" />
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Distribuição de recebíveis</p>
          <Linha label={`Você recebe (${(100 - form.permutaPctVgv).toFixed(0)}%)`} valor={formatCurrency(r.recebiveis.voce)} forte />
          <Linha label={`Terreneiro (${form.permutaPctVgv.toFixed(0)}%)`} valor={formatCurrency(r.recebiveis.terreneiro)} />
          <Linha label="Total a receber" valor={formatCurrency(r.recebiveis.total)} />
          <div className="mt-2 pt-2 border-t border-gray-50">
            <Linha
              label="Break-even"
              valor={`${r.breakEven.unidadesNecessarias.toLocaleString("pt-BR")} unidades`}
              sub={urb.capacidadeEstimadaUnidades > 0 ? `${((r.breakEven.unidadesNecessarias / urb.capacidadeEstimadaUnidades) * 100).toFixed(1)}% da capacidade` : undefined}
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
          Valores calculados por fórmulas determinísticas (VPL a {form.taxaDescontoAnual}% a.a., parcelas indexadas, inadimplência, correção INCC da obra e permuta considerados). Estudo preliminar — não substitui projeto executivo nem análise contratual. Financiamento bancário/fundo de investidores ainda não modelado nesta versão.
        </p>
      </div>

      {/* ── Tabela comparativa completa ── */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tabela comparativa completa</p>
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="bg-[var(--brand-dark)]">
              {["Métrica", "Conservador (−10%)", "Ideal", "Agressivo (+10%)"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {([
              ["VGV bruto", (x: ResultadoLoteamento) => formatCurrency(x.vgvGross), false],
              ["VPL", (x: ResultadoLoteamento) => formatCurrency(x.vpl), true],
              ["TIR (a.a.)", (x: ResultadoLoteamento) => (x.tirAnual != null ? `${(x.tirAnual * 100).toFixed(2)}%` : "—"), false],
              ["ROI", (x: ResultadoLoteamento) => fmtPct(x.roi), false],
              ["Margem líquida", (x: ResultadoLoteamento) => fmtPct(x.margemLiquida), false],
              ["Payback", (x: ResultadoLoteamento) => (x.paybackMes != null ? `${x.paybackMes} meses` : "não recupera"), false],
              ["Exposição máxima", (x: ResultadoLoteamento) => formatCurrency(x.exposicaoMaxima), false],
              ["Custo total (hoje)", (x: ResultadoLoteamento) => formatCurrency(x.custoTotal), false],
              ["Custo total nominal (futuro)", (x: ResultadoLoteamento) => formatCurrency(x.custoTotalNominal), false],
              ["Recebível (você)", (x: ResultadoLoteamento) => formatCurrency(x.recebiveis.voce), false],
            ] as [string, (x: ResultadoLoteamento) => string, boolean][]).map(([label, f, colorir]) => (
              <tr key={label}>
                <td className="px-3 py-2 text-gray-500 font-medium">{label}</td>
                {(["conservador", "ideal", "agressivo"] as CenarioId[]).map((id) => {
                  const c = cenarios[id];
                  const negVpl = colorir && c.vpl < 0;
                  return (
                    <td key={id} className={`px-3 py-2 font-bold ${negVpl ? "text-red-500" : "text-[var(--brand-dark)]"} ${cenarioAtivo === id ? "bg-[var(--brand-yellow)]/10" : ""}`}>
                      {f(c)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Recebimentos e custos por ano ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Recebimentos por ano</p>
          <p className="text-[10px] text-gray-400 mb-3">Valores brutos projetados e a divisão entre incorporador e terreneiro (cenário {CENARIO_META.find((c) => c.id === cenarioAtivo)?.label}).</p>
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="bg-[var(--brand-dark)]">
                {["Ano", "Total (bruto)", `Você (${(100 - form.permutaPctVgv).toFixed(0)}%)`, "Terreneiro"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {anosReceita.map((a) => (
                <tr key={a.ano}>
                  <td className="px-3 py-2 text-gray-500 font-medium">Ano {a.ano}</td>
                  <td className="px-3 py-2 font-bold text-[var(--brand-dark)]">{formatCurrency(a.bruto)}</td>
                  <td className="px-3 py-2 font-bold text-green-700">{formatCurrency(a.voce)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.terreneiro)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-3 py-2 font-black text-[var(--brand-dark)]">Total</td>
                <td className="px-3 py-2 font-black text-[var(--brand-dark)]">{formatCurrency(r.recebiveis.total)}</td>
                <td className="px-3 py-2 font-black text-green-700">{formatCurrency(r.recebiveis.voce)}</td>
                <td className="px-3 py-2 font-black text-gray-700">{formatCurrency(r.recebiveis.terreneiro)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Custos futuros por ano</p>
          <p className="text-[10px] text-gray-400 mb-3">Estimativa de custos totais futuros — valores nominais (obra já com correção INCC mês a mês).</p>
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="bg-[var(--brand-dark)]">
                {["Ano", "Pré-venda", "Durante vendas", "Total do ano"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {anosCusto.map((a) => (
                <tr key={a.ano}>
                  <td className="px-3 py-2 text-gray-500 font-medium">Ano {a.ano}</td>
                  <td className="px-3 py-2 font-bold text-[var(--brand-dark)]">{formatCurrency(a.preVenda)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.duranteVenda)}</td>
                  <td className="px-3 py-2 font-bold text-red-500">{formatCurrency(a.total)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-3 py-2 font-black text-[var(--brand-dark)]">Total nominal</td>
                <td colSpan={2} />
                <td className="px-3 py-2 font-black text-red-600">{formatCurrency(r.custoTotalNominal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Relatórios PDF ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Relatórios</p>
        <p className="text-[10px] text-gray-400 mb-3">Gerados na hora, no seu navegador, a partir das premissas atuais — sem custo.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Relatório Executivo", acao: () => gerarRelatorioExecutivo(metaRelatorio, cenarios) },
            {
              label: "Relatório de Custos",
              acao: () => gerarRelatorioCustos(metaRelatorio, cenarios, {
                projetosLicencas: form.projetosLicencas,
                marketing: form.marketing,
                registroPorUnidade: form.registroPorUnidade,
                contingenciaPct: form.contingenciaPctInfra,
                bdiPct: form.bdiPct,
                comissaoPct: form.comissaoPctVgv,
                despesasPct: form.despesasGeraisPctVgv,
                impostosPct: form.impostosPctVgv,
              }),
            },
            { label: "Relatório do Terreneiro", acao: () => gerarRelatorioTerreneiro(metaRelatorio, cenarios) },
          ].map(({ label, acao }) => (
            <button
              key={label}
              type="button"
              onClick={acao}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] transition-colors"
            >
              <FileText size={13} /> {label} <Download size={11} className="text-gray-400" />
            </button>
          ))}
        </div>
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
