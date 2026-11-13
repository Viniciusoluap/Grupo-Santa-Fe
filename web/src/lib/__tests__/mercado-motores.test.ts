// Paridade Prospecta (13/11): cenários de server/incorporacao-mercado-motores.test.ts.
// Sem chamadas reais: IBGE, Tavily e Google são simulados (buscador falso / fetch stub).
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { pesquisarDadosPublicos, INDICADORES_IBGE, type Buscador } from "@/lib/incorporacao/dados-publicos";
import { pesquisarMercadoImobiliario, _limparCacheAnuncios, type ProvedorAnuncios } from "@/lib/incorporacao/mercado-anuncios";
import { analisarAnuncios, urlCanonica, AVISO_PRECO_ANUNCIADO, type AnuncioBruto } from "@/lib/incorporacao/analise-anuncios";

// Respostas simuladas no FORMATO das APIs do IBGE (Localidades v1 e Agregados v3).
// A rede do ambiente de testes não alcança servicodados.ibge.gov.br — a consulta ao vivo
// fica pendente de validação em produção (ver HANDOFF).
const MUNICIPIOS = [{ id: 2111300, nome: "São Luís" }, { id: 2105302, nome: "Imperatriz" }];
const NOMES: Record<number, string> = {
  9324: "População residente estimada", 93: "População residente", 614: "Densidade demográfica",
  37: "Produto Interno Bruto a preços correntes", 707: "Pessoal ocupado total", 1606: "Salário médio mensal",
};
const UNIDADES: Record<number, string> = { 9324: "Pessoas", 93: "Pessoas", 614: "Habitante por quilômetro quadrado", 37: "Mil Reais", 707: "Pessoas", 1606: "Salários mínimos" };
const SERIES: Record<number, Record<string, string>> = {
  9324: { "2019": "1101884", "2020": "1108975", "2021": "1115932", "2024": "1088057", "2025": "1094000" },
  93: { "2022": "1037775" }, 614: { "2022": "1779.00" },
  37: { "2019": "33000000", "2020": "34000000", "2021": "36000000" },
  707: { "2022": "350000" }, 1606: { "2022": "-" }, // "-" = sem dado publicado
};

function buscadorFalso(over: Partial<Record<number, unknown>> = {}): Buscador & { urls: string[] } {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    if (url.includes("/localidades/estados/MA/municipios")) return MUNICIPIOS;
    const m = url.match(/variaveis\/(\d+)\?/);
    const v = Number(m?.[1]);
    if (v in over) { const o = over[v]; if (o instanceof Error) throw o; return o; }
    return [{ id: String(v), variavel: NOMES[v], unidade: UNIDADES[v], resultados: [{ series: [{ localidade: { id: "2111300", nome: "São Luís - MA" }, serie: SERIES[v] }] }] }];
  }) as Buscador & { urls: string[] };
  f.urls = urls;
  return f;
}

const AGORA = () => new Date("2026-11-08T12:00:00.000Z");

describe("Motor 1 — dados públicos (IBGE)", () => {
  it("resolve o município (sem acento/caixa) e usa a última competência publicada", async () => {
    const b = buscadorFalso();
    const r = await pesquisarDadosPublicos("sao luis", "ma", b, AGORA);
    expect(r.municipio).toEqual({ id: 2111300, nome: "São Luís", uf: "MA" });
    const pop = r.indicadores.find((i) => i.chave === "populacao_estimada")!;
    expect(pop.valor).toBe(1094000);
    expect(pop.periodo).toBe("2025"); // última publicada — não "o ano atual"
    expect(pop.fonte).toMatch(/IBGE/);
    expect(pop.url).toContain("N6[2111300]");
    expect(pop.consultadoEm).toBe("2026-11-08T12:00:00.000Z");
    expect(b.urls.some((u) => u.includes("/periodos/-6/"))).toBe(true);
  });

  it("indicador sem valor publicado ('-') aparece como indisponível, nunca como zero", async () => {
    const r = await pesquisarDadosPublicos("São Luís", "MA", buscadorFalso(), AGORA);
    expect(r.indicadores.find((i) => i.chave === "salario_medio")).toBeUndefined();
    expect(r.indisponiveis.find((i) => i.chave === "salario_medio")?.motivo).toMatch(/sem valor publicado/);
  });

  it("PIB per capita derivado só com população do MESMO ano; senão indisponível", async () => {
    const r = await pesquisarDadosPublicos("São Luís", "MA", buscadorFalso(), AGORA);
    const pc = r.indicadores.find((i) => i.chave === "pib_per_capita")!;
    expect(pc.periodo).toBe("2021");
    expect(pc.valor).toBeCloseTo((36_000_000 * 1000) / 1_115_932, 2);
    expect(pc.derivado).toMatch(/Calculado/);
    const semAno = await pesquisarDadosPublicos("São Luís", "MA", buscadorFalso({
      9324: [{ id: "9324", variavel: NOMES[9324], unidade: "Pessoas", resultados: [{ series: [{ localidade: { id: "1", nome: "x" }, serie: { "2025": "1094000" } }] }] }],
    }), AGORA);
    expect(semAno.indicadores.find((i) => i.chave === "pib_per_capita")).toBeUndefined();
    expect(semAno.indisponiveis.find((i) => i.chave === "pib_per_capita")?.motivo).toMatch(/2021/);
  });

  it("falha de um indicador não derruba os demais", async () => {
    const r = await pesquisarDadosPublicos("São Luís", "MA", buscadorFalso({ 37: new Error("HTTP 500") }), AGORA);
    expect(r.indisponiveis.find((i) => i.chave === "pib")?.motivo).toBe("HTTP 500");
    expect(r.indicadores.find((i) => i.chave === "populacao_estimada")).toBeDefined();
  });

  it("tabela que devolve outra variável é descartada (não exibe dado trocado)", async () => {
    const r = await pesquisarDadosPublicos("São Luís", "MA", buscadorFalso({
      707: [{ id: "707", variavel: "Número de empresas", unidade: "Unidades", resultados: [{ series: [{ localidade: { id: "1", nome: "x" }, serie: { "2022": "10" } }] }] }],
    }), AGORA);
    expect(r.indicadores.find((i) => i.chave === "pessoal_ocupado")).toBeUndefined();
    expect(r.indisponiveis.find((i) => i.chave === "pessoal_ocupado")?.motivo).toMatch(/não corresponde/);
  });

  it("município inexistente e API fora do ar: resposta explicada, sem dados", async () => {
    const r1 = await pesquisarDadosPublicos("Cidade Inventada", "MA", buscadorFalso(), AGORA);
    expect(r1.municipio).toBeNull();
    expect(r1.indicadores).toEqual([]);
    expect(r1.indisponiveis[0].motivo).toMatch(/não encontrado/);
    const fora: Buscador = async () => { throw new Error("timeout"); };
    const r2 = await pesquisarDadosPublicos("São Luís", "MA", fora, AGORA);
    expect(r2.indisponiveis[0].motivo).toMatch(/indisponível: timeout/);
  });

  it("cada indicador declara tabela e conferência de variável", () => {
    for (const d of INDICADORES_IBGE) {
      expect(d.agregado).toBeGreaterThan(0);
      expect(d.confere.length).toBeGreaterThan(3);
    }
  });
});

const anuncio = (i: number, precoM2: number, extra: Partial<AnuncioBruto> = {}): AnuncioBruto => ({
  titulo: `Lote ${i}`, url: `https://portal.exemplo/anuncio/${i}?utm_source=x`, fonte: "Portal", bairro: "Centro", tipologia: "lote",
  areaM2: 300, preco: 300 * precoM2, ...extra,
});

describe("Motor 2 — tratamento de comparáveis", () => {
  it("deduplica (mesma URL canônica e mesmo imóvel em portais diferentes)", () => {
    const a = analisarAnuncios([
      anuncio(1, 500), anuncio(1, 500, { url: "https://PORTAL.exemplo/anuncio/1/" }),
      anuncio(2, 500, { url: "https://outro.exemplo/x" }), // mesmo preço/área/bairro de 1 → duplicado
    ], { municipio: "X", tipologia: "lote", provedor: "teste" }, "t");
    expect(a.duplicados).toBe(2);
    expect(a.validos.length).toBe(1);
    expect(urlCanonica("https://A.com/p/?utm_medium=1#x")).toBe("https://a.com/p");
  });

  it("rejeita anúncios sem link, preço, área ou de outra tipologia", () => {
    const a = analisarAnuncios([
      { titulo: "sem url", preco: 1, areaM2: 1, tipologia: "lote" },
      anuncio(1, 0), anuncio(2, 500, { areaM2: undefined }), anuncio(3, 500, { tipologia: "apartamento" }),
      anuncio(4, 500, { url: "ftp://x/y" }),
    ], { municipio: "X", tipologia: "lote", provedor: "t" }, "t");
    expect(a.validos).toEqual([]);
    expect(a.rejeitados.length).toBe(5);
    expect(a.confiabilidade).toBe("insuficiente");
    expect(a.mediana).toBeNull();
  });

  it("aceita valores em texto BR e marca atípicos fora do cálculo da mediana", () => {
    const precos = [480, 500, 510, 520, 495, 505, 515, 490, 500, 3000];
    const brutos = precos.map((p, i) => anuncio(i, p, { bairro: `B${i}` }));
    brutos[0] = { ...brutos[0], preco: "R$ 144.000,00", areaM2: "300 m²" };
    const a = analisarAnuncios(brutos, { municipio: "X", tipologia: "lote", provedor: "t" }, "t");
    expect(a.validos.find((v) => v.precoM2 === 3000)?.atipico).toBe(true);
    expect(a.amostrasValidas).toBe(9);
    expect(a.mediana).toBe(500);
    expect(a.minimo).toBe(480);
    expect(a.maximo).toBe(520);
    expect(a.aviso).toBe(AVISO_PRECO_ANUNCIADO);
    expect(["alta", "media"]).toContain(a.confiabilidade);
  });

  it("faixa de área de comparabilidade", () => {
    const a = analisarAnuncios([anuncio(1, 500, { areaM2: 2000 }), anuncio(2, 500, { areaM2: 250 })],
      { municipio: "X", tipologia: "lote", areaMaxM2: 1000, provedor: "t" }, "t");
    expect(a.validos.length).toBe(1);
    expect(a.rejeitados[0].motivo).toMatch(/comparabilidade/);
  });
});

describe("Motor 2 — provedor isolado, cache e independência", () => {
  beforeEach(() => _limparCacheAnuncios());
  const c = { municipio: "São Luís", uf: "MA", tipologia: "lote" as const };

  it("sem provedor configurado: indisponível com motivo (não lança, não inventa)", async () => {
    const p: ProvedorAnuncios = { nome: "fake", indisponibilidade: () => "sem chave", buscar: async () => { throw new Error("não deveria chamar"); } };
    expect(await pesquisarMercadoImobiliario(c, p)).toEqual({ status: "indisponivel", motivo: "sem chave", provedor: "fake" });
  });

  it("usa cache para consulta idêntica", async () => {
    let chamadas = 0;
    const p: ProvedorAnuncios = { nome: "fake", indisponibilidade: () => null, buscar: async () => { chamadas++; return [anuncio(1, 500), anuncio(2, 510, { bairro: "x" }), anuncio(3, 490, { bairro: "y" })]; } };
    const r1 = await pesquisarMercadoImobiliario(c, p, AGORA);
    const r2 = await pesquisarMercadoImobiliario(c, p, AGORA);
    expect(chamadas).toBe(1);
    expect(r1.status === "ok" && r1.doCache).toBe(false);
    expect(r2.status === "ok" && r2.doCache).toBe(true);
  });

  it("falha do motor imobiliário não afeta o motor de dados oficiais", async () => {
    const quebrado: ProvedorAnuncios = { nome: "fake", indisponibilidade: () => null, buscar: async () => { throw new Error("portal fora"); } };
    const [imob, pub] = await Promise.allSettled([pesquisarMercadoImobiliario(c, quebrado), pesquisarDadosPublicos("São Luís", "MA", buscadorFalso(), AGORA)]);
    expect(imob.status).toBe("rejected");
    expect(pub.status === "fulfilled" && pub.value.indicadores.length).toBeGreaterThan(0);
  });
});

// ─── Provedor gratuito Google (Gemini + Busca Google) ────────────────────────
import { afterEach } from "vitest";
import { provedorGeminiBuscaGoogle, provedorPadrao, provedorBuscaWebAnthropic } from "@/lib/incorporacao/mercado-anuncios";
import { MERCADO_ENV as ENV } from "@/lib/incorporacao/mercado-config";

describe("Provedor Google gratuito (GEMINI_API_KEY)", () => {
  const original = { g: ENV.geminiApiKey, a: ENV.anthropicApiKey };
  afterEach(() => { ENV.geminiApiKey = original.g; ENV.anthropicApiKey = original.a; vi.unstubAllGlobals(); });
  const c = { municipio: "Imperatriz", uf: "MA", tipologia: "lote" as const };

  it("sem chave: indisponível com instrução da chave gratuita", () => {
    ENV.geminiApiKey = "";
    expect(provedorGeminiBuscaGoogle.indisponibilidade()).toMatch(/aistudio\.google\.com/);
  });

  it("é o provedor padrão quando há chave do Google (mesmo havendo chave Anthropic)", () => {
    ENV.geminiApiKey = "g-teste"; ENV.anthropicApiKey = "a-teste";
    expect(provedorPadrao()).toBe(provedorGeminiBuscaGoogle);
    ENV.geminiApiKey = "";
    expect(provedorPadrao()).toBe(provedorBuscaWebAnthropic);
  });

  it("envia a busca com Google Search e lê os anúncios da resposta", async () => {
    ENV.geminiApiKey = "g-teste";
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body));
      expect(corpo.tools).toEqual([{ google_search: {} }]);
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-teste");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"anuncios":[{"titulo":"Lote 300 m²","url":"https://portal.exemplo/1","fonte":"Portal","areaM2":300,"preco":90000,"tipologia":"lote"}]}\n```' }] } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchFalso);
    const anuncios = await provedorGeminiBuscaGoogle.buscar(c);
    expect(fetchFalso).toHaveBeenCalledOnce();
    expect(String(fetchFalso.mock.calls[0][0])).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
    expect(anuncios).toEqual([{ titulo: "Lote 300 m²", url: "https://portal.exemplo/1", fonte: "Portal", areaM2: 300, preco: 90000, tipologia: "lote" }]);
  });

  it("cota gratuita esgotada (429) vira mensagem clara, sem custo", async () => {
    ENV.geminiApiKey = "g-teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(provedorGeminiBuscaGoogle.buscar(c)).rejects.toThrow(/Cota gratuita/);
  });
});

describe("Revisão Codex — formatos numéricos brasileiros", () => {
  it("R$ 150.000 (sem centavos) vale 150.000, não 150", () => {
    const a = analisarAnuncios([
      { titulo: "L1", url: "https://x.exemplo/1", fonte: "x", areaM2: "300", preco: "R$ 150.000", tipologia: "lote", bairro: "a" },
      { titulo: "L2", url: "https://x.exemplo/2", fonte: "x", areaM2: "1.200", preco: "R$ 600.000,00", tipologia: "lote", bairro: "b" },
      { titulo: "L3", url: "https://x.exemplo/3", fonte: "x", areaM2: 250, preco: "125,000.00", tipologia: "lote", bairro: "c" },
    ], { municipio: "X", tipologia: "lote", provedor: "t" }, "t");
    expect(a.validos.map((v) => v.precoM2)).toEqual([500, 500, 500]);
  });
});

// ─── Chave do Google guardada no banco (sem depender do painel do Vercel) ─────
import { carregarChaveGemini, _limparCacheChaveGemini, CHAVE_SEGREDO_GEMINI } from "@/lib/incorporacao/segredos-mercado";

describe("Chave do Google no banco (configuracoes, segredo.*)", () => {
  const segredoAuth = process.env.AUTH_SECRET;
  afterEach(() => { _limparCacheChaveGemini(); ENV.geminiApiKey = ""; if (segredoAuth === undefined) delete process.env.AUTH_SECRET; });

  it("lê 'plain:' do banco, usa a chave e recriptografa no primeiro uso", async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "segredo-de-teste-com-tamanho-suficiente";
    const gravados = new Map<string, string>([[CHAVE_SEGREDO_GEMINI, "plain:chave-teste-123"]]);
    const banco = { lerConfiguracao: async (k: string) => gravados.get(k), gravarConfiguracao: async (k: string, v: string) => { gravados.set(k, v); } };
    expect(await carregarChaveGemini(banco)).toBe("chave-teste-123");
    expect(ENV.geminiApiKey).toBe("chave-teste-123");
    const cifrado = gravados.get(CHAVE_SEGREDO_GEMINI)!;
    expect(cifrado.startsWith("plain:")).toBe(false);
    expect(cifrado).not.toContain("chave-teste-123");
    _limparCacheChaveGemini();
    expect(await carregarChaveGemini(banco)).toBe("chave-teste-123"); // lê o valor já criptografado
  });

  it("sem chave no banco: vazio (o provedor informa a falta), sem lançar", async () => {
    const banco = { lerConfiguracao: async () => undefined, gravarConfiguracao: async () => undefined };
    expect(await carregarChaveGemini(banco)).toBe("");
  });
});

describe("Provedor Google — mensagens de erro da chave", () => {
  afterEach(() => { ENV.geminiApiKey = ""; vi.unstubAllGlobals(); });
  it("402 (crédito pré-pago esgotado) explica como usar o nível gratuito", async () => {
    ENV.geminiApiKey = "g-teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 402 })));
    await expect(provedorGeminiBuscaGoogle.buscar({ municipio: "X", uf: "MA", tipologia: "lote" })).rejects.toThrow(/crédito pré-pago esgotado.*SEM faturamento/);
  });
});

// ─── Provedor Tavily (gratuito, sem IA) + extração determinística ────────────
import { extrairAnunciosDeResultado } from "@/lib/incorporacao/extracao-anuncios";
import { provedorTavily, consultasTavily } from "@/lib/incorporacao/mercado-anuncios";
import { CHAVE_SEGREDO_TAVILY, carregarChaveTavily } from "@/lib/incorporacao/segredos-mercado";

const CONSULTA_IMP = { municipio: "Imperatriz", uf: "MA", tipologia: "lote" as const };
// trechos no formato REAL devolvido pelo Tavily em 08/11/2026 (páginas de listagem)
const OLX = { url: "https://www.olx.com.br/imoveis/terrenos/lotes/compra/estado-ma/regiao-de-imperatriz-e-caxias/imperatriz", title: "Terreno e lotes à venda - Imperatriz - MA",
  content: "Terreno à venda no bairro Jardim São Luís - Imperatriz/MA. 522m². R$ 450.000 ; Terreno em Trindade de Goiania. 200m² · R$ 80.000. Condomínio R$ 80.000." };

describe("Extração de anúncios (sem IA)", () => {
  it("separa os anúncios da página e só aceita trecho com UM preço e UMA área", () => {
    const r = extrairAnunciosDeResultado({ ...OLX, content: "Terreno à venda no bairro Jardim São Luís - Imperatriz/MA. 522m². R$ 450.000" }, CONSULTA_IMP);
    expect(r.anuncios).toHaveLength(1);
    expect(r.anuncios[0]).toMatchObject({ preco: 450000, areaM2: 522, fonte: "olx.com.br", bairro: "Jardim São Luís", tipologia: "lote" });
  });

  it("trecho de outra cidade, preço e área separados por '·', condomínio: nada é aproveitado por engano", () => {
    const r = extrairAnunciosDeResultado({ ...OLX, content: "Terreno em Trindade de Goiania. 200m² · R$ 80.000. Condomínio R$ 80.000." }, CONSULTA_IMP);
    expect(r.anuncios).toHaveLength(0);
  });

  it("descarta médias de mercado, preço por m², parcelas e aluguel", () => {
    for (const content of [
      "Valor médio da compra de lote/terreno em Imperatriz. 312 m². R$ 1 mil/m².",
      "-valor do M²: R$ 354,60. área 564 m²",
      "RESIDENCIAL CIDADE NOVA - Parcelas A Partir de R$268,90 lote 200 m²",
      "Casa para alugar 300 m² R$ 1.200,00/mês Imperatriz",
    ]) expect(extrairAnunciosDeResultado({ ...OLX, content }, CONSULTA_IMP).anuncios).toHaveLength(0);
  });

  it("mesma área escrita duas vezes conta como uma; 'mil/milhão' e hectares", () => {
    const a = extrairAnunciosDeResultado({ ...OLX, content: "Terreno no Centro de Imperatriz-MA, com 32.850,00 m² de área. 32850m². R$ 1.500.000." }, CONSULTA_IMP).anuncios;
    expect(a[0]).toMatchObject({ areaM2: 32850, preco: 1500000 });
    const b = extrairAnunciosDeResultado({ ...OLX, content: "Chácara em Imperatriz com 2 ha por R$ 1,2 milhão" }, CONSULTA_IMP).anuncios;
    expect(b[0]).toMatchObject({ areaM2: 20000, preco: 1200000 });
  });

  it("trecho com dois preços ou duas áreas diferentes é ambíguo: recusado", () => {
    const r = extrairAnunciosDeResultado({ ...OLX, content: "Lotes de 250 m² e 300 m² em Imperatriz por R$ 90.000" }, CONSULTA_IMP);
    expect(r.anuncios).toHaveLength(0);
    expect(r.descartes[0].motivo).toMatch(/ambíguo/);
  });

  it("vários anúncios da MESMA página não são confundidos com duplicados na análise", () => {
    const content = "Lote 300 m² Imperatriz R$ 90.000 ; Lote 450 m² Imperatriz R$ 150.000 ; Lote 600 m² Imperatriz R$ 180.000";
    const brutos = extrairAnunciosDeResultado({ ...OLX, content }, CONSULTA_IMP).anuncios;
    const a = analisarAnuncios(brutos, { municipio: "Imperatriz", tipologia: "lote", provedor: "t" }, "t");
    expect(a.validos).toHaveLength(3);
    expect(a.duplicados).toBe(0);
  });
});

describe("Provedor Tavily", () => {
  afterEach(() => { ENV.tavilyApiKey = ""; vi.unstubAllGlobals(); });

  it("sem chave: indisponível com instrução (tavily.com)", () => {
    ENV.tavilyApiKey = "";
    expect(provedorTavily.indisponibilidade()).toMatch(/tavily\.com/);
  });

  it("é o provedor padrão quando há chave, antes de Google e Anthropic", () => {
    ENV.tavilyApiKey = "tvly-t"; ENV.geminiApiKey = "g"; ENV.anthropicApiKey = "a";
    expect(provedorPadrao()).toBe(provedorTavily);
    ENV.geminiApiKey = ""; ENV.anthropicApiKey = "";
  });

  it("envia 2 buscas básicas autenticadas e extrai os anúncios das páginas (sem repetir página)", async () => {
    ENV.tavilyApiKey = "tvly-t";
    const corpos: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.tavily.com/search");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tvly-t");
      corpos.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ results: [OLX] }), { status: 200 });
    }));
    const anuncios = await provedorTavily.buscar(CONSULTA_IMP);
    expect(corpos).toHaveLength(2);
    expect(corpos[0]).toMatchObject({ search_depth: "basic", max_results: 20 });
    expect(corpos.map((c) => c.query)).toEqual(consultasTavily(CONSULTA_IMP));
    expect(anuncios).toHaveLength(1); // a mesma página nas duas buscas entra uma vez; o trecho de Goiânia é descartado
    expect(anuncios[0]).toMatchObject({ preco: 450000, areaM2: 522 });
  });

  it("401 e 432 viram mensagens claras", async () => {
    ENV.tavilyApiKey = "tvly-t";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(provedorTavily.buscar(CONSULTA_IMP)).rejects.toThrow(/recusada/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 432 })));
    await expect(provedorTavily.buscar(CONSULTA_IMP)).rejects.toThrow(/Limite gratuito/);
  });

  it("chave do Tavily no banco: 'plain:' é usada e recriptografada", async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "segredo-de-teste-com-tamanho-suficiente";
    _limparCacheChaveGemini();
    const gravados = new Map<string, string>([[CHAVE_SEGREDO_TAVILY, "plain:tvly-xyz"]]);
    const banco = { lerConfiguracao: async (k: string) => gravados.get(k), gravarConfiguracao: async (k: string, v: string) => { gravados.set(k, v); } };
    expect(await carregarChaveTavily(banco)).toBe("tvly-xyz");
    expect(ENV.tavilyApiKey).toBe("tvly-xyz");
    expect(gravados.get(CHAVE_SEGREDO_TAVILY)!.startsWith("plain:")).toBe(false);
  });
});

describe("Revisão Codex (PR #190) — extração", () => {
  const PAGINA = { url: "https://portal.exemplo/imoveis/imperatriz", title: "Imóveis em Imperatriz" };
  it("aluguel em qualquer forma ('para alugar', 'aluga-se', 'locação') é descartado", () => {
    for (const content of [
      "Casa para alugar em Imperatriz por R$ 1.200,00, com 300 m²",
      "Aluga-se casa Imperatriz. R$ 1.200,00. 300 m²",
      "Loca-se terreno Imperatriz 300 m² R$ 1.500",
    ]) expect(extrairAnunciosDeResultado({ ...PAGINA, content }, CONSULTA_IMP).anuncios).toHaveLength(0);
  });
  it("município homônimo de OUTRO estado é descartado; o mesmo estado é aceito", () => {
    const pi = { municipio: "Bom Jesus", uf: "PI", tipologia: "lote" as const };
    const pagina = { url: "https://portal.exemplo/bom-jesus", title: "Lotes em Bom Jesus" };
    expect(extrairAnunciosDeResultado({ ...pagina, content: "Lote em Bom Jesus/RS por R$ 150.000 com 300 m²" }, pi).anuncios).toHaveLength(0);
    expect(extrairAnunciosDeResultado({ ...pagina, content: "Lote em Bom Jesus - RS por R$ 150.000 com 300 m²" }, pi).anuncios).toHaveLength(0);
    expect(extrairAnunciosDeResultado({ ...pagina, content: "Lote em Bom Jesus/PI por R$ 150.000 com 300 m²" }, pi).anuncios).toHaveLength(1);
  });
  it("área com ponto decimal não vira um pedaço do número", () => {
    const a = extrairAnunciosDeResultado({ ...PAGINA, content: "Lote em Imperatriz com 250.50 m² por R$ 150.000" }, CONSULTA_IMP).anuncios;
    expect(a).toHaveLength(1);
    expect(a[0].areaM2).toBe(250.5);
    expect(extrairAnunciosDeResultado({ ...PAGINA, content: "Lote em Imperatriz com 1.250 m² por R$ 150.000" }, CONSULTA_IMP).anuncios[0].areaM2).toBe(1250);
  });
});
