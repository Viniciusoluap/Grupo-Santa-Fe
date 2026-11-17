// Busca das camadas do mapa do terreno NO SERVIDOR (pedido do dono de 11/11).
// Gêmeo de Prospecta/server/_core/geo/camadas-terreno-busca.ts — mesma regra.
// Cada camada é independente: tem timeout próprio, tenta o espelho quando existe,
// e devolve "ok" / "vazio" / "indisponivel" (com a fonte) — nunca trava o mapa.
// Resultados bons ficam em cache por terreno/bbox (memória do processo, 12 h).
// EPIC-023 (S-E, pedido de 15/11): as fontes são de terceiros e caem (EPE 503, IBAMA sem resposta, Overpass
// 406/429), então: (1) toda consulta se identifica (User-Agent/Accept); (2) falha temporária (tempo esgotado,
// 429, 5xx, rede) é repetida com espera crescente + jitter, respeitando o Retry-After e o orçamento total da
// requisição (< 55 s; a função da Vercel tem 60 s); (3) o Overpass tem mais espelhos públicos e uma fila por
// servidor (uma consulta por vez em cada um); (4) o último resultado bom de cada camada por terreno fica salvo
// no banco (ArmazemCamadas) e é devolvido com `desatualizado: true` + `salvoEm` quando a fonte falha.
import type { Feature, FeatureCollection, LineString } from "geojson";
import {
  FOLGA_M, FONTES, IDS_CAMADAS, bboxComFolga, chaveDoTerreno, consultaOverpass, derivarNascentesBho, exigirFeatureCollection,
  gradeAmostragem, normalizarCaptacoes, normalizarCar, normalizarDutosEpe, normalizarDutosIbama, normalizarFerroviasDnit,
  normalizarFerroviasIbama, normalizarMassasAbastecimento, urlIdentifyCar, normalizarGeologia, normalizarLinhasEpe, normalizarLinhasIbama, normalizarMapbiomas, normalizarMassasDagua,
  normalizarOverpass, normalizarRiosDnit, normalizarRodoviasDnit, normalizarSiagas, normalizarTrechosBho, normalizarUcs,
  recortarLinhas, recortarPoligonos, urlConsultaArcgis, urlIdentifyGeologia, urlIdentifyMapbiomas,
  type Contorno, type DadosCamadas, type EstadoCamada, type IdCamada, type PropsLinha, type RespostaCamadasTerreno,
} from "./camadas-terreno";

/** Onde fica o último resultado bom de cada camada por terreno (banco em produção; memória nos testes). */
export type ArmazemCamadas = {
  ler(chave: string, camada: IdCamada): Promise<{ valor: EstadoCamada<unknown>; salvoEm: Date } | null>;
  gravar(chave: string, camada: IdCamada, valor: EstadoCamada<unknown>): Promise<void>;
};

export type DepsBusca = {
  fetchImpl: typeof fetch;
  timeoutMs?: number;
  agora?: () => Date;
  /** Relógio (ms) do orçamento de tempo e das esperas. Padrão: Date.now. */
  relogio?: () => number;
  /** Espera entre tentativas. Padrão: setTimeout. */
  esperar?: (ms: number) => Promise<void>;
  /** Sorteio 0..1 do jitter. Padrão: Math.random. */
  aleatorio?: () => number;
  /** Corta a consulta em andamento (a corrida entre espelhos cancela as perdedoras quando uma responde). */
  cancelar?: AbortSignal;
  /** Orçamento total da requisição em ms. Padrão: 50 s. */
  orcamentoMs?: number;
  /** Repetições extras por consulta em falha temporária. Padrão: 2. */
  repeticoes?: number;
  /** Último resultado bom por terreno/camada. Sem armazém, segue só com o cache em memória. */
  armazem?: ArmazemCamadas;
  /** Interno: instante (no `relogio`) em que a tentativa atual precisa ter terminado. */
  prazo?: number;
};

type Tentativa<T> = { fonte: string; executar: (deps: DepsBusca) => Promise<T> };

/** Identificação genérica do sistema nas fontes públicas (sem dado pessoal). */
export const USER_AGENT = "Prospecta/1.0 (mapa do terreno)";
const ACCEPT_JSON = "application/json, application/geo+json;q=0.9, */*;q=0.1";

const TIMEOUT_PADRAO_MS = 12_000;
/** Overpass: consulta pesada (vias, rios, água e linhas num raio de 600 m); o espelho que responde leva ~20 s. */
const TIMEOUT_OVERPASS_MS = 42_000;
/** Depois de quanto tempo sem resposta sai uma segunda consulta ao mesmo servidor do Overpass. */
const ESPERA_DO_REFORCO_MS = 10_000;
const TTL_CACHE_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE = 300;
/** A função da Vercel tem 60 s; a resposta precisa sair antes disso. */
export const ORCAMENTO_PADRAO_MS = 50_000;
const REPETICOES_PADRAO = 2;
const ESPERA_BASE_MS = 1_000;
const JITTER_MS = 500;
/** Abaixo disto não vale começar uma nova consulta. */
const MIN_TENTATIVA_MS = 2_000;
/** Tempo reservado para cada espelho que ainda vem depois da tentativa atual. */
const RESERVA_ESPELHO_MS = TIMEOUT_PADRAO_MS;

const cache = new Map<string, { expira: number; valor: EstadoCamada<unknown> }>();
/** Servidor que pediu para esperar (Retry-After): não é consultado antes do tempo pedido. */
const bloqueadoAte = new Map<string, number>();
/** Fila por servidor do Overpass: uma consulta por vez em cada instância pública. */
const filas = new Map<string, Promise<void>>();

export function limparCacheCamadas() { cache.clear(); bloqueadoAte.clear(); filas.clear(); }

/** Resposta HTTP de erro (ou erro do serviço com HTTP 200) — guarda o status e a espera pedida. */
class ErroFonte extends Error {
  /** A fonte devolveu a página de "sistema em manutenção": repetir em seguida não adianta. */
  manutencao = false;
  constructor(readonly status: number, readonly esperaMs: number | null, mensagem: string) { super(mensagem); this.name = "ErroFonte"; }
}
/** O orçamento da requisição acabou antes de dar para consultar. */
class SemTempo extends Error {
  constructor(mensagem = "sem tempo para consultar (limite da requisição)") { super(mensagem); this.name = "SemTempo"; }
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Retry-After em segundos ou data HTTP → ms (null se ausente ou ilegível). */
export function esperaPedida(cabecalho: string | null, agoraMs = Date.now()): number | null {
  if (!cabecalho) return null;
  const t = cabecalho.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 1000);
  const d = Date.parse(t);
  return Number.isFinite(d) ? Math.max(0, d - agoraMs) : null;
}

/** Só vale repetir o que é passageiro: tempo esgotado, 408/425/429, 5xx e erro de rede. */
export function falhaTemporaria(e: unknown): boolean {
  if (e instanceof ErroFonte) return !e.manutencao && (e.status === 408 || e.status === 425 || e.status === 429 || e.status >= 500);
  if (e instanceof SemTempo) return false;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return true;
  return e instanceof TypeError; // "fetch failed": DNS, conexão recusada/derrubada
}

async function umaConsulta(url: string, deps: DepsBusca, corpo: string | undefined, timeoutMs: number): Promise<unknown> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: ACCEPT_JSON };
  // Overpass e ArcGIS (identify por POST) esperam formulário: data=<consulta codificada> / campo=valor&...
  if (corpo) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const r = await deps.fetchImpl(url, { method: corpo ? "POST" : "GET", body: corpo, headers, signal: deps.cancelar ? AbortSignal.any([AbortSignal.timeout(timeoutMs), deps.cancelar]) : AbortSignal.timeout(timeoutMs) });
  if (!r.ok) {
    const espera = esperaPedida(r.headers?.get?.("retry-after") ?? null, (deps.agora?.() ?? new Date()).getTime());
    // 503 com página de manutenção (a EPE responde assim pelo firewall): não é falha passageira.
    let pagina = "";
    if (r.status === 503) { try { pagina = (await r.text()).slice(0, 4000); } catch { /* sem corpo */ } }
    else { try { await r.body?.cancel(); } catch { /* corpo já consumido ou indisponível */ } }
    const erro = new ErroFonte(r.status, espera, `HTTP ${r.status}`);
    erro.manutencao = /manuten[cç][aã]o|maintenance/i.test(pagina);
    throw erro;
  }
  const json: unknown = await r.json();
  // ArcGIS devolve falha do servidor com HTTP 200 e { error: { code } }: 429/5xx também são temporárias.
  if (ehObjeto(json) && ehObjeto(json.error)) {
    const codigo = Number(json.error.code);
    if (codigo === 429 || codigo >= 500) throw new ErroFonte(codigo, null, `serviço respondeu erro ${codigo}${json.error.message ? ` (${String(json.error.message)})` : ""}`);
  }
  // Overpass interrompido (tempo/memória) responde 200 com a lista vazia + "remark": não é "nada no entorno".
  if (ehObjeto(json) && typeof json.remark === "string" && /runtime error|timed out|out of memory/i.test(json.remark)) {
    throw new ErroFonte(504, null, `consulta interrompida pela fonte (${json.remark.slice(0, 120)})`);
  }
  return json;
}

/** Uma consulta por vez no mesmo servidor; quem espera na fila não passa do prazo. */
async function naFila<T>(host: string, prazo: number, relogio: () => number, executar: () => Promise<T>): Promise<T> {
  const anterior = filas.get(host) ?? Promise.resolve();
  let liberar!: () => void;
  const minha = new Promise<void>(r => { liberar = r; });
  const fim = anterior.then(() => minha);
  filas.set(host, fim);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const venceu = await Promise.race([
      anterior.then(() => false),
      new Promise<boolean>(r => { timer = setTimeout(() => r(true), Math.max(0, prazo - relogio() - MIN_TENTATIVA_MS)); }),
    ]);
    if (venceu) throw new SemTempo("servidor ocupado com outra consulta deste sistema");
    return await executar();
  } finally {
    clearTimeout(timer);
    liberar();
    if (filas.get(host) === fim) filas.delete(host);
  }
}

type OpcoesConsulta = { repeticoes?: number; fila?: boolean };

/** GET/POST JSON com identificação, repetição em falha temporária (espera crescente + jitter) e orçamento. */
async function obterJson(url: string, deps: DepsBusca, corpo?: string, opcoes: OpcoesConsulta = {}): Promise<unknown> {
  const relogio = deps.relogio ?? Date.now;
  const prazo = deps.prazo ?? relogio() + (deps.orcamentoMs ?? ORCAMENTO_PADRAO_MS);
  const esperar = deps.esperar ?? dormir;
  const host = new URL(url).host;
  const repeticoes = opcoes.repeticoes ?? deps.repeticoes ?? REPETICOES_PADRAO;
  let ultimo: unknown = null;
  for (let n = 0; ; n++) {
    if (deps.cancelar?.aborted) throw ultimo ?? new SemTempo("consulta cancelada (outro servidor já respondeu)");
    const bloqueio = bloqueadoAte.get(host);
    if (bloqueio && bloqueio > relogio()) {
      const falta = bloqueio - relogio();
      // a fonte pediu para esperar: só volta depois do tempo pedido — e só se ainda couber no prazo
      if (relogio() + falta + MIN_TENTATIVA_MS > prazo) {
        throw ultimo ?? new ErroFonte(429, falta, `HTTP 429 (a fonte pediu para esperar ${Math.ceil(falta / 1000)} s)`);
      }
      await esperar(falta);
    }
    const restante = prazo - relogio();
    if (restante < MIN_TENTATIVA_MS) throw ultimo ?? new SemTempo();
    try {
      const executar = () => umaConsulta(url, deps, corpo, Math.min(deps.timeoutMs ?? TIMEOUT_PADRAO_MS, restante));
      return await (opcoes.fila ? naFila(host, prazo, relogio, executar) : executar());
    } catch (e) {
      ultimo = e;
      const pedida = e instanceof ErroFonte ? e.esperaMs : null;
      if (pedida != null) bloqueadoAte.set(host, relogio() + pedida);
      if (n >= repeticoes || deps.cancelar?.aborted || !falhaTemporaria(e)) throw e;
      const espera = Math.max(pedida ?? 0, ESPERA_BASE_MS * 2 ** n + Math.floor((deps.aleatorio ?? Math.random)() * JITTER_MS));
      if (relogio() + espera + MIN_TENTATIVA_MS > prazo) throw e;
      await esperar(espera);
      if (pedida != null) bloqueadoAte.delete(host); // o tempo pedido já foi cumprido nesta espera
    }
  }
}

const consultar = (url: string, deps: DepsBusca) => obterJson(url, deps).then(exigirFeatureCollection);

function motivo(e: unknown): string {
  // Consulta com reforço: vale o motivo da primeira tentativa.
  if (e instanceof AggregateError && e.errors.length) return motivo(e.errors[0]);
  if (e instanceof ErroFonte && e.manutencao) return "fonte em manutenção (página de aviso do próprio órgão; pode também recusar acesso de fora do Brasil)";
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return "não respondeu a tempo";
    if (e instanceof TypeError) return `sem resposta (${e.message || "falha de conexão"})`;
    return e.message || "falhou";
  }
  return "falhou";
}

/**
 * Tenta as fontes em ordem; a primeira que responde vence (mesmo que vazia). Cada tentativa tem o seu prazo:
 * o que sobra do orçamento menos uma reserva para os espelhos seguintes — a principal pode repetir sem
 * deixar o espelho sem tempo.
 */
async function comEspelhos<T>(tentativas: Tentativa<T>[], vazio: (t: T) => boolean, deps: DepsBusca): Promise<EstadoCamada<T>> {
  const relogio = deps.relogio ?? Date.now;
  const prazoFinal = deps.prazo ?? relogio() + (deps.orcamentoMs ?? ORCAMENTO_PADRAO_MS);
  const erros: string[] = [];
  const consultadoEm = (deps.agora?.() ?? new Date()).toISOString();
  for (let i = 0; i < tentativas.length; i++) {
    const t = tentativas[i];
    const depois = tentativas.length - 1 - i;
    const prazo = Math.min(prazoFinal, Math.max(relogio() + MIN_TENTATIVA_MS, prazoFinal - depois * RESERVA_ESPELHO_MS));
    try {
      const dados = await t.executar({ ...deps, prazo });
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
      // Os espelhos do Overpass são consultados AO MESMO TEMPO e fica o primeiro que responder (teste real de
      // 16/11/2026: um espelho recusa a conexão, dois não respondem e o que funciona leva ~20 s; em fila, um de
      // cada vez com 12 s para cada, a camada inteira ficava "indisponível"). Quando um responde, as consultas
      // dos outros são CANCELADAS na hora (nada fica aberto depois da resposta). Carga por servidor: no máximo
      // duas consultas ao mesmo tempo (a primeira e um reforço) e uma repetição em falha rápida.
      const corrida: Tentativa<DadosCamadas["osm"]> = {
        fonte: FONTES.overpass.urls.map(url => `${FONTES.overpass.nome} — ${new URL(url).host}`).join(" · "),
        executar: async (deps: DepsBusca) => {
          const erros: string[] = [];
          const corte = new AbortController();
          if (deps.cancelar) { if (deps.cancelar.aborted) corte.abort(); else deps.cancelar.addEventListener("abort", () => corte.abort(), { once: true }); }
          const consultas = FONTES.overpass.urls.map(async url => {
            const host = new URL(url).host;
            try {
              const corpo = `data=${encodeURIComponent(q)}`, d2: DepsBusca = { ...deps, timeoutMs: TIMEOUT_OVERPASS_MS, cancelar: corte.signal };
              // Falha rápida (504 do balanceador, conexão derrubada) é repetida na hora; e, se o servidor ainda não
              // respondeu depois de 10 s, sai um reforço: no teste real, a mesma consulta ora voltou em ~20 s, ora
              // ficou sem resposta. No máximo duas consultas em andamento por servidor.
              const bruto = await new Promise<unknown>((ok, falha) => {
                let reforcoEmCurso = false, primeiraFalhou: unknown = null, terminou = false;
                const relogioDoReforco = setTimeout(() => {
                  if (terminou || corte.signal.aborted) return;
                  reforcoEmCurso = true;
                  obterJson(url, d2, corpo, { repeticoes: 0 }).then(
                    v => { terminou = true; ok(v); },
                    e => { reforcoEmCurso = false; if (primeiraFalhou) falha(primeiraFalhou); else void e; },
                  );
                }, ESPERA_DO_REFORCO_MS);
                corte.signal.addEventListener("abort", () => clearTimeout(relogioDoReforco), { once: true });
                obterJson(url, d2, corpo, { repeticoes: 1, fila: true }).then(
                  v => { terminou = true; clearTimeout(relogioDoReforco); ok(v); },
                  // Falhou antes do reforço sair: acabou. Com o reforço em curso, espera o resultado dele.
                  e => { primeiraFalhou = e; if (!reforcoEmCurso) { terminou = true; clearTimeout(relogioDoReforco); falha(e); } },
                );
              });
              const d = normalizarOverpass(bruto);
              return { host, dados: { rios: recortarLinhas(d.rios, b), aguas: recortarPoligonos(d.aguas, b), nascentes: d.nascentes, vias: recortarLinhas(d.vias, b), linhas: recortarLinhas(d.linhas, b) } };
            } catch (e) {
              erros.push(`${host}: ${motivo(e)}`);
              throw e;
            }
          });
          try {
            const vencedor = await Promise.any(consultas);
            corrida.fonte = `${FONTES.overpass.nome} — ${vencedor.host}`;
            return vencedor.dados;
          } catch {
            throw new Error(`nenhum servidor respondeu (${erros.join("; ")})`);
          } finally {
            // Com vencedor ou sem: corta o que ainda estiver aberto e desarma os reforços pendentes.
            corte.abort();
            for (const c of consultas) c.catch(() => undefined);
          }
        },
      };
      return {
        tentativas: [corrida],
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

/** O banco lento não pode empurrar a resposta para além dos 60 s da função. */
const LIMITE_ARMAZEM_MS = 3_000;
function comLimite<T>(p: Promise<T>, ms = LIMITE_ARMAZEM_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("armazenamento lento")), ms); })])
    .finally(() => clearTimeout(timer));
}

/** Lê o último resultado bom sem deixar uma falha do armazenamento derrubar a camada. */
async function lerSalvo(deps: DepsBusca, chave: string, id: IdCamada) {
  if (!deps.armazem) return null;
  try {
    const s = await comLimite(deps.armazem.ler(chave, id));
    return s && (s.valor?.estado === "ok" || s.valor?.estado === "vazio") ? s : null;
  } catch { return null; }
}

function guardarNoCache(k: string, valor: EstadoCamada<unknown>, agora: number) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(k, { expira: agora + TTL_CACHE_MS, valor });
}

/**
 * Busca as camadas pedidas em paralelo; cada uma com seu estado. Ordem: cache em memória → salvo recente
 * (< 12 h, cobre o reinício do processo) → fonte ao vivo → se a fonte falhar, o último resultado bom salvo
 * com `desatualizado: true`, `salvoEm` e o erro de agora. "Tentar de novo" (`ignorarCache`) pula os dois caches.
 */
export async function buscarCamadasTerreno(contorno: Contorno, ids: IdCamada[], deps: DepsBusca, opcoes: { ignorarCache?: boolean } = {}): Promise<RespostaCamadasTerreno> {
  const chave = chaveDoTerreno(contorno);
  const agora = Date.now();
  const relogio = deps.relogio ?? Date.now;
  const depsReq: DepsBusca = { ...deps, prazo: deps.prazo ?? relogio() + (deps.orcamentoMs ?? ORCAMENTO_PADRAO_MS) };
  const pares = await Promise.all(ids.map(async id => {
    const k = `${id}|${chave}`;
    const emCache = cache.get(k);
    if (!opcoes.ignorarCache && emCache && emCache.expira > agora) return [id, emCache.valor] as const;
    let salvo = opcoes.ignorarCache ? null : await lerSalvo(deps, chave, id);
    if (salvo && agora - salvo.salvoEm.getTime() < TTL_CACHE_MS) {
      const recente: EstadoCamada<unknown> = { ...salvo.valor, salvoEm: salvo.salvoEm.toISOString() };
      guardarNoCache(k, recente, agora);
      return [id, recente] as const;
    }
    const { tentativas, vazio } = tentativasDa(id, contorno);
    const valor = await comEspelhos(tentativas, vazio as (d: unknown) => boolean, depsReq);
    if (valor.estado !== "indisponivel") {
      guardarNoCache(k, valor, agora);
      if (deps.armazem) await comLimite(deps.armazem.gravar(chave, id, valor)).catch(() => undefined);
      return [id, valor] as const;
    }
    salvo ??= await lerSalvo(deps, chave, id);
    if (salvo) {
      const { desatualizado: _d, salvoEm: _s, ...anterior } = salvo.valor;
      const desatualizado: EstadoCamada<unknown> = { ...anterior, desatualizado: true, salvoEm: salvo.salvoEm.toISOString(), erro: valor.erro };
      return [id, desatualizado] as const;
    }
    return [id, valor] as const;
  }));
  return { camadas: Object.fromEntries(pares) as RespostaCamadasTerreno["camadas"], geradoEm: new Date(agora).toISOString() };
}
