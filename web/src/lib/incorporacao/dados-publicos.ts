// Paridade Prospecta (13/11): mesma regra de shared/incorporacao/dados-publicos.ts.
// Motor 1 da Inteligência de Mercado (correção 06): dados demográficos e econômicos
// OFICIAIS e GRATUITOS do IBGE — API de Localidades + API de Agregados (SIDRA).
// Não usa IA nem chave paga. Cada indicador é consultado de forma independente:
// a falha de um não derruba os demais, e nada é inventado — indicador indisponível
// aparece como indisponível, com o motivo.
//
// Usa sempre a ÚLTIMA competência publicada (`periodos/-N`), exibindo o período de
// referência devolvido pela fonte (não assume que o dado é do ano corrente). O nome e a
// unidade exibidos são os retornados pelo IBGE; uma palavra-chave esperada confere que a
// variável é a pretendida (se a tabela mudar, o indicador é descartado, não trocado).
//
// ONDE RODA: no NAVEGADOR do usuário (preferencial). O IBGE recusa conexões vindas de
// fora do Brasil (verificado em 08/11/2026: TLS reset a partir de datacenter nos EUA — a
// produção no Vercel roda em iad1/EUA). O navegador, no Brasil, consulta direto e o
// servidor só grava o resultado (`salvarDadosPublicos`). A rota de servidor
// `pesquisarDadosPublicos` continua como reserva.

const BASE = "https://servicodados.ibge.gov.br/api";
const TIMEOUT_MS = 15_000;
const CACHE_MS = 24 * 60 * 60 * 1000;

export type Buscador = (url: string) => Promise<unknown>;

export interface IndicadorPublico {
  chave: string;
  indicador: string;
  valor: number;
  unidade: string;
  municipio: string;
  periodo: string;
  fonte: string;
  url: string;
  consultadoEm: string;
  derivado?: string;
  /** Série histórica (ex.: evolução populacional), do mais antigo ao mais recente. */
  serie?: { periodo: string; valor: number }[];
}

export interface IndicadorIndisponivel { chave: string; indicador: string; motivo: string; url?: string }

export interface ResultadoDadosPublicos {
  municipio: { id: number; nome: string; uf: string } | null;
  indicadores: IndicadorPublico[];
  indisponiveis: IndicadorIndisponivel[];
  consultadoEm: string;
  fonteGeral: string;
}

interface DefIndicador {
  chave: string;
  rotulo: string;
  agregado: number;
  variavel: number;
  periodos: number;
  /** Palavra-chave (sem acento, minúscula) que precisa constar no nome da variável devolvido pelo IBGE. */
  confere: string;
  fonte: string;
}

/** Tabelas SIDRA consultadas. Os IDs são conferidos contra o nome devolvido pela API (campo `confere`). */
export const INDICADORES_IBGE: DefIndicador[] = [
  { chave: "populacao_estimada", rotulo: "População estimada", agregado: 6579, variavel: 9324, periodos: 6, confere: "populacao", fonte: "IBGE — Estimativas da População (SIDRA 6579)" },
  { chave: "populacao_censo", rotulo: "População residente (Censo)", agregado: 4714, variavel: 93, periodos: 1, confere: "populacao", fonte: "IBGE — Censo Demográfico (SIDRA 4714)" },
  { chave: "densidade", rotulo: "Densidade demográfica", agregado: 4714, variavel: 614, periodos: 1, confere: "densidade", fonte: "IBGE — Censo Demográfico (SIDRA 4714)" },
  { chave: "pib", rotulo: "PIB a preços correntes", agregado: 5938, variavel: 37, periodos: 3, confere: "produto interno bruto", fonte: "IBGE — PIB dos Municípios (SIDRA 5938)" },
  { chave: "pessoal_ocupado", rotulo: "Pessoal ocupado total", agregado: 1685, variavel: 707, periodos: 1, confere: "pessoal ocupado", fonte: "IBGE — Cadastro Central de Empresas (SIDRA 1685)" },
  { chave: "salario_medio", rotulo: "Salário médio mensal (salários mínimos)", agregado: 1685, variavel: 1606, periodos: 1, confere: "salario medio", fonte: "IBGE — Cadastro Central de Empresas (SIDRA 1685)" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const cache = new Map<string, { em: number; dado: unknown }>();

/** Buscador padrão: fetch com timeout e cache de 24 h por URL (dados oficiais mudam pouco). */
export const buscadorPadrao: Buscador = async (url) => {
  const c = cache.get(url);
  if (c && Date.now() - c.em < CACHE_MS) return c.dado;
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const dado = await r.json();
  cache.set(url, { em: Date.now(), dado });
  return dado;
};

export async function buscarMunicipioIbge(municipio: string, uf: string, buscar: Buscador = buscadorPadrao) {
  const url = `${BASE}/v1/localidades/estados/${encodeURIComponent(uf.trim().toUpperCase())}/municipios`;
  const lista = (await buscar(url)) as { id: number; nome: string }[];
  if (!Array.isArray(lista)) throw new Error("Resposta inesperada da API de Localidades do IBGE.");
  const alvo = semAcento(municipio);
  const m = lista.find((x) => semAcento(x.nome) === alvo);
  return m ? { id: m.id, nome: m.nome, uf: uf.trim().toUpperCase() } : null;
}

interface RespostaAgregado {
  id: string;
  variavel: string;
  unidade: string;
  resultados: { series: { localidade: { id: string; nome: string }; serie: Record<string, string> }[] }[];
}

function serieValida(serie: Record<string, string>): { periodo: string; valor: number }[] {
  return Object.entries(serie)
    .map(([periodo, v]) => ({ periodo, valor: Number(v) }))
    // "-", "...", "X" (sigilo) etc. NÃO viram número
    .filter((x) => Number.isFinite(x.valor) && /^\d/.test(String(serie[x.periodo]).trim()))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

export async function pesquisarDadosPublicos(
  municipioNome: string, uf: string, buscar: Buscador = buscadorPadrao, agora: () => Date = () => new Date()
): Promise<ResultadoDadosPublicos> {
  const consultadoEm = agora().toISOString();
  const fonteGeral = "IBGE — API de Localidades e API de Agregados (SIDRA), servicodados.ibge.gov.br";
  let municipio: ResultadoDadosPublicos["municipio"];
  try {
    municipio = await buscarMunicipioIbge(municipioNome, uf, buscar);
  } catch (e) {
    return { municipio: null, indicadores: [], consultadoEm, fonteGeral,
      indisponiveis: [{ chave: "municipio", indicador: "Município", motivo: `API de Localidades do IBGE indisponível: ${e instanceof Error ? e.message : String(e)}` }] };
  }
  if (!municipio) {
    return { municipio: null, indicadores: [], consultadoEm, fonteGeral,
      indisponiveis: [{ chave: "municipio", indicador: "Município", motivo: `Município "${municipioNome}/${uf}" não encontrado na lista oficial do IBGE.` }] };
  }
  const mun = municipio;
  const resultados = await Promise.allSettled(INDICADORES_IBGE.map(async (d): Promise<IndicadorPublico> => {
    const url = `${BASE}/v3/agregados/${d.agregado}/periodos/-${d.periodos}/variaveis/${d.variavel}?localidades=N6[${mun.id}]`;
    const resp = (await buscar(url)) as RespostaAgregado[];
    const item = Array.isArray(resp) ? resp[0] : null;
    if (!item) throw new Error("tabela sem resultado para o município");
    if (!semAcento(item.variavel ?? "").includes(d.confere)) {
      throw new Error(`variável devolvida ("${item.variavel}") não corresponde a "${d.rotulo}" — descartada para não exibir dado trocado`);
    }
    const serie = serieValida(item.resultados?.[0]?.series?.[0]?.serie ?? {});
    if (serie.length === 0) throw new Error("sem valor publicado para o município (dado ausente ou sigiloso)");
    const ultimo = serie[serie.length - 1];
    return {
      chave: d.chave, indicador: item.variavel, valor: ultimo.valor, unidade: item.unidade ?? "", municipio: `${mun.nome}/${mun.uf}`,
      periodo: ultimo.periodo, fonte: d.fonte, url, consultadoEm, ...(serie.length > 1 ? { serie } : {}),
    };
  }));
  const indicadores: IndicadorPublico[] = [];
  const indisponiveis: IndicadorIndisponivel[] = [];
  resultados.forEach((r, i) => {
    const d = INDICADORES_IBGE[i];
    if (r.status === "fulfilled") indicadores.push(r.value);
    else indisponiveis.push({ chave: d.chave, indicador: d.rotulo, motivo: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });

  // PIB per capita DERIVADO: só quando há PIB e população estimada do MESMO ano.
  const pib = indicadores.find((x) => x.chave === "pib");
  const pop = indicadores.find((x) => x.chave === "populacao_estimada");
  if (pib && pop) {
    const popMesmoAno = (pop.serie ?? [{ periodo: pop.periodo, valor: pop.valor }]).find((s) => s.periodo === pib.periodo);
    const fator = /mil/i.test(pib.unidade) ? 1000 : 1;
    if (popMesmoAno && popMesmoAno.valor > 0) {
      indicadores.push({
        chave: "pib_per_capita", indicador: "PIB per capita", valor: Math.round(((pib.valor * fator) / popMesmoAno.valor) * 100) / 100,
        unidade: "Reais", municipio: pib.municipio, periodo: pib.periodo, fonte: `${pib.fonte} ÷ ${pop.fonte}`, url: pib.url, consultadoEm,
        derivado: `Calculado: PIB ${pib.periodo} ÷ população estimada ${pib.periodo}.`,
      });
    } else {
      indisponiveis.push({ chave: "pib_per_capita", indicador: "PIB per capita", motivo: `Sem população estimada para ${pib.periodo} (ano do último PIB publicado).` });
    }
  }
  // Crescimento populacional médio anual (derivado da série de estimativas)
  if (pop?.serie && pop.serie.length >= 2) {
    const a = pop.serie[0], b = pop.serie[pop.serie.length - 1];
    const anos = Number(b.periodo) - Number(a.periodo);
    if (anos > 0 && a.valor > 0) {
      indicadores.push({
        chave: "crescimento_populacional", indicador: "Crescimento populacional médio anual", valor: Math.round((Math.pow(b.valor / a.valor, 1 / anos) - 1) * 10000) / 100,
        unidade: "% ao ano", municipio: pop.municipio, periodo: `${a.periodo}–${b.periodo}`, fonte: pop.fonte, url: pop.url, consultadoEm,
        derivado: `Calculado: taxa composta entre as estimativas de ${a.periodo} e ${b.periodo}.`,
      });
    }
  }
  return { municipio, indicadores, indisponiveis, consultadoEm, fonteGeral };
}
