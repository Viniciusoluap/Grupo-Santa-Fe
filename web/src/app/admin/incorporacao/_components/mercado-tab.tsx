"use client";
import { useState } from "react";
import { TrendingUp, Sparkles, Loader2, Landmark, ExternalLink, AlertTriangle } from "lucide-react";
import { formatArea, formatCurrency } from "@/lib/utils";
import { aplicarPrecoReferenciaMercado, pesquisarDadosPublicos, pesquisarMercadoImobiliario, salvarDadosPublicos } from "@/lib/actions/mercado-incorporacao";
import { pesquisarDadosPublicos as consultarIbgeNoNavegador } from "@/lib/incorporacao/dados-publicos";
import type { AnaliseAnuncios, TipologiaImovel } from "@/lib/incorporacao/analise-anuncios";
import { exigirResultado } from "@/lib/acao-resultado";
import { PrecificacaoComparaveis } from "./precificacao-comparaveis";
import { PesquisaPrimaria } from "./pesquisa-primaria";
import type { EstudoData } from "./incorporacao-detail";

interface Cidade {
  populacao: number; crescimentoAnualPct: number; pibPerCapita: number;
  principaisAtividades: string[]; rendaMediaMensal: number;
  deficitHabitacional: string; resumo: string;
}
interface Mercado {
  precoM2Lote: number; precoM2Casa: number; precoM2Apartamento: number;
  velocidadeVendas: string;
  demandaPorProduto: { produto: string; demanda: string; publico: string }[];
  concorrentes: { nome: string; produto: string; faixaPreco: string }[];
  comparaveis: { descricao: string; preco: number; area: number; precoPorM2: number }[];
  oportunidades: string; riscos: string;
  fontes?: string[]; confiabilidade?: string;
}

interface IndicadorPublico { chave: string; indicador: string; valor: number; unidade: string; municipio: string; periodo: string; fonte: string; url: string; consultadoEm: string; derivado?: string }
interface DadosPublicos { municipio: { id: number; nome: string; uf: string } | null; indicadores: IndicadorPublico[]; indisponiveis: { chave: string; indicador: string; motivo: string }[]; consultadoEm: string; fonteGeral: string }

function parse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

const fmtNum = (v: number, unidade: string) => {
  const u = unidade.toLowerCase();
  if (/mil reais/.test(u)) return formatCurrency(v * 1000);
  if (u === "reais" || /^r\$/.test(u)) return formatCurrency(v);
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`.trim();
};

export function MercadoTab({ estudo }: { estudo: EstudoData }) {
  // Pesquisa LEGADA (IA única, antes de 08/11): continua exibida, nunca sobrescrita.
  const cidadeSalva = parse<Cidade & { dadosPublicos?: DadosPublicos }>(estudo.pesquisaCidadeJson);
  const mercadoSalvo = parse<Mercado & { analiseAnuncios?: AnaliseAnuncios; precoM2Lote?: number }>(estudo.estudoMercadoJson);
  const cidade: Cidade | null = cidadeSalva && (cidadeSalva.populacao || cidadeSalva.resumo) ? cidadeSalva : null;
  const mercado: Mercado | null = mercadoSalvo && (mercadoSalvo.demandaPorProduto || mercadoSalvo.comparaveis || mercadoSalvo.precoM2Casa) ? mercadoSalvo : null;
  const fontesPersistidas = mercado ? { fontes: mercado.fontes, confiabilidade: mercado.confiabilidade } : null;

  // Motor 1 — dados oficiais (IBGE)
  const [publicos, setPublicos] = useState<DadosPublicos | null>(cidadeSalva?.dadosPublicos ?? null);
  const [busyPub, setBusyPub] = useState(false);
  const [erroPub, setErroPub] = useState<string | null>(null);
  // Motor 2 — anúncios + análise
  const [analise, setAnalise] = useState<AnaliseAnuncios | null>(mercadoSalvo?.analiseAnuncios ?? null);
  const [busyIa, setBusyIa] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [avisoIa, setAvisoIa] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<{ bairro: string; tipologia: TipologiaImovel; areaMin: string; areaMax: string }>({ bairro: "", tipologia: "lote", areaMin: "", areaMax: "" });
  const [precoAplicado, setPrecoAplicado] = useState<number | null>(null);

  async function buscarPublicos() {
    setBusyPub(true); setErroPub(null);
    try {
      // 1º o navegador (no Brasil) consulta o IBGE direto — o IBGE recusa acessos do servidor (EUA).
      const local = await consultarIbgeNoNavegador(estudo.municipio, estudo.estado);
      const falhaRede = !local.municipio && local.indisponiveis.some((i) => i.chave === "municipio" && /indisponível/.test(i.motivo));
      if (!falhaRede) {
        setPublicos(local);
        exigirResultado(await salvarDadosPublicos(estudo.id, local));
        return;
      }
      // reserva: consulta pelo servidor
      setPublicos(exigirResultado(await pesquisarDadosPublicos(estudo.id, estudo.municipio, estudo.estado)));
    }
    catch (e) { setErroPub(e instanceof Error ? e.message : "Falha ao consultar o IBGE."); }
    finally { setBusyPub(false); }
  }

  async function buscarAnuncios() {
    setBusyIa(true); setErroIa(null); setAvisoIa(null);
    const n = (v: string) => { const x = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : undefined; };
    try {
      const r = exigirResultado(await pesquisarMercadoImobiliario(estudo.id, { municipio: estudo.municipio, estado: estudo.estado, bairro: consulta.bairro.trim() || undefined, tipologia: consulta.tipologia, areaMinM2: n(consulta.areaMin), areaMaxM2: n(consulta.areaMax) }));
      if (r.status === "ok") { setAnalise(r.analise); if (r.doCache) setAvisoIa("Resultado do cache (consulta idêntica nas últimas 12 h)."); }
      else setAvisoIa(r.motivo);
    } catch (e) { setErroIa(e instanceof Error ? e.message : "Falha na pesquisa de anúncios."); }
    finally { setBusyIa(false); }
  }

  async function usarMediana() {
    if (!analise?.mediana || !(analise.tipologia === "lote" || analise.tipologia === "terreno")) return;
    const atual = mercadoSalvo?.precoM2Lote;
    if (!window.confirm(`Usar ${formatCurrency(analise.mediana)}/m² (mediana de ${analise.amostrasValidas} anúncios, confiabilidade ${analise.confiabilidade}) como preço de referência do lote?${atual ? ` O valor atual (${formatCurrency(atual)}/m²) será substituído.` : ""} Lembre: é preço ANUNCIADO, não de transação.`)) return;
    try { exigirResultado(await aplicarPrecoReferenciaMercado(estudo.id, analise.mediana)); setPrecoAplicado(analise.mediana); }
    catch (e) { setErroIa(e instanceof Error ? e.message : "Falha ao aplicar o preço."); }
  }

  const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Motor 1 */}
        <section className="bg-white border border-gray-100 p-4 space-y-3" aria-label="Dados demográficos e econômicos">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Landmark size={13} /> Dados demográficos e econômicos</p>
          <p className="text-[11px] text-gray-600">Fontes oficiais e gratuitas (IBGE — Localidades e SIDRA) de {estudo.municipio}/{estudo.estado}. Usa a última competência publicada de cada indicador. Não usa IA.</p>
          <button onClick={() => void buscarPublicos()} disabled={busyPub}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
            {busyPub ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />}
            {busyPub ? "Consultando IBGE…" : publicos ? "Atualizar dados oficiais" : "Pesquisar dados oficiais (IBGE)"}
          </button>
          {erroPub && <p role="alert" className="text-xs text-red-700">{erroPub}</p>}
        </section>
        {/* Motor 2 */}
        <section className="bg-white border border-gray-100 p-4 space-y-3" aria-label="Inteligência artificial de mercado imobiliário">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={13} /> IA de mercado imobiliário</p>
          <p className="text-[11px] text-gray-600">Busca anúncios na web (Tavily, gratuito) e lê preço e área do próprio texto dos portais, sem IA: descarta duplicados, incompletos e ambíguos, marca atípicos e calcula a mediana do R$/m². Nada é inventado.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Bairro/região<input className={inputCls} value={consulta.bairro} maxLength={120} onChange={(e) => setConsulta({ ...consulta, bairro: e.target.value })} placeholder="(todo o município)" /></label>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Tipologia<select className={inputCls} value={consulta.tipologia} onChange={(e) => setConsulta({ ...consulta, tipologia: e.target.value as TipologiaImovel })}><option value="lote">Lote</option><option value="casa">Casa</option><option value="apartamento">Apartamento</option></select></label>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Área mín. (m²)<input className={inputCls} inputMode="decimal" value={consulta.areaMin} onChange={(e) => setConsulta({ ...consulta, areaMin: e.target.value })} /></label>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Área máx. (m²)<input className={inputCls} inputMode="decimal" value={consulta.areaMax} onChange={(e) => setConsulta({ ...consulta, areaMax: e.target.value })} /></label>
          </div>
          <button onClick={() => void buscarAnuncios()} disabled={busyIa}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
            {busyIa ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busyIa ? "Pesquisando anúncios…" : "Pesquisar anúncios"}
          </button>
          {avisoIa && <p className="text-xs text-amber-800 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{avisoIa}</p>}
          {erroIa && <p role="alert" className="text-xs text-red-700">{erroIa}</p>}
        </section>
      </div>

      {publicos && <PainelDadosPublicos d={publicos} />}
      {analise && <PainelAnuncios a={analise} onUsar={() => void usarMediana()} aplicado={precoAplicado} />}

      <PrecificacaoComparaveis estudo={estudo} />

      <PesquisaPrimaria estudo={estudo} />

      {(fontesPersistidas?.confiabilidade || fontesPersistidas?.fontes?.length) && (
        <p className="text-[11px] text-gray-600">Confiabilidade: <b>{fontesPersistidas.confiabilidade || "não informada"}</b>{fontesPersistidas.fontes?.filter(Boolean).length ? ` · Fontes: ${fontesPersistidas.fontes.filter(Boolean).join("; ")}` : ""}</p>
      )}

      {cidade && (
        <div className="bg-white border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={13} /> Pesquisa da cidade (pesquisa anterior por IA — legado)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Dado label="População" valor={cidade.populacao ? cidade.populacao.toLocaleString("pt-BR") : "—"} />
            <Dado label="Crescimento anual" valor={cidade.crescimentoAnualPct ? `${cidade.crescimentoAnualPct}%` : "—"} />
            <Dado label="PIB per capita" valor={cidade.pibPerCapita ? formatCurrency(cidade.pibPerCapita) : "—"} />
            <Dado label="Renda média" valor={cidade.rendaMediaMensal ? formatCurrency(cidade.rendaMediaMensal) : "—"} />
          </div>
          {cidade.principaisAtividades?.length > 0 && (
            <p className="text-xs text-gray-500">Atividades: {cidade.principaisAtividades.join(", ")}</p>
          )}
          {cidade.deficitHabitacional && <p className="text-xs text-gray-500">Déficit habitacional: {cidade.deficitHabitacional}</p>}
          {cidade.resumo && <p className="text-sm text-[var(--brand-dark)] leading-relaxed">{cidade.resumo}</p>}
        </div>
      )}

      {mercado && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="m² Lote" value={mercado.precoM2Lote ? formatCurrency(mercado.precoM2Lote) : "—"} />
            <KPI label="m² Casa" value={mercado.precoM2Casa ? formatCurrency(mercado.precoM2Casa) : "—"} />
            <KPI label="m² Apartamento" value={mercado.precoM2Apartamento ? formatCurrency(mercado.precoM2Apartamento) : "—"} />
          </div>

          {mercado.demandaPorProduto?.length > 0 && (
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Demanda por produto</p>
              <div className="space-y-2">
                {mercado.demandaPorProduto.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${
                      d.demanda === "alta" ? "bg-green-50 text-green-700" :
                      d.demanda === "media" ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-500"
                    }`}>{d.demanda}</span>
                    <span className="font-bold text-[var(--brand-dark)]">{d.produto}</span>
                    <span className="text-gray-600 text-xs">{d.publico}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mercado.concorrentes?.length > 0 && (
              <div className="bg-white border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Concorrentes</p>
                <div className="space-y-2 text-sm">
                  {mercado.concorrentes.map((c, i) => (
                    <div key={i}>
                      <p className="font-bold text-[var(--brand-dark)]">{c.nome}</p>
                      <p className="text-xs text-gray-600">{c.produto} · {c.faixaPreco}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mercado.comparaveis?.length > 0 && (
              <div className="bg-white border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Comparáveis</p>
                <div className="space-y-2 text-sm">
                  {mercado.comparaveis.map((c, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-gray-600 text-xs">{c.descricao}</span>
                      <span className="font-bold text-[var(--brand-dark)] text-xs shrink-0">
                        {formatCurrency(c.preco)} · {formatArea(Number(c.area))} · {formatCurrency(c.precoPorM2)}/m²
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(mercado.oportunidades || mercado.riscos) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mercado.oportunidades && (
                <div className="bg-green-50 border border-green-100 p-4">
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Oportunidades</p>
                  <p className="text-sm text-green-900">{mercado.oportunidades}</p>
                </div>
              )}
              {mercado.riscos && (
                <div className="bg-red-50 border border-red-100 p-4">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Riscos</p>
                  <p className="text-sm text-red-900">{mercado.riscos}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!cidade && !publicos && !analise && !busyPub && !busyIa && (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <TrendingUp size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Pesquisa ainda não realizada</p>
          <p className="text-gray-600 text-sm mt-1">Use os botões acima: dados oficiais do IBGE (gratuito) e/ou anúncios imobiliários com IA — são independentes.</p>
        </div>
      )}
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
      <p className="font-black text-[var(--brand-dark)]">{valor}</p>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
    </div>
  );
}

function PainelDadosPublicos({ d }: { d: DadosPublicos }) {
  return (
    <div className="bg-white border border-gray-100 p-4 space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Indicadores oficiais {d.municipio ? `— ${d.municipio.nome}/${d.municipio.uf} (cód. IBGE ${d.municipio.id})` : ""}</p>
      {d.indicadores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100"><th className="py-1.5 pr-2">Indicador</th><th className="py-1.5 pr-2 text-right">Valor</th><th className="py-1.5 pr-2">Período</th><th className="py-1.5 pr-2">Fonte</th></tr></thead>
            <tbody>
              {d.indicadores.map((i) => (
                <tr key={i.chave} className="border-b border-gray-50 align-top">
                  <td className="py-1.5 pr-2">{i.indicador}{i.derivado && <span className="block text-[10px] text-gray-500">{i.derivado}</span>}</td>
                  <td className="py-1.5 pr-2 text-right font-bold whitespace-nowrap">{fmtNum(i.valor, i.unidade)}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{i.periodo}</td>
                  <td className="py-1.5 pr-2"><a href={i.url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">{i.fonte}<ExternalLink size={10} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.indisponiveis.length > 0 && (
        <ul className="text-[11px] text-gray-600 list-disc pl-4">{d.indisponiveis.map((x) => <li key={x.chave}><strong>{x.indicador}:</strong> indisponível — {x.motivo}</li>)}</ul>
      )}
      <p className="text-[10px] text-gray-500">Consulta em {new Date(d.consultadoEm).toLocaleString("pt-BR")} · {d.fonteGeral}</p>
    </div>
  );
}

function PainelAnuncios({ a, onUsar, aplicado }: { a: AnaliseAnuncios; onUsar: () => void; aplicado: number | null }) {
  const cor = a.confiabilidade === "alta" ? "text-green-700" : a.confiabilidade === "media" ? "text-amber-700" : "text-red-700";
  return (
    <div className="bg-white border border-gray-100 p-4 space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Análise de anúncios — {a.tipologia} · {a.bairro ? `${a.bairro}, ` : ""}{a.municipio}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Amostras válidas" value={String(a.amostrasValidas)} />
        <KPI label="Mediana R$/m²" value={a.mediana ? formatCurrency(a.mediana) : "—"} />
        <KPI label="Faixa (Q1–Q3)" value={a.q1 !== null && a.q3 !== null ? `${formatCurrency(a.q1)} – ${formatCurrency(a.q3)}` : "—"} />
        <KPI label="Confiabilidade" value={a.confiabilidade} />
      </div>
      <p className={`text-xs ${cor}`}>{a.justificativaConfiabilidade}</p>
      <p className="text-[11px] text-amber-800">{a.aviso}</p>
      {a.minimo !== null && <p className="text-[11px] text-gray-600">Mínimo {formatCurrency(a.minimo)}/m² · máximo {formatCurrency(a.maximo!)}/m² · {a.duplicados} duplicado(s) descartado(s) · {a.rejeitados.length} rejeitado(s) por informação insuficiente/incompatível · {a.validos.filter((v) => v.atipico).length} atípico(s) fora da mediana.</p>}
      {a.mediana && a.confiabilidade !== "insuficiente" && (a.tipologia === "lote" || a.tipologia === "terreno") && (
        <button onClick={onUsar} className="text-xs font-bold px-4 py-2 border border-gray-300 hover:border-[var(--brand-yellow)]">
          {aplicado ? `Aplicado: ${formatCurrency(aplicado)}/m² como referência do lote` : "Usar mediana como preço de referência do lote (confirmação)"}
        </button>
      )}
      {a.mediana && a.tipologia !== "lote" && a.tipologia !== "terreno" && (
        <p className="text-[11px] text-gray-600">Mediana de {a.tipologia} é só referência de mercado — não é aplicável como preço do m² de lote.</p>
      )}
      {a.validos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100"><th className="py-1.5 pr-2">Anúncio</th><th className="py-1.5 pr-2">Fonte</th><th className="py-1.5 pr-2 text-right">Área</th><th className="py-1.5 pr-2 text-right">Preço</th><th className="py-1.5 text-right">R$/m²</th></tr></thead>
            <tbody>
              {a.validos.map((v, i) => (
                <tr key={`${v.url}-${i}`} className={`border-b border-gray-50 ${v.atipico ? "text-gray-500" : ""}`}>
                  <td className="py-1.5 pr-2"><a href={v.url} target="_blank" rel="noreferrer" className="underline">{v.titulo}</a>{v.bairro ? ` · ${v.bairro}` : ""}{v.atipico ? " · atípico (fora do cálculo)" : ""}</td>
                  <td className="py-1.5 pr-2">{v.fonte}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">{formatArea(v.areaM2)}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">{formatCurrency(v.preco)}</td>
                  <td className="py-1.5 text-right whitespace-nowrap font-bold">{formatCurrency(v.precoM2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-500">Consulta em {new Date(a.consultadoEm).toLocaleString("pt-BR")} · provedor: {a.provedor}</p>
    </div>
  );
}
