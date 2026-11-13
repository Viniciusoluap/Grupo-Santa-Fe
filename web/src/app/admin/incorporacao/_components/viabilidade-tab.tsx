"use client";
import { useMemo, useState, useTransition } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Save, Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  calcularCenarios,
  type ResultadoLoteamento,
  type ItemMixProduto,
  type PerfilVendas,
} from "@/lib/finance/loteamento";
import {
  defaultsForm,
  sincronizarUrbanismo,
  urbanismoDoCenario,
  appDaViabilidade,
  defaultsMix,
  montarViabilidade,
  type PremissasForm,
} from "@/lib/incorporacao/premissas-loteamento";
import { composicaoFinanceira, type ModoFonte } from "@/lib/incorporacao/composicao-custos";
import { vgvItemMix } from "@/lib/finance/loteamento";
import {
  recebimentosPorAno,
  custosPorAno,
  vendasPorAno,
  fluxoPorAno,
  textoPayback,
} from "@/lib/pdf/loteamento";
import { salvarViabilidade } from "@/lib/actions/incorporacao";
import { exigirResultado } from "@/lib/acao-resultado";
import { formatCurrency, formatArea } from "@/lib/utils";
import { NumeroInput } from "@/components/ui/numero-input";
import { NumeroBRField } from "@/components/ui/numero-br-field";
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

const PERFIS: { value: PerfilVendas; label: string }[] = [
  { value: "lancamento_forte", label: "Lançamento Forte" },
  { value: "organico", label: "Crescimento Orgânico" },
  { value: "constante", label: "Ritmo Constante" },
  { value: "fechamento_forte", label: "Fechamento Forte" },
];

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
        {label}{sufixo ? <span className="text-gray-500 normal-case font-normal"> ({sufixo})</span> : null}
      </label>
      <NumeroInput aria-label={label} value={Number.isFinite(value) ? value : 0} casas={sufixo === "meses" || sufixo === "mês" ? 0 : 2} onChange={(v) => onChange(v ?? 0)} className={inputCls} />
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
  return formatArea(v);
}

function fmtPct(v: number, casas = 1) {
  return `${(v * 100).toFixed(casas)}%`;
}

export function ViabilidadeTab({ estudo }: { estudo: EstudoData }) {
  let salvo = null;
  try { salvo = estudo.loteamentoJson ? JSON.parse(estudo.loteamentoJson) : null; } catch { /* preserva o formulário diante de JSON inválido */ }

  const [formBase, setForm] = useState<PremissasForm>(() => {
    if (salvo) {
      try { return { ...defaultsForm(estudo), ...(salvo as Partial<PremissasForm>) }; }
      catch { /* premissas corrompidas → defaults */ }
    }
    return defaultsForm(estudo);
  });
  const form = sincronizarUrbanismo(estudo, formBase);
  const origemUrbanismo = urbanismoDoCenario(estudo);
  const lotesOrigem = origemUrbanismo?.lotes ?? [];
  const areaMediaLote = lotesOrigem.length > 0 ? Math.round((lotesOrigem.reduce((s, l) => s + (l.areaM2 || 0), 0) / lotesOrigem.length) * 100) / 100 : 0;
  const [mixBase, setMix] = useState<ItemMixProduto[]>(() => {
    if (salvo?.itensMix && Array.isArray(salvo.itensMix) && salvo.itensMix.length > 0) {
      return salvo.itensMix as ItemMixProduto[];
    }
    return defaultsMix(estudo);
  });

  const mix = form.mixModo === "cenario" ? defaultsMix(estudo) : mixBase;

  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioId>("ideal");
  const [pending, startTransition] = useTransition();
  const [salvoOk, setSalvoOk] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const set = <K extends keyof PremissasForm>(k: K) => (v: PremissasForm[K]) => {
    const campoUrbanistico = ["areaBrutaM2", "pctAreaPublica", "pctAreaVerde", "pctSistemaViario", "pctFaixaServidao"].includes(k);
    // Correção 09: editar um valor NÃO troca a fonte; a fonte só muda pelo seletor "Valor manual / Valor do sistema"
    setForm({ ...form, [k]: v, urbanismoModo: campoUrbanistico ? "manual" : form.urbanismoModo });
    setSalvoOk(false);
  };

  function addProduto() {
    setForm({ ...form, mixModo: "manual" });
    setMix([...mix, { nome: "Novo produto", quantidade: 0, areaUnidadeM2: 0, precoM2: 0 }]);
    setSalvoOk(false);
  }
  function updProduto(i: number, campo: keyof ItemMixProduto, valor: string | number | boolean) {
    setForm({ ...form, mixModo: "manual" });
    setMix(() => {
      const novo = [...mix];
      // alternar "Casa pronta" só muda a forma de cálculo: área, R$/m² e valor por unidade ficam preservados
      novo[i] = { ...novo[i], [campo]: campo === "nome" || campo === "casaPronta" ? valor : (typeof valor === "number" ? valor : parseFloat(String(valor)) || 0) };
      // Casa Pronta sem área: sugere a área média dos lotes do cenário/lotes avulsos (editável)
      if (campo === "casaPronta" && valor === true && !(novo[i].areaUnidadeM2 > 0) && areaMediaLote > 0) novo[i] = { ...novo[i], areaUnidadeM2: areaMediaLote };
      return novo;
    });
    setSalvoOk(false);
  }
  function removerProduto(i: number) {
    setForm({ ...form, mixModo: "manual" });
    setMix(mix.filter((_, j) => j !== i));
    setSalvoOk(false);
  }

  // APP: SEMPRE calculada automaticamente a partir do mapa (aba Terreno) — nunca
  // um campo editável. Se o mapa ainda não calculou nada, assume 0.
  const appAreaM2 = appDaViabilidade(estudo, form);
  const pctAPP = form.areaBrutaM2 > 0 ? appAreaM2 / form.areaBrutaM2 : 0;

  const viab = useMemo(() => montarViabilidade(estudo, form, mix, pctAPP), [estudo, form, mix, pctAPP]);
  const fontes = viab.fontes;
  const cfg = fontes.config;
  const cenarios = useMemo(() => calcularCenarios(viab.premissas), [viab]);
  const r: ResultadoLoteamento = cenarios[cenarioAtivo];
  const composicao = useMemo(() => composicaoFinanceira(viab.premissas, r, fontes), [viab, r, fontes]);
  const unidadesDisponiveis = origemUrbanismo?.lotes.length ?? 0;
  const unidadesMix = mix.reduce((s, p) => s + (Number.isFinite(p.quantidade) ? p.quantidade : 0), 0);
  const temCasaPronta = mix.some((p) => p.casaPronta);
  const temLoteSeparado = mix.some((p) => !p.casaPronta && /lote/i.test(p.nome));
  const setFonte = (campo: "custoInfraFonte" | "marketingFonte" | "terrenoFonte") => (v: ModoFonte) => { setForm({ ...form, [campo]: v }); setSalvoOk(false); };
  const urb = r.urbanistico;

  const dadosGrafico = useMemo(
    () => r.fluxo.map((f) => ({ mes: f.mes, saldo: f.saldoAcumulado })),
    [r]
  );

  const anosReceita = useMemo(() => recebimentosPorAno(r), [r]);
  const anosCusto = useMemo(() => custosPorAno(r), [r]);
  const anosVenda = useMemo(() => vendasPorAno(r), [r]);
  const anosFluxo = useMemo(() => fluxoPorAno(r), [r]);

  function salvar() {
    startTransition(async () => {
      setErroSalvar(null);
      try {
        // grava também as fontes efetivas (manual/sistema), para o Relatório e as demais abas lerem o mesmo
        exigirResultado(await salvarViabilidade(estudo.id, JSON.stringify({ ...form, custoInfraFonte: cfg.custoInfraFonte, marketingFonte: cfg.marketingFonte, terrenoFonte: cfg.terrenoFonte, considerarCaptacao: cfg.considerarCaptacao, itensMix: mix })));
        setSalvoOk(true);
      } catch (e) {
        setErroSalvar(e instanceof Error ? e.message : "Não foi possível salvar as premissas.");
      }
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
      {erroSalvar && <p className="text-xs font-bold text-red-600">{erroSalvar}</p>}
      {fontes.avisos.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          {fontes.avisos.map((a) => <p key={a}>{a}</p>)}
        </div>
      )}
      {/* ── Mix de produtos ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mix de produtos</p>
        <p className="text-[11px] text-gray-600 mb-3">
          Aqui você define o que vai ser vendido: só lotes, lotes + casas, área de prédio para apartamentos, comercial — qualquer combinação. Cada linha é um produto do mix (VGV = quantidade × área × preço/m²). Marque <b>Casa pronta</b> quando a casa (com o lote) é vendida por unidade: VGV = quantidade × valor de venda por unidade.
        </p>
        {mix.some((p) => !p.casaPronta) && <div className="grid grid-cols-12 gap-2 mb-1 text-[10px] font-bold text-gray-600 uppercase tracking-wide px-0.5">
          <span className="col-span-5">Produto</span>
          <span className="col-span-2">Quantidade</span>
          <span className="col-span-2">Área/unid. (m²)</span>
          <span className="col-span-2">R$/m²</span>
        </div>}
        <div className="space-y-3">
          {mix.map((p, i) => (
            <div key={i} className="border border-gray-100 p-2.5 space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                <input type="checkbox" checked={!!p.casaPronta} onChange={(e) => updProduto(i, "casaPronta", e.target.checked)} />
                Casa pronta
              </label>
              {p.casaPronta ? (
              <div className="grid grid-cols-12 gap-2 items-center">
                <label className="col-span-4 text-[10px] font-bold text-gray-600 uppercase">Produto
                  <input value={p.nome} onChange={(e) => updProduto(i, "nome", e.target.value)} className="w-full text-sm border border-gray-200 px-2 py-1.5 normal-case font-normal text-gray-800" placeholder="Ex.: Casa 2 quartos" /></label>
                <label className="col-span-2 text-[10px] font-bold text-gray-600 uppercase">Quantidade
                  <input type="number" value={p.quantidade || ""} onChange={(e) => updProduto(i, "quantidade", e.target.value)} className="w-full text-sm border border-gray-200 px-2 py-1.5 font-normal text-gray-800" placeholder="Qtd" /></label>
                <label className="col-span-2 text-[10px] font-bold text-gray-600 uppercase" title="Área do LOTE de cada casa (não a área construída): base do custo de infraestrutura por m².">Área do lote (m²)
                  <NumeroBRField value={p.areaUnidadeM2} onValueChange={(v) => updProduto(i, "areaUnidadeM2", v)} className={`w-full text-sm border px-2 py-1.5 font-normal text-gray-800 ${p.areaUnidadeM2 > 0 ? "border-gray-200" : "border-red-400"}`} placeholder="m² do lote" /></label>
                <label className="col-span-3 text-[10px] font-bold text-gray-600 uppercase">Valor de venda por unidade (R$)
                  <NumeroBRField value={p.precoUnidade ?? 0} onValueChange={(v) => updProduto(i, "precoUnidade", v)} className="w-full text-sm border border-gray-200 px-2 py-1.5 font-normal text-gray-800" placeholder="R$ por unidade" /></label>
                <button type="button" onClick={() => removerProduto(i)}
                  className="col-span-1 text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
              </div>
              ) : (
              <div className="grid grid-cols-12 gap-2 items-center">
                <input value={p.nome} onChange={(e) => updProduto(i, "nome", e.target.value)}
                  className="col-span-5 text-sm border border-gray-200 px-2 py-1.5" placeholder="Ex.: Lotes, Casas, Apartamentos" />
                <input type="number" value={p.quantidade || ""} onChange={(e) => updProduto(i, "quantidade", e.target.value)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="Qtd" />
                <NumeroBRField value={p.areaUnidadeM2} onValueChange={(v) => updProduto(i, "areaUnidadeM2", v)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="Área m²" />
                <NumeroBRField value={p.precoM2} onValueChange={(v) => updProduto(i, "precoM2", v)}
                  className="col-span-2 text-sm border border-gray-200 px-2 py-1.5" placeholder="R$/m²" />
                <button type="button" onClick={() => removerProduto(i)}
                  className="col-span-1 text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
              </div>
              )}
              <p className="text-xs text-right text-gray-500">
                {p.casaPronta && !(p.areaUnidadeM2 > 0) ? <span className="block text-left font-bold text-red-600">Informe a área do lote: sem ela, o custo de infraestrutura por m² desta linha fica zerado.</span> : null}
                {p.casaPronta ? `${(p.quantidade || 0).toLocaleString("pt-BR")} × ${formatCurrency(p.precoUnidade ?? 0)} = ` : null}
                VGV do produto: <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(vgvItemMix(p))}</span>
              </p>
            </div>
          ))}
        </div>
        <button type="button" onClick={addProduto} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar produto
        </button>
        <p className="text-[11px] text-gray-600 mt-2">
          Capacidade estimada do terreno com o tamanho médio atual do mix: <b>{urb.capacidadeEstimadaUnidades.toLocaleString("pt-BR")} unidades</b>
          {" "}({fmtM2(urb.areaVendavelM2)} vendável ÷ {formatArea(r.mix.totalUnidades > 0 ? r.mix.areaVendidaM2 / r.mix.totalUnidades : 0)} médios por unidade).
        </p>
        {unidadesDisponiveis > 0 && (
          <p className={`text-[11px] mt-1 ${unidadesMix > unidadesDisponiveis ? "font-bold text-red-600" : "text-gray-500"}`}>
            Unidades do mix: {unidadesMix.toLocaleString("pt-BR")} · lotes disponíveis no {origemUrbanismo?.origem === "lotes_avulsos" ? "cadastro de lotes avulsos" : "cenário"}: {unidadesDisponiveis.toLocaleString("pt-BR")}
            {unidadesMix > unidadesDisponiveis ? " — o mix tem mais unidades do que lotes disponíveis." : ""}
          </p>
        )}
        {temCasaPronta && temLoteSeparado && (
          <p className="text-[11px] mt-1 font-bold text-amber-700">Atenção: há uma Casa Pronta e também um produto de lote. A Casa Pronta já inclui o lote no valor por unidade — não cadastre o mesmo lote duas vezes, para não duplicar o VGV.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Secao titulo="Terreno & Urbanístico">
          <div className="col-span-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <p>{form.urbanismoModo === "cenario" ? `Sincronizado com o cenário: ${origemUrbanismo?.cenarioId ?? (estudo.semKml ? "lotes avulsos" : "aguardando cenário salvo")}` : "Ajustes manuais preservados. Editar uma área interrompe a sincronização automática."}</p>
            {origemUrbanismo?.quadroAreas && <>
              <p className="mt-1">Área pública total: {fmtM2(origemUrbanismo.quadroAreas.areaPublicaTotalM2)} · Institucional: {fmtM2(origemUrbanismo.quadroAreas.areaInstitucionalM2)} · Vendável: {fmtM2(origemUrbanismo.quadroAreas.areaLiquidaVendavelM2)}</p>
              <p className="mt-1">Supressão: {fmtM2(origemUrbanismo.quadroAreas.supressaoVegetalM2)} · Transmissão: {fmtM2(origemUrbanismo.quadroAreas.faixaTransmissaoM2)} · Servidão: {fmtM2(origemUrbanismo.quadroAreas.faixaServidaoM2)} · Outras restrições: {fmtM2(origemUrbanismo.quadroAreas.outrasNaoParcelaveisM2)}</p>
              <button type="button" className="mt-2 font-bold underline" onClick={() => { if (form.urbanismoModo !== "manual" || confirm("Substituir os ajustes manuais pelas áreas do cenário selecionado?")) { setForm({ ...form, urbanismoModo: "cenario", mixModo: "cenario" }); setSalvoOk(false); } }}>Usar cenário selecionado</button>
            </>}
          </div>
          <Num label="Área bruta" sufixo="m²" value={form.areaBrutaM2} onChange={set("areaBrutaM2")} step={100} />
          <Num label="Área institucional" sufixo="%" value={form.pctAreaPublica} onChange={set("pctAreaPublica")} step={0.1} />
          <Num label="Área verde" sufixo="%" value={form.pctAreaVerde} onChange={set("pctAreaVerde")} step={0.1} />
          <Num label="Sistema viário" sufixo="%" value={form.pctSistemaViario} onChange={set("pctSistemaViario")} step={0.1} />
          <Num label="Restrições exceto APP" sufixo="%" value={form.pctFaixaServidao} onChange={set("pctFaixaServidao")} step={0.1} />
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
          <Num label="Taxa de desconto (VPL/TMA)" sufixo="% a.a." value={form.taxaDescontoAnual} onChange={set("taxaDescontoAnual")} step={0.5} />
          <FonteSelect label="Custo do terreno" valor={cfg.terrenoFonte} onChange={setFonte("terrenoFonte")} />
          <Num label="1º pagamento do terreno" sufixo="mês" value={cfg.terrenoMesInicio} onChange={set("terrenoMesInicio")} />
          {cfg.terrenoFonte === "sistema" ? (
            <div className="col-span-full text-xs text-gray-700 border border-gray-200 bg-gray-50 p-2.5">
              {fontes.terreno.disponivel ? <>
                <p><b>Negociação do Terreno — {fontes.terreno.modalidade}</b>{fontes.terreno.proposta ? ` (proposta de ${fontes.terreno.proposta.data}, ${fontes.terreno.proposta.status})` : ""}</p>
                {fontes.terreno.valorAquisicao > 0 && <p>Aquisição: {formatCurrency(fontes.terreno.valorAquisicao)} em {fontes.terreno.desembolsos.length}× ({fontes.terreno.desembolsos.length > 0 ? `M${fontes.terreno.desembolsos[0].mes}–M${fontes.terreno.desembolsos[fontes.terreno.desembolsos.length - 1].mes}` : "—"})</p>}
                {fontes.terreno.permutaFinanceiraPct > 0 && <p>Permuta financeira: {fontes.terreno.permutaFinanceiraPct.toLocaleString("pt-BR")}% dos recebimentos ao terreneiro</p>}
                {fontes.terreno.permutaFisicaUnidades > 0 && <p>Permuta física: {fontes.terreno.permutaFisicaUnidades} unidade(s) ao proprietário (não vendáveis)</p>}
              </> : <p>{fontes.terreno.motivo}</p>}
            </div>
          ) : (<>
            <Num label="Valor do terreno (compra)" sufixo="R$" value={form.custoTerrenoManual ?? 0} onChange={set("custoTerrenoManual")} step={1000} />
            <Num label="Parcelas do terreno" sufixo="meses" value={cfg.terrenoParcelasManual} onChange={set("terrenoParcelasManual")} />
            <Num label="Permuta financeira" sufixo="% recebimentos" value={form.permutaPctVgv} onChange={set("permutaPctVgv")} step={0.5} />
            <Num label="Permuta física" sufixo="unidades" value={cfg.permutaFisicaUnidadesManual} onChange={set("permutaFisicaUnidadesManual")} />
          </>)}
          <div className="col-span-full flex items-center gap-2 text-xs text-gray-700">
            <input id="considerar-captacao" type="checkbox" checked={cfg.considerarCaptacao} onChange={(e) => { setForm({ ...form, considerarCaptacao: e.target.checked }); setSalvoOk(false); }} />
            <label htmlFor="considerar-captacao">
              Considerar a captação do Business Plan no fluxo
              {fontes.captacao.disponivel ? ` — ${formatCurrency(fontes.captacao.capitalTotal)} captados; custo da captação ${formatCurrency(fontes.captacao.custoTotal)}` : " (nenhuma fonte cadastrada)"}
            </label>
          </div>
        </Secao>

        <Secao titulo="Custos">
          <FonteSelect label="Infra por m² vendido — fonte" valor={cfg.custoInfraFonte} onChange={setFonte("custoInfraFonte")} />
          {cfg.custoInfraFonte === "manual"
            ? <Num label="Infra por m² vendido" sufixo="R$/m²" value={form.custoInfraM2Lote} onChange={set("custoInfraM2Lote")} />
            : <ValorSistema label="Infra por m² vendido" valor={`${fontes.infraM2Usado.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} R$/m²`} sub={fontes.infra.disponivel ? fontes.infraOrigem : fontes.infra.motivo ?? undefined} />}
          {cfg.custoInfraFonte === "sistema" && fontes.infra.disponivel && fontes.infra.custoM2Construcao == null && (
            <div className="col-span-full text-[11px] text-gray-600 border border-gray-100 bg-gray-50 p-2">
              <p><b>CUSTO/M² REAL (P/ VIABILIDADE)</b> do Orçamento Parametrizado, separado por grupo (sem duplicar):</p>
              <p>Infraestrutura: {formatCurrency(fontes.infra.infraestruturaTotal)} · Obras residenciais: {formatCurrency(fontes.infra.obrasResidenciaisTotal)}</p>
              <p className="text-gray-600">{fontes.infra.linhas.map((l) => `${l.descricao} (${l.grupo === "obra_residencial" ? "obra residencial" : "infra"}): ${formatCurrency(l.total)}`).join(" · ")}</p>
              <p className="text-gray-600">Valor manual preservado para retorno: {form.custoInfraM2Lote.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} R$/m² (no modo manual, as obras residenciais estão dentro desse valor).</p>
            </div>
          )}
          <Num label="Projetos e licenças" sufixo="R$" value={form.projetosLicencas} onChange={set("projetosLicencas")} step={1000} />
          <FonteSelect label="Marketing — fonte" valor={cfg.marketingFonte} onChange={setFonte("marketingFonte")} />
          {cfg.marketingFonte === "manual"
            ? <Num label="Marketing" sufixo="R$" value={form.marketing} onChange={set("marketing")} step={1000} />
            : <ValorSistema label="Marketing" valor={formatCurrency(fontes.marketingUsado)} sub={`${fontes.marketing.itens.length} item(ns) elegível(is); manual preservado: ${formatCurrency(form.marketing)}`} />}
          {cfg.marketingFonte === "sistema" && (fontes.marketing.itens.length > 0 || fontes.marketing.desconsiderados.length > 0) && (
            <div className="col-span-full text-[11px] text-gray-600 border border-gray-100 bg-gray-50 p-2">
              {fontes.marketing.itens.map((i) => <p key={`${i.origem}-${i.nome}`}>{i.nome} — {i.origem} ({i.categoria}, {i.status}): {formatCurrency(i.valor)}</p>)}
              {fontes.marketing.desconsiderados.map((d) => <p key={`x-${d.nome}-${d.motivo}`} className="text-gray-600">Fora: {d.nome} — {d.motivo}</p>)}
            </div>
          )}
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
                <p className="text-xs text-gray-600 mt-1.5">
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
        <Kpi label="TIR" valor={r.tirAnual != null ? `${(r.tirAnual * 100).toFixed(2)}% a.a.` : "Não se aplica"} sub={r.tirMotivo ?? undefined} />
        <Kpi label="ROI" valor={fmtPct(r.roi, 1)} negativo={r.roi < 0} sub="lucro ÷ custo total do projeto" />
        <Kpi label="Margem líquida" valor={fmtPct(r.margemLiquida, 1)} negativo={r.margemLiquida < 0} sub="lucro ÷ VGV" />
        <Kpi label="Payback" valor={r.paybackStatus === "sem_exposicao" ? "Sem exposição" : r.paybackMes != null ? `mês ${r.paybackMes}` : "Não recupera"} sub={r.paybackStatus === "sem_exposicao" ? "o caixa acumulado nunca fica negativo" : undefined} />
        <Kpi label="Exposição máx." valor={formatCurrency(r.exposicaoMaxima)} sub={r.exposicaoMaxima > 0 ? `pico no mês ${r.mesPico}` : "caixa acumulado sempre ≥ 0"} negativo />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Lucro líquido" valor={formatCurrency(r.lucroLiquido)} negativo={r.lucroLiquido < 0} />
        <Kpi label="Custo total do projeto" valor={formatCurrency(r.custoTotalProjeto)} sub="operacional nominal + terreno + financeiro" />
        <Kpi label="Fluxo do projeto (sem captação)" valor={`VPL ${formatCurrency(r.projeto.vpl)}`} sub={`exposição ${formatCurrency(r.projeto.exposicaoMaxima)} · TIR ${r.projeto.tirAnual != null ? `${(r.projeto.tirAnual * 100).toFixed(1)}% a.a.` : "não se aplica"}`} />
        <Kpi label="Break-even" valor={`${r.breakEven.unidadesNecessarias.toLocaleString("pt-BR")} unidades`} sub={`de ${r.mix.totalUnidades.toLocaleString("pt-BR")} vendáveis`} />
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
          {r.custoObrasResidenciais > 0 && <Linha label="Obras residenciais" valor={formatCurrency(r.custoObrasResidenciais)} sub="Orçamento Parametrizado" />}
          <Linha label="Pré-venda (hoje)" valor={formatCurrency(r.custosPreVenda)} />
          <Linha label="Durante vendas (com receita)" valor={formatCurrency(r.custosDuranteVenda)} />
          <Linha label="Operacionais (hoje)" valor={formatCurrency(r.custoTotal)} />
          <Linha label="Operacionais nominais (c/ INCC)" valor={formatCurrency(r.custoTotalNominal)} />
          <Linha label="Aquisição do terreno" valor={formatCurrency(r.custoTerreno)} />
          <Linha label="Custo financeiro da captação" valor={formatCurrency(r.custoFinanceiroCaptacao)} sub="remuneração dos investidores (o principal não é custo)" />
          <Linha label="Custo total do projeto" valor={formatCurrency(r.custoTotalProjeto)} forte />
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Receitas, terreno e proprietário</p>
          <Linha label="Total recebido das vendas" valor={formatCurrency(r.recebiveis.total)} />
          <Linha label={`Incorporador (${((1 - viab.premissas.permutaPctVgv) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% dos recebimentos)`} valor={formatCurrency(r.recebiveis.voce)} forte />
          <Linha label={`Participação do terreneiro — permuta financeira (${(viab.premissas.permutaPctVgv * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`} valor={formatCurrency(r.recebiveis.terreneiro)} />
          <Linha label="Aquisição do terreno (custo do projeto, não é participação)" valor={formatCurrency(r.custoTerreno)} />
          <Linha label={`Permuta física — ${r.permutaFisica.unidades} unidade(s) ao proprietário`} valor={formatCurrency(r.permutaFisica.vgvEquivalente)} sub="VGV que não é vendido (unidades construídas e entregues)" />

        </div>
      </div>

      {/* ── Fluxo de caixa acumulado ── */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Fluxo de caixa acumulado — incorporador, com captação ({CENARIO_META.find((c) => c.id === cenarioAtivo)?.label})
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
        <p className="text-[10px] text-gray-600 mt-2">
          Valores calculados por fórmulas determinísticas (VPL a {form.taxaDescontoAnual}% a.a., parcelas indexadas, inadimplência, correção INCC da obra, terreno, permuta e captação considerados). Convenção: M0 = data-base; M1–M12 = Ano 1. Estudo preliminar — não substitui projeto executivo nem análise contratual.
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
              ["TIR (a.a.)", (x: ResultadoLoteamento) => (x.tirAnual != null ? `${(x.tirAnual * 100).toFixed(2)}%` : "não se aplica"), false],
              ["ROI", (x: ResultadoLoteamento) => fmtPct(x.roi), false],
              ["Margem líquida", (x: ResultadoLoteamento) => fmtPct(x.margemLiquida), false],
              ["Payback", (x: ResultadoLoteamento) => textoPayback(x), false],
              ["Exposição máxima", (x: ResultadoLoteamento) => formatCurrency(x.exposicaoMaxima), false],
              ["Custos operacionais nominais", (x: ResultadoLoteamento) => formatCurrency(x.custoTotalNominal), false],
              ["Terreno", (x: ResultadoLoteamento) => formatCurrency(x.custoTerreno), false],
              ["Custo financeiro (captação)", (x: ResultadoLoteamento) => formatCurrency(x.custoFinanceiroCaptacao), false],
              ["Custo total do projeto", (x: ResultadoLoteamento) => formatCurrency(x.custoTotalProjeto), false],
              ["Lucro líquido", (x: ResultadoLoteamento) => formatCurrency(x.lucroLiquido), false],
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
          <p className="text-[10px] text-gray-600 mb-3">Cronograma de RECEBIMENTO: caixa que entra pelos vencimentos (entrada, parcelas), dividido entre incorporador e terreneiro (cenário {CENARIO_META.find((c) => c.id === cenarioAtivo)?.label}).</p>
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="bg-[var(--brand-dark)]">
                {["Ano", "Total (bruto)", "Incorporador", "Terreneiro"].map((h) => (
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
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Custos por ano</p>
          <p className="text-[10px] text-gray-600 mb-3">Cronograma de DESEMBOLSO — valores nominais (obra com correção INCC), terreno e remuneração de investidores.</p>
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="bg-[var(--brand-dark)]">
                {["Ano", "Obra e fixos", "Venda", "Terreno", "Financeiro", "Total do ano"].map((h) => (
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
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.terreno)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.financeiro)}</td>
                  <td className="px-3 py-2 font-bold text-red-500">{formatCurrency(a.total)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-3 py-2 font-black text-[var(--brand-dark)]">Total</td>
                <td colSpan={4} />
                <td className="px-3 py-2 font-black text-red-600">{formatCurrency(r.custoTotalProjeto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Vendas e fluxo de caixa por ano ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Vendas por ano</p>
          <p className="text-[10px] text-gray-600 mb-3">Cronograma de COMERCIALIZAÇÃO: contratos assinados (não é caixa).</p>
          <table className="w-full text-xs min-w-[320px]">
            <thead><tr className="bg-[var(--brand-dark)]">{["Ano", "Unidades", "VGV contratado"].map((h) => <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {anosVenda.map((a) => (
                <tr key={a.ano}>
                  <td className="px-3 py-2 text-gray-500 font-medium">Ano {a.ano}</td>
                  <td className="px-3 py-2 font-bold text-[var(--brand-dark)]">{a.unidades.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                  <td className="px-3 py-2 font-bold text-[var(--brand-dark)]">{formatCurrency(a.vgv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fluxo de caixa por ano</p>
          <p className="text-[10px] text-gray-600 mb-3">Projeto = recebimentos − custos (sem captação). Incorporador = projeto + aportes − devolução do principal − remuneração dos investidores.</p>
          <table className="w-full text-xs min-w-[640px]">
            <thead><tr className="bg-[var(--brand-dark)]">{["Ano", "Projeto", "Aportes", "Devolução principal", "Remuneração", "Incorporador", "Acumulado"].map((h) => <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {anosFluxo.map((a) => (
                <tr key={a.ano}>
                  <td className="px-3 py-2 text-gray-500 font-medium">Ano {a.ano}</td>
                  <td className={`px-3 py-2 font-bold ${a.saldoProjeto < 0 ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{formatCurrency(a.saldoProjeto)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.aportes)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.resgatesPrincipal)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(a.remuneracaoInvestidores)}</td>
                  <td className={`px-3 py-2 font-bold ${a.saldo < 0 ? "text-red-500" : "text-green-700"}`}>{formatCurrency(a.saldo)}</td>
                  <td className={`px-3 py-2 font-bold ${a.acumulado < 0 ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{formatCurrency(a.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Demonstrativo auditável (Correção 13) ── */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Composição financeira — demonstrativo auditável</p>
        <p className="text-[10px] text-gray-600 mb-3">Cada rubrica com o módulo de origem, competência e classificação. Movimentações de capital mudam o caixa, mas não o lucro. A soma das rubricas do resultado é o lucro líquido.</p>
        <table className="w-full text-xs min-w-[860px]">
          <thead><tr className="bg-[var(--brand-dark)]">{["Rubrica", "Módulo de origem", "Valor", "Competência", "Classificação", "Modo", "No resultado"].map((h) => <th key={h} className="text-left text-[10px] font-bold text-[var(--brand-yellow)] uppercase tracking-wider px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {composicao.map((l) => (
              <tr key={l.rubrica} title={l.observacao}>
                <td className="px-3 py-2 text-gray-700 font-medium">{l.rubrica}{l.observacao && <span className="block text-[10px] text-gray-600 font-normal">{l.observacao}</span>}</td>
                <td className="px-3 py-2 text-gray-500">{l.moduloOrigem}</td>
                <td className={`px-3 py-2 font-bold whitespace-nowrap ${l.valor < 0 ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{formatCurrency(l.valor)}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.competencia}</td>
                <td className="px-3 py-2 text-gray-500">{l.classificacao}</td>
                <td className="px-3 py-2 text-gray-500">{l.modo}</td>
                <td className="px-3 py-2 text-gray-500">{l.entraNoResultado ? "sim" : "não"}</td>
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="px-3 py-2 font-black text-[var(--brand-dark)]" colSpan={2}>Lucro líquido (soma das rubricas do resultado)</td>
              <td className="px-3 py-2 font-black text-[var(--brand-dark)] whitespace-nowrap">{formatCurrency(composicao.filter((l) => l.entraNoResultado).reduce((s, l) => s + l.valor, 0))}</td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>


    </div>
  );
}

function Kpi({ label, valor, sub, destaque, negativo }: {
  label: string; valor: string; sub?: string; destaque?: boolean; negativo?: boolean;
}) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-400" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${
        destaque ? (negativo ? "text-red-400" : "text-[var(--brand-yellow)]") : negativo ? "text-red-500" : "text-[var(--brand-dark)]"
      }`}>
        {valor}
      </p>
      {sub && <p className={`text-[10px] mt-0.5 ${destaque ? "text-gray-400" : "text-gray-600"}`}>{sub}</p>}
    </div>
  );
}

function FonteSelect({ label, valor, onChange }: { label: string; valor: ModoFonte; onChange: (v: ModoFonte) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select aria-label={label} value={valor} onChange={(e) => onChange(e.target.value as ModoFonte)} className={inputCls}>
        <option value="manual">Valor manual</option>
        <option value="sistema">Valor do sistema</option>
      </select>
    </div>
  );
}

function ValorSistema({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label} <span className="text-gray-500 normal-case font-normal">(sistema)</span></label>
      <div className="w-full border border-blue-200 bg-blue-50 px-2.5 py-2 text-sm text-blue-900 font-bold">{valor}</div>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function Linha({ label, valor, sub, forte }: { label: string; valor: string; sub?: string; forte?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <span className="text-xs text-gray-500">{label}</span>
        {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      </div>
      <span className={`text-xs shrink-0 ${forte ? "font-black text-[var(--brand-dark)]" : "font-bold text-gray-700"}`}>{valor}</span>
    </div>
  );
}
