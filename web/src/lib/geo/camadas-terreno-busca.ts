// Busca das camadas do mapa do terreno NO SERVIDOR (pedido do dono de 11/11).
// Gêmeo de Prospecta/server/_core/geo/camadas-terreno-busca.ts — mesma regra.
// Cada camada é independente: tem timeout próprio, tenta o espelho quando existe,
// e devolve "ok" / "vazio" / "indisponivel" (com a fonte) — nunca trava o mapa.
// Resultados bons ficam em cache por terreno/bbox (memória do processo, 12 h).
import type { Feature, FeatureCollection, LineString } from "geojson";
import {
  FOLGA_M, FONTES, IDS_CAMADAS, bboxComFolga, chaveDoTerreno, consultaOverpass, derivarNascentesBho, exigirFeatureCollection,
  gradeAmostragem, normalizarCaptacoes, normalizarCar, normalizarDutosEpe, normalizarDutosIbama, normalizarFerroviasDnit,
  normalizarFerroviasIbama, normalizarMassasAbastecimento, urlIdentifyCar, normalizarGeologia, normalizarLinhasEpe, normalizarLinhasIbama, normalizarMapbiomas, normalizarMassasDagua,
  normalizarOverpass, normalizarRiosDnit, normalizarRodoviasDnit, normalizarSiagas, normalizarTrechosBho, normalizarUcs,
  recortarLinhas, recortarPoligonos, urlConsultaArcgis, urlIdentifyGeologia, urlIdentifyMapbiomas,
  type Contorno, type DadosCamadas, type EstadoCamada, type IdCamada, type PropsLinha, type RespostaCamadasTerreno,
} from "./camadas-terreno";

export type DepsBusca = { fetchImpl: typeof fetch; timeoutMs?: number; agora?: () => Date };

type Tentativa<T> = { fonte: string; executar: (deps: DepsBusca) => Promise<T> };

const TIMEOUT_PADRAO_MS = 12_000;
const TTL_CACHE_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE = 300;
const cache = new Map<string, { expira: number; valor: EstadoCamada<unknown> }>();

export function limparCacheCamadas() { cache.clear(); }

async function obterJson(url: string, deps: DepsBusca, corpo?: string): Promise<unknown> {
  const r = await deps.fetchImpl(url, {
    method: corpo ? "POST" : "GET",
    body: corpo,
    headers: corpo ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } : { Accept: "application/json" },
    signal: AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_PADRAO_MS),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const consultar = (url: string, deps: DepsBusca) => obterJson(url, deps).then(exigirFeatureCollection);

function motivo(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return "não respondeu a tempo";
    return e.message || "falhou";
  }
  return "falhou";
}

/** Tenta as fontes em ordem; a primeira que responde vence (mesmo que vazia). */
async function comEspelhos<T>(tentativas: Tentativa<T>[], vazio: (t: T) => boolean, deps: DepsBusca): Promise<EstadoCamada<T>> {
  const erros: string[] = [];
  const consultadoEm = (deps.agora?.() ?? new Date()).toISOString();
  for (const t of tentativas) {
    try {
      const dados = await t.executar(deps);
      return { estado: vazio(dados) ? "vazio" : "ok", fonte: t.fonte, consultadoEm, dados };
    } catch (e) {
      erros.push(`${t.fonte}: ${motivo(e)}`);
    }
  }
  return { estado: "indisponivel", fonte: tentativas.map(t => t.fonte).join(" · "), consultadoEm, erro: erros.join(" | ") };
}

function tentativasDa(id: IdCamada, contorno: Contorno): { tentativas: Tentativa<unknown>[]; vazio: (d: never) => boolean } {
  switch (id) {
    case "hidrografia": {
      const b = bboxComFolga(contorno, FOLGA_M.hidrografia);
      const massas = async (deps: DepsBusca) => {
        try { return normalizarMassasDagua(await consultar(urlConsultaArcgis(FONTES.massaDagua.url, b, FONTES.massaDagua.campos), deps)); }
        catch { return normalizarMassasDagua(await consultar(urlConsultaArcgis(FONTES.massaDaguaEspelho.url, b, FONTES.massaDaguaEspelho.campos), deps)); }
      };
      return {
        tentativas: [
          { fonte: `${FONTES.bhoTrechos.nome} + ${FONTES.massaDagua.nome}`, executar: async deps => {
            const [trechos, aguas] = await Promise.all([
              consultar(urlConsultaArcgis(FONTES.bhoTrechos.url, b, FONTES.bhoTrechos.campos), deps).then(normalizarTrechosBho),
              massas(deps),
            ]);
            return { rios: recortarLinhas(trechos, b), aguas: recortarPoligonos(aguas, b), nascentes: derivarNascentesBho(trechos, b) };
          } },
          { fonte: `${FONTES.dnitRios.nome} + ${FONTES.massaDaguaEspelho.nome}`, executar: async deps => {
            const [rios, aguas] = await Promise.all([
              consultar(urlConsultaArcgis(FONTES.dnitRios.url, b, FONTES.dnitRios.campos), deps).then(normalizarRiosDnit),
              consultar(urlConsultaArcgis(FONTES.massaDaguaEspelho.url, b, FONTES.massaDaguaEspelho.campos), deps).then(fc => normalizarMassasDagua(fc)),
            ]);
            return { rios: recortarLinhas(rios, b), aguas: recortarPoligonos(aguas, b), nascentes: [] };
          } },
        ],
        vazio: ((d: DadosCamadas["hidrografia"]) => !d.rios.length && !d.aguas.length && !d.nascentes.length) as (d: never) => boolean,
      };
    }
    case "osm": {
      const b = bboxComFolga(contorno, FOLGA_M.osm);
      const q = consultaOverpass(b);
      return {
        tentativas: FONTES.overpass.urls.map(url => ({
          fonte: `${FONTES.overpass.nome} — ${new URL(url).host}`,
          executar: async (deps: DepsBusca) => {
            const d = normalizarOverpass(await obterJson(url, { ...deps, timeoutMs: Math.min(deps.timeoutMs ?? TIMEOUT_PADRAO_MS, 15_000) }, `data=${encodeURIComponent(q)}`));
            return { rios: recortarLinhas(d.rios, b), aguas: recortarPoligonos(d.aguas, b), nascentes: d.nascentes, vias: recortarLinhas(d.vias, b), linhas: recortarLinhas(d.linhas, b) };
          },
        })),
        vazio: ((d: DadosCamadas["osm"]) => !d.rios.length && !d.aguas.length && !d.nascentes.length && !d.vias.length && !d.linhas.length) as (d: never) => boolean,
      };
    }
    case "vegetacao": {
      const { pontos, ladoM } = gradeAmostragem(contorno);
      return {
        tentativas: [{ fonte: FONTES.mapbiomas.nome, executar: async deps => {
          // uma requisição só: o servidor da EPE enfileira pedidos paralelos (testado em 11/11)
          const { url, corpo } = urlIdentifyMapbiomas(pontos, contorno);
          const partes = [normalizarMapbiomas(await obterJson(url, { ...deps, timeoutMs: Math.max(deps.timeoutMs ?? TIMEOUT_PADRAO_MS, 25_000) }, corpo), ladoM)];
          return { celulas: partes.flatMap(p => p.celulas), ladoM, colecao: partes[0]?.colecao ?? "MapBiomas 2023" };
        } }],
        vazio: ((d: DadosCamadas["vegetacao"]) => !d.celulas.length) as (d: never) => boolean,
      };
    }
    case "ucs": {
      const b = bboxComFolga(contorno, FOLGA_M.ucs);
      return {
        tentativas: [
          { fonte: FONTES.ucs.nome, executar: async deps => normalizarUcs(await consultar(urlConsultaArcgis(FONTES.ucs.url, b, FONTES.ucs.campos, { maxAllowableOffset: 0.0002 }), deps), contorno) },
          { fonte: FONTES.ucsEspelho.nome, executar: async deps => {
            const fcs = await Promise.all(FONTES.ucsEspelho.urls.map(u => consultar(urlConsultaArcgis(u, b, FONTES.ucsEspelho.campos, { maxAllowableOffset: 0.0002 }), deps)));
            return normalizarUcs({ type: "FeatureCollection", features: fcs.flatMap(f => f.features) } as FeatureCollection, contorno);
          } },
        ],
        vazio: ((d: DadosCamadas["ucs"]) => !d.ucs.length) as (d: never) => boolean,
      };
    }
    case "transmissao": {
      const b = bboxComFolga(contorno, FOLGA_M.transmissao);
      return {
        tentativas: [
          { fonte: FONTES.ltEpe.nome, executar: async deps => ({ linhas: recortarLinhas(normalizarLinhasEpe(await consultar(urlConsultaArcgis(FONTES.ltEpe.url, b, FONTES.ltEpe.campos), deps)), b) }) },
          { fonte: FONTES.ltIbama.nome, executar: async deps => ({ linhas: recortarLinhas(normalizarLinhasIbama(await consultar(urlConsultaArcgis(FONTES.ltIbama.url, b, FONTES.ltIbama.campos), deps)), b) as Feature<LineString, PropsLinha>[] }) },
        ],
        vazio: ((d: DadosCamadas["transmissao"]) => !d.linhas.length) as (d: never) => boolean,
      };
    }
    case "rodovias": {
      const b = bboxComFolga(contorno, FOLGA_M.rodovias);
      return {
        tentativas: [{ fonte: FONTES.rodoviasDnit.nome, executar: async deps => ({ rodovias: recortarLinhas(normalizarRodoviasDnit(await consultar(urlConsultaArcgis(FONTES.rodoviasDnit.url, b, FONTES.rodoviasDnit.campos), deps)), b) }) }],
        vazio: ((d: DadosCamadas["rodovias"]) => !d.rodovias.length) as (d: never) => boolean,
      };
    }
    case "geologia":
      return {
        tentativas: [{ fonte: FONTES.geologia.nome, executar: async deps => {
          const { url, corpo } = urlIdentifyGeologia(contorno);
          return normalizarGeologia(await obterJson(url, deps, corpo));
        } }],
        vazio: ((d: DadosCamadas["geologia"]) => !d.unidades.length) as (d: never) => boolean,
      };
    case "car":
      return {
        tentativas: [{ fonte: FONTES.car.nome, executar: async deps => {
          const { url, corpo } = urlIdentifyCar(contorno);
          return normalizarCar(await obterJson(url, { ...deps, timeoutMs: Math.max(deps.timeoutMs ?? TIMEOUT_PADRAO_MS, 20_000) }, corpo), contorno);
        } }],
        vazio: ((d: DadosCamadas["car"]) => !d.imoveis.length) as (d: never) => boolean,
      };
    case "mananciais": {
      const b = bboxComFolga(contorno, FOLGA_M.mananciais);
      return {
        tentativas: [{ fonte: FONTES.captacoes.nome, executar: async deps => {
          const [captacoes, massas] = await Promise.all([
            Promise.all(FONTES.captacoes.urls.map(u => consultar(urlConsultaArcgis(u, b, FONTES.captacoes.campos), deps))).then(fcs => normalizarCaptacoes(fcs, contorno)),
            // as massas d'água são complemento: se esse serviço cair, as captações continuam valendo
            consultar(urlConsultaArcgis(FONTES.massasAbastecimento.url, b, FONTES.massasAbastecimento.campos, { maxAllowableOffset: 0.0002 }), deps)
              .then(fc => normalizarMassasAbastecimento(fc, contorno)).catch(() => ({ massas: [], geometrias: [] })),
          ]);
          return { captacoes, ...massas, raioM: FOLGA_M.mananciais };
        } }],
        vazio: ((d: DadosCamadas["mananciais"]) => !d.captacoes.length && !d.massas.length) as (d: never) => boolean,
      };
    }
    case "ferrovias": {
      const b = bboxComFolga(contorno, FOLGA_M.ferrovias);
      return {
        tentativas: [
          { fonte: FONTES.ferroviasDnit.nome, executar: async deps => ({ ferrovias: recortarLinhas(normalizarFerroviasDnit(await consultar(urlConsultaArcgis(FONTES.ferroviasDnit.url, b, FONTES.ferroviasDnit.campos), deps)), b) }) },
          { fonte: FONTES.ferroviasIbama.nome, executar: async deps => ({ ferrovias: recortarLinhas(normalizarFerroviasIbama(await consultar(urlConsultaArcgis(FONTES.ferroviasIbama.url, b, FONTES.ferroviasIbama.campos), deps)), b) }) },
        ],
        vazio: ((d: DadosCamadas["ferrovias"]) => !d.ferrovias.length) as (d: never) => boolean,
      };
    }
    case "dutos": {
      const b = bboxComFolga(contorno, FOLGA_M.dutos);
      return {
        tentativas: [
          { fonte: `${FONTES.dutosEpe.nome} + ${FONTES.dutosIbama.nome}`, executar: async deps => {
            const [epe, ibama] = await Promise.all([
              // o servidor da EPE enfileira pedidos paralelos (~9 s cada, medido em 11/11): prazo maior só aqui
              Promise.all(FONTES.dutosEpe.camadas.map(c => consultar(urlConsultaArcgis(c.url, b, c.campos, { maxAllowableOffset: 0.00002 }), { ...deps, timeoutMs: Math.max(deps.timeoutMs ?? TIMEOUT_PADRAO_MS, 40_000) }).then(fc => normalizarDutosEpe(fc, c.tipo)))).then(l => l.flat()),
              // os dutos licenciados no IBAMA são complemento (oleodutos, minerodutos): falha aqui não derruba a camada
              consultar(urlConsultaArcgis(FONTES.dutosIbama.url, b, FONTES.dutosIbama.campos), deps).then(normalizarDutosIbama).catch(() => []),
            ]);
            return { dutos: recortarLinhas([...epe, ...ibama], b) };
          } },
          { fonte: FONTES.dutosIbama.nome, executar: async deps => ({ dutos: recortarLinhas(normalizarDutosIbama(await consultar(urlConsultaArcgis(FONTES.dutosIbama.url, b, FONTES.dutosIbama.campos), deps)), b) }) },
        ],
        vazio: ((d: DadosCamadas["dutos"]) => !d.dutos.length) as (d: never) => boolean,
      };
    }
    case "furos": {
      const b = bboxComFolga(contorno, FOLGA_M.furos);
      return {
        tentativas: [{ fonte: FONTES.siagas.nome, executar: async deps => normalizarSiagas(await consultar(urlConsultaArcgis(FONTES.siagas.url, b, FONTES.siagas.campos, { resultRecordCount: 500 }), deps), contorno) }],
        vazio: ((d: DadosCamadas["furos"]) => !d.pocos.length) as (d: never) => boolean,
      };
    }
  }
}

/** Valida o contorno recebido do navegador (Feature Polygon/MultiPolygon em WGS84, tamanho razoável). */
export function validarContorno(entrada: unknown): Contorno {
  const f = (typeof entrada === "string" ? JSON.parse(entrada) : entrada) as Contorno;
  const g = f?.type === "Feature" ? f.geometry : (f as unknown as Contorno["geometry"]);
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) throw new Error("Contorno do terreno inválido.");
  const pontos = (g.type === "Polygon" ? g.coordinates.flat() : g.coordinates.flat(2)) as number[][];
  if (pontos.length < 4 || pontos.length > 20_000) throw new Error("Contorno do terreno inválido.");
  if (pontos.some(p => !Array.isArray(p) || !(Math.abs(p[0]) <= 180) || !(Math.abs(p[1]) <= 90))) throw new Error("Coordenadas do terreno inválidas.");
  return { type: "Feature", properties: {}, geometry: g };
}

export function idsValidos(ids: unknown): IdCamada[] {
  if (!Array.isArray(ids) || !ids.length) return [...IDS_CAMADAS];
  return IDS_CAMADAS.filter(id => ids.includes(id));
}

/** Busca as camadas pedidas em paralelo; cada uma com seu estado. */
export async function buscarCamadasTerreno(contorno: Contorno, ids: IdCamada[], deps: DepsBusca, opcoes: { ignorarCache?: boolean } = {}): Promise<RespostaCamadasTerreno> {
  const chave = chaveDoTerreno(contorno);
  const agora = Date.now();
  const pares = await Promise.all(ids.map(async id => {
    const k = `${id}|${chave}`;
    const emCache = cache.get(k);
    if (!opcoes.ignorarCache && emCache && emCache.expira > agora) return [id, emCache.valor] as const;
    const { tentativas, vazio } = tentativasDa(id, contorno);
    const valor = await comEspelhos(tentativas, vazio as (d: unknown) => boolean, deps);
    if (valor.estado !== "indisponivel") {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(k, { expira: agora + TTL_CACHE_MS, valor });
    }
    return [id, valor] as const;
  }));
  return { camadas: Object.fromEntries(pares) as RespostaCamadasTerreno["camadas"], geradoEm: new Date(agora).toISOString() };
}
