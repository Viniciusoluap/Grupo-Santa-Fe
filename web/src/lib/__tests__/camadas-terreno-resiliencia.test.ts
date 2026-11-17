// EPIC-023 (S-E, pedido do dono de 15/11): camadas do mapa do terreno que não voltam "indisponível" à toa.
// Paridade 17/11 (bloco 2): porte de Prospecta server/geo-camadas-terreno-resiliencia.test.ts (EPIC-023 S-E). Sem rede: fetch simulado.
// Tudo com fetch, relógio, espera e armazenamento injetados — nenhum teste acessa a rede nem o banco.
import { beforeEach, describe, expect, it } from "vitest";
import { FONTES, type Contorno, type EstadoCamada, type IdCamada } from "@/lib/geo/camadas-terreno";
import {
  ORCAMENTO_PADRAO_MS, USER_AGENT, buscarCamadasTerreno, esperaPedida, falhaTemporaria, limparCacheCamadas, type ArmazemCamadas,
} from "@/lib/geo/camadas-terreno-busca";

function quadrado(lat: number, lng: number, meiaLadoM = 300): Contorno {
  const d = meiaLadoM / 110540, e = meiaLadoM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[lng - e, lat - d], [lng + e, lat - d], [lng + e, lat + d], [lng - e, lat + d], [lng - e, lat - d]]] } };
}
const terreno = quadrado(-5.4731, -47.53452);

const FC_VAZIA = JSON.stringify({ type: "FeatureCollection", features: [] });
const json = (corpo: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(corpo, { status, headers: { "Content-Type": "application/json", ...headers } });

/** Relógio falso: a espera só avança o relógio (os testes não dormem). */
function relogioFalso(inicio = 1_000_000) {
  let t = inicio;
  const esperas: number[] = [];
  return {
    relogio: () => t,
    esperar: async (ms: number) => { esperas.push(ms); t += ms; },
    avancar: (ms: number) => { t += ms; },
    decorrido: () => t - inicio,
    esperas,
  };
}

type Chamada = { url: string; init?: RequestInit };
/** fetch roteirizado: cada chamada recebe a próxima resposta da lista (a última se repete). */
function roteiro(respostas: (() => Response | Promise<Response>)[], registro: Chamada[] = []) {
  let i = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    registro.push({ url: String(url), init });
    const r = respostas[Math.min(i++, respostas.length - 1)];
    return r();
  }) as unknown as typeof fetch;
  return { fetchImpl, registro };
}

function armazemMemoria(inicial: Record<string, { valor: EstadoCamada<unknown>; salvoEm: Date }> = {}) {
  const dados = new Map(Object.entries(inicial));
  const gravados: { chave: string; camada: IdCamada; valor: EstadoCamada<unknown> }[] = [];
  const armazem: ArmazemCamadas = {
    async ler(chave, camada) { return dados.get(`${chave}|${camada}`) ?? null; },
    async gravar(chave, camada, valor) { gravados.push({ chave, camada, valor }); dados.set(`${chave}|${camada}`, { valor, salvoEm: new Date() }); },
  };
  return { armazem, dados, gravados };
}

const cabecalho = (init: RequestInit | undefined, nome: string) => new Headers(init?.headers).get(nome);

beforeEach(() => limparCacheCamadas());

describe("identificação nas fontes (Overpass respondia 406)", () => {
  it("toda consulta envia User-Agent genérico do sistema e Accept de JSON", async () => {
    const r = roteiro([() => json(FC_VAZIA)]);
    await buscarCamadasTerreno(terreno, ["rodovias", "ucs"], { ...relogioFalso(), fetchImpl: r.fetchImpl });
    expect(r.registro.length).toBeGreaterThan(0);
    for (const c of r.registro) {
      expect(cabecalho(c.init, "user-agent")).toBe(USER_AGENT);
      expect(cabecalho(c.init, "accept")).toMatch(/application\/json/);
    }
    expect(USER_AGENT).toBe("Prospecta/1.0 (mapa do terreno)");
  });

  it("Overpass: servidor que exige identificação (406 sem User-Agent) responde; POST em formulário data=<consulta>", async () => {
    const registro: Chamada[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      registro.push({ url: String(url), init });
      if (!/^Prospecta\//.test(cabecalho(init, "user-agent") ?? "")) return json("", 406);
      return json(JSON.stringify({ elements: [] }));
    }) as unknown as typeof fetch;
    const { camadas } = await buscarCamadasTerreno(terreno, ["osm"], { ...relogioFalso(), fetchImpl });
    expect(camadas.osm?.estado).toBe("vazio");
    const c = registro[0];
    expect(c.url).toBe(FONTES.overpass.urls[0]);
    expect(c.init?.method).toBe("POST");
    expect(cabecalho(c.init, "content-type")).toBe("application/x-www-form-urlencoded");
    const corpo = String(c.init?.body);
    expect(corpo.startsWith("data=")).toBe(true);
    expect(decodeURIComponent(corpo.slice(5))).toMatch(/^\[out:json\]/);
  });

  it("406 não é repetido no mesmo servidor: passa direto para o próximo espelho", async () => {
    const r = roteiro([() => json("", 406)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["osm"], { ...relogioFalso(), fetchImpl: r.fetchImpl });
    expect(camadas.osm?.estado).toBe("indisponivel");
    expect(r.registro.map(c => c.url)).toEqual([...FONTES.overpass.urls]);
    expect(camadas.osm?.erro).toContain("HTTP 406");
  });

  it("Overpass tem pelo menos 4 instâncias públicas", () => {
    const hosts = FONTES.overpass.urls.map(u => new URL(u).host);
    expect(hosts).toEqual(expect.arrayContaining(["overpass-api.de", "overpass.private.coffee", "maps.mail.ru"]));
  });
});

describe("repetição só em falha temporária", () => {
  it("503 duas vezes e depois responde: a camada sai certa, com espera crescente", async () => {
    const rel = relogioFalso();
    const r = roteiro([() => json("", 503), () => json("", 503), () => json(FC_VAZIA)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...rel, aleatorio: () => 0.5, fetchImpl: r.fetchImpl });
    expect(camadas.rodovias?.estado).toBe("vazio");
    expect(r.registro).toHaveLength(3);
    expect(rel.esperas).toHaveLength(2);
    expect(rel.esperas[1]).toBeGreaterThan(rel.esperas[0]);
    expect(rel.esperas[0]).toBeGreaterThanOrEqual(1000);
  });

  it("429 com Retry-After: não repete antes do tempo pedido", async () => {
    const rel = relogioFalso();
    const r = roteiro([() => json("", 429, { "Retry-After": "7" }), () => json(FC_VAZIA)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...rel, fetchImpl: r.fetchImpl });
    expect(camadas.rodovias?.estado).toBe("vazio");
    expect(r.registro).toHaveLength(2);
    expect(rel.esperas[0]).toBeGreaterThanOrEqual(7000);
  });

  it("Retry-After maior que o orçamento: não espera; Overpass vai para o próximo espelho e não volta ao bloqueado", async () => {
    const rel = relogioFalso();
    const registro: Chamada[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      registro.push({ url: String(url), init });
      return new URL(String(url)).host === "overpass-api.de" ? json("", 429, { "Retry-After": "600" }) : json(JSON.stringify({ elements: [] }));
    }) as unknown as typeof fetch;
    const a = await buscarCamadasTerreno(terreno, ["osm"], { ...rel, fetchImpl });
    expect(a.camadas.osm?.estado).toBe("vazio");
    expect(a.camadas.osm?.fonte).toContain("overpass.private.coffee");
    expect(rel.esperas.some(ms => ms >= 600_000)).toBe(false);
    // outro terreno logo depois: o servidor que pediu 10 min não é consultado de novo
    const antes = registro.length;
    await buscarCamadasTerreno(quadrado(-5.5, -47.5), ["osm"], { ...rel, fetchImpl });
    expect(registro.slice(antes).some(c => c.url.includes("overpass-api.de"))).toBe(false);
  });

  it("400 não é repetido (erro do pedido, não da fonte)", async () => {
    const rel = relogioFalso();
    const r = roteiro([() => json("", 400)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...rel, fetchImpl: r.fetchImpl });
    expect(camadas.rodovias?.estado).toBe("indisponivel");
    expect(camadas.rodovias?.erro).toContain("HTTP 400");
    expect(r.registro).toHaveLength(1);
    expect(rel.esperas).toHaveLength(0);
  });

  it("erro de rede e tempo esgotado são temporários; 4xx (fora 408/425/429) não", () => {
    expect(falhaTemporaria(new TypeError("fetch failed"))).toBe(true);
    expect(falhaTemporaria(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(true);
    expect(falhaTemporaria(new SyntaxError("JSON"))).toBe(false);
  });

  it("Retry-After em segundos ou data HTTP", () => {
    expect(esperaPedida("5")).toBe(5000);
    expect(esperaPedida("Sun, 15 Nov 2026 12:00:30 GMT", Date.parse("Sun, 15 Nov 2026 12:00:00 GMT"))).toBe(30_000);
    expect(esperaPedida(null)).toBeNull();
    expect(esperaPedida("depois")).toBeNull();
  });

  it("erro do ArcGIS com HTTP 200 e código 503 também é repetido", async () => {
    const rel = relogioFalso();
    const r = roteiro([() => json(JSON.stringify({ error: { code: 503, message: "Service unavailable" } })), () => json(FC_VAZIA)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...rel, fetchImpl: r.fetchImpl });
    expect(camadas.rodovias?.estado).toBe("vazio");
    expect(r.registro).toHaveLength(2);
  });
});

describe("orçamento de tempo (função da Vercel: 60 s)", () => {
  it("fonte sempre 503 e lenta: desiste antes de 55 s, mesmo com espelho", async () => {
    const rel = relogioFalso();
    const fetchImpl = (async () => { rel.avancar(5_000); return json("", 503); }) as unknown as typeof fetch;
    const { camadas } = await buscarCamadasTerreno(terreno, ["transmissao"], { ...rel, fetchImpl });
    expect(camadas.transmissao?.estado).toBe("indisponivel");
    expect(rel.decorrido()).toBeLessThan(55_000);
    expect(ORCAMENTO_PADRAO_MS).toBeLessThan(55_000);
  });

  it("a fonte principal repetindo não deixa o espelho sem tempo", async () => {
    const rel = relogioFalso();
    const registro: string[] = [];
    const fetchImpl = (async (url: string) => {
      registro.push(String(url));
      if (String(url).includes("gisepeprd2.epe.gov.br")) { rel.avancar(12_000); return json("", 503); }
      return json(FC_VAZIA);
    }) as unknown as typeof fetch;
    const { camadas } = await buscarCamadasTerreno(terreno, ["transmissao"], { ...rel, fetchImpl });
    expect(camadas.transmissao?.estado).toBe("vazio");
    expect(camadas.transmissao?.fonte).toBe(FONTES.ltIbama.nome);
    expect(rel.decorrido()).toBeLessThan(55_000);
  });
});

describe("último resultado bom salvo (fonte fora do ar)", () => {
  const rodovia = { type: "Feature", properties: { vl_br: "010" }, geometry: { type: "LineString", coordinates: [[-47.54, -5.4731], [-47.53, -5.4731]] } };

  it("resposta boa ao vivo é gravada com a camada e a chave do terreno", async () => {
    const { armazem, gravados } = armazemMemoria();
    await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json(FC_VAZIA)]).fetchImpl });
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({ camada: "rodovias", valor: { estado: "vazio" } });
    expect(gravados[0].chave).toMatch(/#\d+$/);
  });

  it("fonte cai e há salvo antigo: devolve os dados salvos com desatualizado, salvoEm e o erro de agora", async () => {
    const salvoEm = new Date("2026-11-10T13:00:00Z");
    const { armazem, gravados } = armazemMemoria();
    // grava pela própria busca para usar a mesma chave do terreno
    await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json(JSON.stringify({ type: "FeatureCollection", features: [rodovia] }))]).fetchImpl });
    const chave = gravados[0].chave;
    const armazemVelho = armazemMemoria({ [`${chave}|rodovias`]: { valor: gravados[0].valor, salvoEm } }).armazem;
    limparCacheCamadas();
    const r = roteiro([() => json("", 503)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem: armazemVelho, fetchImpl: r.fetchImpl });
    const c = camadas.rodovias!;
    expect(r.registro.length).toBeGreaterThan(0); // salvo antigo (> 12 h) não evita a consulta ao vivo
    expect(c.estado).toBe("ok");
    expect(c.desatualizado).toBe(true);
    expect(c.salvoEm).toBe(salvoEm.toISOString());
    expect(c.erro).toContain("HTTP 503");
    expect(c.dados?.rodovias[0].properties.nome).toBe("BR-010");
  });

  it("'tentar de novo' com a fonte fora do ar ainda devolve o salvo", async () => {
    const { armazem, gravados } = armazemMemoria();
    await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json(FC_VAZIA)]).fetchImpl });
    expect(gravados).toHaveLength(1);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json("", 503)]).fetchImpl }, { ignorarCache: true });
    expect(camadas.rodovias).toMatchObject({ estado: "vazio", desatualizado: true });
  });

  it("salvo recente (< 12 h) vale como cache depois de reiniciar o processo: não consulta a fonte", async () => {
    const { armazem } = armazemMemoria();
    await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json(FC_VAZIA)]).fetchImpl });
    limparCacheCamadas(); // simula o reinício (cache em memória perdido)
    const r = roteiro([() => json("", 503)]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: r.fetchImpl });
    expect(r.registro).toHaveLength(0);
    expect(camadas.rodovias?.estado).toBe("vazio");
    expect(camadas.rodovias?.desatualizado).toBeUndefined();
  });

  it("armazenamento com erro (tabela ainda não criada) não derruba a camada", async () => {
    const armazem: ArmazemCamadas = {
      ler: async () => { throw new Error('relation "camadas_terreno_cache" does not exist'); },
      gravar: async () => { throw new Error('relation "camadas_terreno_cache" does not exist'); },
    };
    const { camadas } = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), armazem, fetchImpl: roteiro([() => json(FC_VAZIA)]).fetchImpl });
    expect(camadas.rodovias?.estado).toBe("vazio");
  });
});

describe("'nada no entorno' não se confunde com 'fonte fora do ar'", () => {
  it("fonte respondeu sem elementos → vazio, sem erro; fonte fora → indisponível com o motivo", async () => {
    const ok = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), fetchImpl: roteiro([() => json(FC_VAZIA)]).fetchImpl });
    expect(ok.camadas.rodovias).toMatchObject({ estado: "vazio" });
    expect(ok.camadas.rodovias?.erro).toBeUndefined();
    limparCacheCamadas();
    const fora = await buscarCamadasTerreno(terreno, ["rodovias"], { ...relogioFalso(), fetchImpl: roteiro([() => { throw new TypeError("fetch failed"); }]).fetchImpl });
    expect(fora.camadas.rodovias?.estado).toBe("indisponivel");
    expect(fora.camadas.rodovias?.erro).toContain("sem resposta");
  });

  it("Overpass interrompido (200 com 'remark' de erro e lista vazia) não vira 'nada mapeado'", async () => {
    const r = roteiro([() => json(JSON.stringify({ elements: [], remark: "runtime error: Query timed out in \"query\" at line 1 after 21 seconds." }))]);
    const { camadas } = await buscarCamadasTerreno(terreno, ["osm"], { ...relogioFalso(), fetchImpl: r.fetchImpl });
    expect(camadas.osm?.estado).toBe("indisponivel");
    expect(camadas.osm?.erro).toContain("interrompida");
  });
});

describe("Overpass: uma consulta por vez em cada servidor", () => {
  it("dois terrenos ao mesmo tempo não disparam consultas simultâneas ao mesmo host", async () => {
    const ativos = new Map<string, number>();
    let maximo = 0;
    const fetchImpl = (async (url: string) => {
      const host = new URL(String(url)).host;
      ativos.set(host, (ativos.get(host) ?? 0) + 1);
      maximo = Math.max(maximo, ativos.get(host)!);
      await new Promise(r => setTimeout(r, 15));
      ativos.set(host, ativos.get(host)! - 1);
      return json(JSON.stringify({ elements: [] }));
    }) as unknown as typeof fetch;
    const [a, b, c] = await Promise.all([
      buscarCamadasTerreno(terreno, ["osm"], { fetchImpl }),
      buscarCamadasTerreno(quadrado(-5.5, -47.5), ["osm"], { fetchImpl }),
      buscarCamadasTerreno(quadrado(-5.6, -47.4), ["osm"], { fetchImpl }),
    ]);
    expect(maximo).toBe(1);
    expect([a, b, c].map(x => x.camadas.osm?.estado)).toEqual(["vazio", "vazio", "vazio"]);
  });
});

// Portão de QA de 16/11 (S-H): a corrida entre os espelhos não pode deixar consulta aberta depois da resposta.
describe("Overpass: corrida entre os servidores", () => {
  it("quando um servidor responde, as consultas dos outros são canceladas e nenhum reforço sai depois", async () => {
    const chamadas: string[] = [], cortadas: string[] = [];
    const rapido = new URL(FONTES.overpass.urls[2]).host;
    const fetchImpl = ((url: string, init?: RequestInit) => {
      const host = new URL(String(url)).host;
      chamadas.push(host);
      if (host === rapido) return new Promise(ok => setTimeout(() => ok(json(JSON.stringify({ elements: [] }))), 20));
      // os outros nunca respondem: só terminam se o sinal cortar
      return new Promise((_, falha) => init!.signal!.addEventListener("abort", () => { cortadas.push(host); const e = new Error("aborted"); e.name = "AbortError"; falha(e); }));
    }) as unknown as typeof fetch;
    const r = await buscarCamadasTerreno(terreno, ["osm"], { fetchImpl });
    expect(r.camadas.osm).toMatchObject({ estado: "vazio" });
    expect(r.camadas.osm?.fonte).toContain(rapido);
    await new Promise(ok => setTimeout(ok, 30));
    expect(cortadas.sort()).toEqual(FONTES.overpass.urls.map(u => new URL(u).host).filter(h => h !== rapido).sort());
    expect(chamadas).toHaveLength(FONTES.overpass.urls.length); // uma por servidor: nenhum reforço, nenhuma repetição
  });
});

describe("fonte em manutenção (EPE responde 503 com página de aviso)", () => {
  it("não repete a consulta e diz que a fonte está em manutenção", async () => {
    const registro: Chamada[] = [];
    const r = roteiro([() => new Response("<html><title>Sistema em manutenção</title></html>", { status: 503, headers: { "Content-Type": "text/html" } })], registro);
    const { camadas } = await buscarCamadasTerreno(terreno, ["vegetacao"], { ...relogioFalso(), fetchImpl: r.fetchImpl });
    expect(camadas.vegetacao?.estado).toBe("indisponivel");
    expect(camadas.vegetacao?.erro).toContain("manutenção");
    expect(new Set(registro.map(c => c.url)).size).toBe(registro.length); // nenhuma URL consultada duas vezes
  });
});
