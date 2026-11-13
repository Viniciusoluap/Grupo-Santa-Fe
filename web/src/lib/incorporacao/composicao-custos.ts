// Composição financeira integrada da Viabilidade (Correções 09, 10 e 13).
//
// Cada custo/fluxo da Viabilidade tem DUAS origens possíveis:
//   • "manual"  — o valor digitado na própria Viabilidade (sempre preservado);
//   • "sistema" — o valor vindo do módulo de origem do MESMO estudo:
//       Orçamento Parametrizado → infraestrutura e obras residenciais (grupos separados);
//       Fornecedores do Lançamento + Material Publicitário → marketing (sem duplicar);
//       Negociação do Terreno → aquisição (à vista/parcelada), permuta financeira e física;
//       Business Plan / Investidores → aporte, resgate do principal e remuneração.
// Nada é inventado: quando a origem não tem dado, o módulo diz que está indisponível.
// Funções puras, sem I/O — testáveis isoladamente.

import type { EstudoData } from "@/app/admin/incorporacao/_components/incorporacao-detail";
import { calcularOrcamentoParametrizado, type LinhaOrcamentoExcel, type PremissasOrcamentoParametrizado } from "@/lib/orcamento/parametrizado";
import type { FornecedorLancamento } from "./fornecedores-lancamento";
import type { PecaPublicitaria } from "./material-publicitario";
import { parseNegociacao, resumoNegociacaoV2, type Proposta } from "./negociacao";
import { calcularFonteCaptacao, type FonteCaptacao } from "@/lib/finance/captacao";
import type { CaptacaoProgramada, DesembolsoProgramado, PremissasLoteamento, ResultadoLoteamento } from "@/lib/finance/loteamento";

export type ModoFonte = "manual" | "sistema";

const r2 = (n: number) => Math.round(n * 100) / 100;
const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function parse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

// ─── Orçamento Parametrizado: infraestrutura × obras residenciais ───────────

export type GrupoOrcamento = "infraestrutura" | "obra_residencial";

/** Grupo da linha: explícito (`grupo`) ou, nos dados antigos, pela descrição. */
export function grupoDaLinha(l: LinhaOrcamentoExcel & { grupo?: GrupoOrcamento }): GrupoOrcamento {
  if (l.grupo === "infraestrutura" || l.grupo === "obra_residencial") return l.grupo;
  const d = semAcento(l.descricao ?? "");
  return /residenc|\bcasas?\b|edifica|sobrado|habitac|\bapartament|\bunidades? (habitac|residenc)|constru[cç][aã]o (das|de) (casas|unidades)/.test(d)
    ? "obra_residencial" : "infraestrutura";
}

export interface InfraDoSistema {
  disponivel: boolean;
  motivo: string | null;
  metodo: string | null;
  infraestruturaTotal: number;
  obrasResidenciaisTotal: number;
  linhas: { descricao: string; total: number; grupo: GrupoOrcamento }[];
  areaReferenciaM2: number | null;
  /** Método "construção": o orçamento traz só um custo/m² (aplicado sobre a área vendida). */
  custoM2Construcao: number | null;
}

export function infraDoOrcamento(estudo: EstudoData): InfraDoSistema {
  const vazio = (motivo: string): InfraDoSistema => ({ disponivel: false, motivo, metodo: null, infraestruturaTotal: 0, obrasResidenciaisTotal: 0, linhas: [], areaReferenciaM2: null, custoM2Construcao: null });
  const salvo = parse<PremissasOrcamentoParametrizado>(estudo.orcamentoParametrizadoJson);
  if (!salvo) return vazio("Orçamento Parametrizado ainda não preenchido neste estudo.");
  if (salvo.metodo === "infraestrutura" || salvo.metodo === "excel") {
    const brutas = (salvo.metodo === "excel" ? salvo.importacaoExcel?.itens : salvo.infraestrutura) ?? [];
    const linhas = brutas.filter((l) => ok(l.total)).map((l) => ({ descricao: l.descricao || "Item", total: r2(l.total), grupo: grupoDaLinha(l) }));
    if (linhas.length === 0) return vazio("O Orçamento Parametrizado não tem linhas com valor.");
    const soma = (g: GrupoOrcamento) => r2(linhas.filter((l) => l.grupo === g).reduce((s, l) => s + l.total, 0));
    return { disponivel: true, motivo: null, metodo: salvo.metodo, infraestruturaTotal: soma("infraestrutura"), obrasResidenciaisTotal: soma("obra_residencial"), linhas,
      areaReferenciaM2: ok(salvo.areaReferenciaM2) ? salvo.areaReferenciaM2 : null, custoM2Construcao: null };
  }
  const r = calcularOrcamentoParametrizado(salvo);
  if (!ok(r.custoM2Real)) return vazio("O Orçamento Parametrizado não tem custo/m² calculado.");
  return { disponivel: true, motivo: null, metodo: salvo.metodo ?? "construcao", infraestruturaTotal: 0, obrasResidenciaisTotal: 0, linhas: [],
    areaReferenciaM2: r.areaTotalM2 || null, custoM2Construcao: r.custoM2Real };
}

// ─── Marketing: fornecedores elegíveis + material publicitário ──────────────

/** Categorias de fornecedor que são despesa de marketing/lançamento ("Outro" não entra automaticamente). */
export const CATEGORIAS_MARKETING = ["Agência de Publicidade", "Estande/Decorado", "Fotografia/Vídeo", "Buffet/Eventos", "Brindes", "Mídia/Ads"];

export interface ItemMarketing { origem: "Fornecedores do Lançamento" | "Material Publicitário"; nome: string; categoria: string; status: string; valor: number }
export interface MarketingDoSistema { disponivel: boolean; total: number; itens: ItemMarketing[]; desconsiderados: { nome: string; motivo: string }[] }

export function marketingDoSistema(estudo: EstudoData): MarketingDoSistema {
  const itens: ItemMarketing[] = [];
  const desconsiderados: { nome: string; motivo: string }[] = [];
  const vistos = new Set<string>();
  const chave = (nome: string, valor: number) => `${semAcento(nome).replace(/\s+/g, " ").trim()}|${Math.round(valor * 100)}`;
  const fornecedores = parse<{ fornecedores?: FornecedorLancamento[] }>(estudo.fornecedoresLancamentoJson)?.fornecedores ?? [];
  const idsVistos = new Set<string>();
  for (const f of Array.isArray(fornecedores) ? fornecedores : []) {
    if (f.id && idsVistos.has(f.id)) { desconsiderados.push({ nome: f.nome, motivo: "Fornecedor duplicado (mesmo cadastro)." }); continue; }
    if (f.id) idsVistos.add(f.id);
    if (!CATEGORIAS_MARKETING.includes(f.categoria)) { desconsiderados.push({ nome: f.nome, motivo: `Categoria "${f.categoria}" não é de marketing.` }); continue; }
    if (f.status === "nao_contratado") { desconsiderados.push({ nome: f.nome, motivo: "Status: não contratado." }); continue; }
    const contratado = f.status === "contratado" || f.status === "entregue";
    const valor = contratado ? (ok(f.valorContratado) ? f.valorContratado : f.valorOrcado) : (ok(f.valorOrcado) ? f.valorOrcado : f.valorContratado);
    if (!ok(valor)) { desconsiderados.push({ nome: f.nome, motivo: "Sem valor informado." }); continue; }
    const k = chave(f.nome, valor);
    if (vistos.has(k)) { desconsiderados.push({ nome: f.nome, motivo: "Mesmo item já considerado." }); continue; }
    vistos.add(k);
    itens.push({ origem: "Fornecedores do Lançamento", nome: f.nome, categoria: f.categoria, status: f.status, valor: r2(valor) });
  }
  const pecas = parse<{ pecas?: PecaPublicitaria[] }>(estudo.materialPublicitarioJson)?.pecas ?? [];
  for (const p of Array.isArray(pecas) ? pecas : []) {
    if (p.status === "reprovado") { desconsiderados.push({ nome: p.nome, motivo: "Peça reprovada." }); continue; }
    if (!ok(p.valorOrcado)) { desconsiderados.push({ nome: p.nome, motivo: "Peça sem valor orçado." }); continue; }
    const k = chave(p.nome, p.valorOrcado);
    if (vistos.has(k)) { desconsiderados.push({ nome: p.nome, motivo: "Mesmo item já considerado em Fornecedores." }); continue; }
    vistos.add(k);
    itens.push({ origem: "Material Publicitário", nome: p.nome, categoria: p.tipo, status: p.status, valor: r2(p.valorOrcado) });
  }
  return { disponivel: itens.length > 0, total: r2(itens.reduce((s, i) => s + i.valor, 0)), itens, desconsiderados };
}

// ─── Terreno: Negociação do Terreno ─────────────────────────────────────────

export interface TerrenoDoSistema {
  disponivel: boolean;
  motivo: string | null;
  proposta: Proposta | null;
  modalidade: string | null;
  /** Aquisição em dinheiro (compra à vista/parcelada, ou parte em dinheiro do misto). */
  valorAquisicao: number;
  desembolsos: DesembolsoProgramado[];
  permutaFinanceiraPct: number;
  permutaFisicaUnidades: number;
}

const NOMES_MODALIDADE: Record<string, string> = {
  compra_avista: "Compra à vista", compra_parcelada: "Compra parcelada", permuta_financeira: "Permuta financeira", permuta_fisica: "Permuta física", misto: "Misto",
};

/** Programa os pagamentos: entrada no mês inicial e o saldo em parcelas mensais seguintes. */
export function programarPagamento(valor: number, mesInicio: number, parcelas: number, entradaPct = 0): DesembolsoProgramado[] {
  if (!ok(valor)) return [];
  const m0 = Math.max(0, Math.round(mesInicio));
  const n = Math.max(1, Math.round(parcelas || 1));
  if (n === 1) return [{ mes: m0, valor: r2(valor) }];
  const entrada = r2(valor * Math.min(1, Math.max(0, entradaPct / 100)));
  const out: DesembolsoProgramado[] = [];
  if (entrada > 0) out.push({ mes: m0, valor: entrada });
  const saldo = valor - entrada;
  const primeiro = entrada > 0 ? m0 + 1 : m0;
  // centavos distribuídos sem perder nem criar valor
  const base = Math.floor((saldo / n) * 100) / 100;
  for (let k = 0; k < n; k++) out.push({ mes: primeiro + k, valor: k === n - 1 ? r2(saldo - base * (n - 1)) : base });
  return out;
}

export function terrenoDaNegociacao(estudo: EstudoData, mesInicio: number): TerrenoDoSistema {
  const vazio = (motivo: string, proposta: Proposta | null = null): TerrenoDoSistema => ({ disponivel: false, motivo, proposta, modalidade: proposta ? NOMES_MODALIDADE[proposta.tipo] ?? proposta.tipo : null, valorAquisicao: 0, desembolsos: [], permutaFinanceiraPct: 0, permutaFisicaUnidades: 0 });
  const dados = parseNegociacao(estudo.negociacaoTerrenoJson);
  if (!dados || !dados.propostas?.length) return vazio("Negociação do Terreno sem propostas.");
  const ref = resumoNegociacaoV2(dados, null).referencia;
  if (!ref) return vazio("Negociação do Terreno sem proposta de referência.");
  if (ref.status === "recusada") return vazio("A proposta de referência da Negociação foi recusada.", ref);
  const t = ref.tipo;
  const valorDinheiro = t === "compra_avista" || t === "compra_parcelada" || t === "misto" ? (ok(ref.valorTotal) ? ref.valorTotal : 0) : 0;
  const parcelas = t === "compra_parcelada" || t === "misto" ? Math.max(1, Math.round(ref.prazoParcelamentoMeses ?? 1)) : 1;
  const desembolsos = programarPagamento(valorDinheiro, mesInicio, parcelas, ref.entradaPct ?? 0);
  const permutaFinanceiraPct = t === "permuta_financeira" || t === "misto" ? (ok(ref.permutaPctVgv) ? ref.permutaPctVgv : 0) : 0;
  const permutaFisicaUnidades = t === "permuta_fisica" || t === "misto" ? (ok(ref.unidadesPermuta) ? Math.floor(ref.unidadesPermuta) : 0) : 0;
  if (valorDinheiro <= 0 && permutaFinanceiraPct <= 0 && permutaFisicaUnidades <= 0) return vazio("A proposta de referência não tem valor, percentual nem unidades informados.", ref);
  return { disponivel: true, motivo: null, proposta: ref, modalidade: NOMES_MODALIDADE[t] ?? t, valorAquisicao: r2(valorDinheiro), desembolsos, permutaFinanceiraPct, permutaFisicaUnidades };
}

// ─── Investidores: Business Plan ────────────────────────────────────────────

export interface CaptacaoDoSistema { disponivel: boolean; captacoes: (CaptacaoProgramada & { remuneracao: number })[]; capitalTotal: number; custoTotal: number }

export function captacaoDoBusinessPlan(estudo: EstudoData, mesAporteDefault: number): CaptacaoDoSistema {
  const fontes = parse<{ fontes?: (FonteCaptacao & { mesAporte?: number })[] }>(estudo.businessPlanJson)?.fontes ?? [];
  const captacoes = (Array.isArray(fontes) ? fontes : []).filter((f) => ok(f.capitalAportado)).map((f) => {
    const c = calcularFonteCaptacao(f);
    const mesAporte = Number.isFinite(f.mesAporte) && (f.mesAporte as number) >= 0 ? Math.round(f.mesAporte as number) : mesAporteDefault;
    return { nome: f.nome || "Investidor", capital: r2(f.capitalAportado), mesAporte, mesResgate: mesAporte + Math.max(0, Math.round(f.prazoResgateMeses)), valorResgate: c.valorResgate, remuneracao: c.custoTotal };
  });
  return { disponivel: captacoes.length > 0, captacoes, capitalTotal: r2(captacoes.reduce((s, c) => s + c.capital, 0)), custoTotal: r2(captacoes.reduce((s, c) => s + c.remuneracao, 0)) };
}

// ─── Aplicação das fontes às premissas do motor ─────────────────────────────

export interface ConfigFontes {
  custoInfraFonte: ModoFonte;
  marketingFonte: ModoFonte;
  terrenoFonte: ModoFonte;
  considerarCaptacao: boolean;
  /** Mês do 1º pagamento do terreno (manual e sistema). */
  terrenoMesInicio: number;
  custoTerrenoManual: number;
  terrenoParcelasManual: number;
  permutaFisicaUnidadesManual: number;
  /** Mês do aporte quando a fonte do Business Plan não define. */
  mesAporteCaptacao: number;
}

export interface FontesResolvidas {
  config: ConfigFontes;
  infra: InfraDoSistema;
  marketing: MarketingDoSistema;
  terreno: TerrenoDoSistema;
  captacao: CaptacaoDoSistema;
  /** Valor de infraestrutura por m² vendido (exibição) e de onde veio. */
  infraM2Usado: number;
  infraOrigem: string;
  marketingUsado: number;
  marketingOrigem: string;
  avisos: string[];
}

export function resolverFontes(estudo: EstudoData, cfg: ConfigFontes, manual: { custoInfraM2Lote: number; marketing: number }, areaVendidaM2: number): FontesResolvidas {
  const infra = infraDoOrcamento(estudo);
  const marketing = marketingDoSistema(estudo);
  const terreno = terrenoDaNegociacao(estudo, cfg.terrenoMesInicio);
  const captacao = captacaoDoBusinessPlan(estudo, cfg.mesAporteCaptacao);
  const avisos: string[] = [];

  let infraM2Usado = manual.custoInfraM2Lote;
  let infraOrigem = "Valor manual da Viabilidade";
  if (cfg.custoInfraFonte === "sistema") {
    if (!infra.disponivel) { infraM2Usado = 0; infraOrigem = "Sistema indisponível"; avisos.push(`Infraestrutura (sistema): ${infra.motivo}`); }
    else if (infra.custoM2Construcao != null) { infraM2Usado = infra.custoM2Construcao; infraOrigem = "Orçamento Parametrizado — custo/m² real (método construção)"; }
    else { infraM2Usado = areaVendidaM2 > 0 ? infra.infraestruturaTotal / areaVendidaM2 : 0; infraOrigem = "Orçamento Parametrizado — grupo infraestrutura (total)"; }
    if (infra.disponivel && infra.areaReferenciaM2 && areaVendidaM2 > 0 && Math.abs(infra.areaReferenciaM2 - areaVendidaM2) / areaVendidaM2 > 0.02) {
      avisos.push(`A área de referência do Orçamento (${infra.areaReferenciaM2.toLocaleString("pt-BR")} m²) difere da área vendida do mix (${areaVendidaM2.toLocaleString("pt-BR")} m²): a Viabilidade usa o TOTAL do orçamento (o R$/m² exibido é esse total ÷ área vendida), sem distorcer o custo.`);
    }
  }
  let marketingUsado = manual.marketing;
  let marketingOrigem = "Valor manual da Viabilidade";
  if (cfg.marketingFonte === "sistema") {
    marketingUsado = marketing.total;
    marketingOrigem = marketing.disponivel ? "Fornecedores do Lançamento + Material Publicitário" : "Sistema indisponível";
    if (!marketing.disponivel) avisos.push("Marketing (sistema): nenhum fornecedor de marketing ou peça publicitária com valor elegível.");
  }
  if (cfg.terrenoFonte === "sistema" && !terreno.disponivel) avisos.push(`Terreno (sistema): ${terreno.motivo} O custo do terreno ficou zerado — informe-o na Negociação ou use o valor manual.`);
  return { config: cfg, infra, marketing, terreno, captacao, infraM2Usado, infraOrigem, marketingUsado, marketingOrigem, avisos };
}

/** Aplica as fontes resolvidas às premissas base (que já têm os valores manuais). */
export function aplicarFontes(base: PremissasLoteamento, f: FontesResolvidas): PremissasLoteamento {
  const cfg = f.config;
  const p: PremissasLoteamento = { ...base, custoInfraM2Lote: f.infraM2Usado, marketing: f.marketingUsado };
  // grupo infraestrutura do orçamento entra pelo TOTAL (independe de área do mix — ex.: Casa Pronta sem área do lote)
  if (cfg.custoInfraFonte === "sistema" && f.infra.disponivel && f.infra.custoM2Construcao == null) p.custoInfraBaseTotal = f.infra.infraestruturaTotal;
  // em modo manual, as obras residenciais estão dentro do custo/m² digitado — não somar de novo
  p.custoObrasResidenciais = cfg.custoInfraFonte === "sistema" && f.infra.disponivel ? f.infra.obrasResidenciaisTotal : 0;
  if (cfg.terrenoFonte === "sistema") {
    p.desembolsosTerreno = f.terreno.desembolsos;
    p.permutaPctVgv = f.terreno.permutaFinanceiraPct / 100;
    p.permutaFisicaUnidades = f.terreno.permutaFisicaUnidades;
  } else {
    p.desembolsosTerreno = programarPagamento(cfg.custoTerrenoManual, cfg.terrenoMesInicio, cfg.terrenoParcelasManual);
    p.permutaFisicaUnidades = cfg.permutaFisicaUnidadesManual;
  }
  p.captacoes = cfg.considerarCaptacao ? f.captacao.captacoes.map(({ remuneracao: _r, ...c }) => c) : [];
  return p;
}

// ─── Demonstrativo auditável (Correção 13) ──────────────────────────────────

export type Classificacao =
  | "Receita" | "Custo operacional" | "Despesa comercial" | "Tributos" | "Aquisição de terreno"
  | "Investimento (obra)" | "Despesa financeira" | "Movimentação de capital" | "Participação do terreneiro" | "Informativo";

export interface LinhaComposicao {
  rubrica: string;
  moduloOrigem: string;
  valor: number;
  competencia: string;
  classificacao: Classificacao;
  modo: "manual" | "automático";
  /** Entra no lucro? Movimentação de capital e informativos não entram. */
  entraNoResultado: boolean;
  /** Sinal no caixa do incorporador: +1 entrada, −1 saída, 0 sem efeito. */
  sinal: 1 | -1 | 0;
  observacao?: string;
}

function faixaMeses(meses: number[]): string {
  const ms = meses.filter((m) => Number.isFinite(m));
  if (ms.length === 0) return "—";
  const a = Math.min(...ms), b = Math.max(...ms);
  return a === b ? `M${a}` : `M${a}–M${b}`;
}

export function composicaoFinanceira(p: PremissasLoteamento, r: ResultadoLoteamento, f: FontesResolvidas | null): LinhaComposicao[] {
  const meses = (campo: keyof ResultadoLoteamento["fluxo"][number]) => r.fluxo.filter((m) => Math.abs(Number(m[campo])) > 0.005).map((m) => m.mes);
  const obra = p.duracaoObraMeses > 0 ? `M${p.inicioObraMes}–M${p.inicioObraMes + p.duracaoObraMeses - 1}` : `M${Math.min(p.inicioObraMes, p.inicioVendasMes)}`;
  const recebimentos = faixaMeses(meses("receitaBruta"));
  const modo = (m: ModoFonte | undefined): "manual" | "automático" => (m === "sistema" ? "automático" : "manual");
  const cfg = f?.config;
  const linhas: LinhaComposicao[] = [];
  const add = (l: LinhaComposicao) => { if (Math.abs(l.valor) > 0.005 || l.classificacao === "Aquisição de terreno") linhas.push({ ...l, valor: r2(l.valor) }); };

  add({ rubrica: "Receita de vendas (recebimentos)", moduloOrigem: "Viabilidade — Mix de Produtos", valor: r.recebiveis.total, competencia: recebimentos, classificacao: "Receita", modo: "automático", entraNoResultado: true, sinal: 1,
    observacao: `VGV vendável ${r.vgvGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, corrigido por juros/indexação e líquido de inadimplência.` });
  if (r.recebiveis.terreneiro > 0) add({ rubrica: `Participação do terreneiro (permuta financeira ${(p.permutaPctVgv * 100).toLocaleString("pt-BR")}%)`, moduloOrigem: cfg?.terrenoFonte === "sistema" ? "Negociação do Terreno" : "Viabilidade", valor: -r.recebiveis.terreneiro, competencia: recebimentos, classificacao: "Participação do terreneiro", modo: modo(cfg?.terrenoFonte), entraNoResultado: true, sinal: -1 });
  if (r.permutaFisica.unidades > 0) add({ rubrica: `Permuta física — ${r.permutaFisica.unidades} unidade(s) entregues ao proprietário`, moduloOrigem: cfg?.terrenoFonte === "sistema" ? "Negociação do Terreno" : "Viabilidade", valor: r.permutaFisica.vgvEquivalente, competencia: "Entrega das unidades", classificacao: "Informativo", modo: modo(cfg?.terrenoFonte), entraNoResultado: false, sinal: 0,
    observacao: "VGV equivalente que deixa de ser vendido (as unidades são construídas, mas não entram na receita)." });

  add({ rubrica: "Aquisição do terreno", moduloOrigem: cfg?.terrenoFonte === "sistema" ? `Negociação do Terreno${f?.terreno.modalidade ? ` — ${f.terreno.modalidade}` : ""}` : "Viabilidade (valor manual)", valor: -r.custoTerreno, competencia: faixaMeses(meses("custoTerreno")), classificacao: "Aquisição de terreno", modo: modo(cfg?.terrenoFonte), entraNoResultado: true, sinal: -1,
    observacao: r.custoTerreno > 0 ? undefined : (f && cfg?.terrenoFonte === "sistema" && !f.terreno.disponivel ? f.terreno.motivo ?? undefined : "Sem desembolso em dinheiro pelo terreno.") });

  add({ rubrica: "Infraestrutura (com BDI)", moduloOrigem: f?.infraOrigem ?? "Viabilidade", valor: -r.custoInfra, competencia: obra, classificacao: "Investimento (obra)", modo: modo(cfg?.custoInfraFonte), entraNoResultado: true, sinal: -1,
    observacao: p.custoInfraBaseTotal !== undefined ? `Total do grupo infraestrutura do orçamento × (1 + BDI) — equivale a ${p.custoInfraM2Lote.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} R$/m² vendido.` : `${p.custoInfraM2Lote.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} R$/m² × área dos lotes (inclusive os da permuta física) × (1 + BDI).` });
  add({ rubrica: "Contingência sobre infraestrutura", moduloOrigem: "Viabilidade", valor: -(r.custoInfra / (1 + p.bdiPct)) * p.contingenciaPctInfra, competencia: obra, classificacao: "Investimento (obra)", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Obras residenciais (construção das casas)", moduloOrigem: "Orçamento Parametrizado", valor: -r.custoObrasResidenciais, competencia: obra, classificacao: "Investimento (obra)", modo: "automático", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Correção INCC da obra (valor nominal)", moduloOrigem: "Viabilidade — INCC da obra", valor: -(r.custoObraNominalTotal - (r.custoInfra + r.custoInfra / (1 + p.bdiPct) * p.contingenciaPctInfra + r.custoObrasResidenciais)), competencia: obra, classificacao: "Investimento (obra)", modo: "manual", entraNoResultado: true, sinal: -1,
    observacao: `INCC de ${(p.inccObraMensal * 100).toLocaleString("pt-BR")}% a.m. sobre o custo de obra distribuído no cronograma.` });
  add({ rubrica: "Taxa de administração da obra", moduloOrigem: "Viabilidade", valor: -r.custosDetalhados.taxaAdministracaoObra, competencia: obra, classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Projetos e licenças", moduloOrigem: "Viabilidade", valor: -p.projetosLicencas, competencia: obra, classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Marketing e lançamento", moduloOrigem: f?.marketingOrigem ?? "Viabilidade", valor: -p.marketing, competencia: obra, classificacao: "Despesa comercial", modo: modo(cfg?.marketingFonte), entraNoResultado: true, sinal: -1,
    observacao: cfg?.marketingFonte === "sistema" && f ? f.marketing.itens.map((i) => `${i.nome} (${i.origem}) ${i.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join("; ") || undefined : undefined });
  add({ rubrica: "Registros (por unidade)", moduloOrigem: "Viabilidade", valor: -(p.registroPorUnidade * (r.mix.totalUnidades + r.permutaFisica.unidades)), competencia: obra, classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Manutenção pós-obra", moduloOrigem: "Viabilidade", valor: -r.custosDetalhados.manutencao, competencia: faixaMeses([p.inicioObraMes + p.duracaoObraMeses + 3]), classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Taxa de incorporação", moduloOrigem: "Viabilidade", valor: -r.custosDetalhados.taxaIncorporacao, competencia: "12 meses a partir do início", classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Comissões de venda", moduloOrigem: "Viabilidade", valor: -r.vgvGross * p.comissaoPctVgv, competencia: recebimentos, classificacao: "Despesa comercial", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Despesas gerais", moduloOrigem: "Viabilidade", valor: -r.vgvGross * p.despesasGeraisPctVgv, competencia: recebimentos, classificacao: "Custo operacional", modo: "manual", entraNoResultado: true, sinal: -1 });
  add({ rubrica: "Impostos sobre a receita", moduloOrigem: "Viabilidade", valor: -r.vgvGross * p.impostosPctVgv, competencia: recebimentos, classificacao: "Tributos", modo: "manual", entraNoResultado: true, sinal: -1 });

  for (const c of p.captacoes ?? []) {
    add({ rubrica: `Aporte de capital — ${c.nome}`, moduloOrigem: "Business Plan / Investidores", valor: c.capital, competencia: `M${c.mesAporte}`, classificacao: "Movimentação de capital", modo: "automático", entraNoResultado: false, sinal: 1, observacao: "Entrada de caixa — não é receita." });
    add({ rubrica: `Devolução do principal — ${c.nome}`, moduloOrigem: "Business Plan / Investidores", valor: -c.capital, competencia: `M${c.mesResgate}`, classificacao: "Movimentação de capital", modo: "automático", entraNoResultado: false, sinal: -1, observacao: "Saída de caixa — não é despesa." });
    add({ rubrica: `Remuneração do investidor — ${c.nome}`, moduloOrigem: "Business Plan / Investidores", valor: -(c.valorResgate - c.capital), competencia: `M${c.mesResgate}`, classificacao: "Despesa financeira", modo: "automático", entraNoResultado: true, sinal: -1, observacao: "Custo total da captação." });
  }
  return linhas;
}
