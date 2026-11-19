// Paridade 17/11, bloco 3 — porte de Prospecta/server/integracoes-anthropic.test.ts e integracoes-modelo-por-funcao.test.ts
// (EPIC-024 S-10/S-11): Anthropic em Admin › Integrações — só cadastro. Cliente da Anthropic simulado: nada externo é
// chamado. Inclui a GUARDA que vigia onde a chave do painel é lida: no Santa Fé, em nenhuma função.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ atual: null as null | { user: { id: string; role: string; permissoes?: string[] } } }));
vi.mock("@/auth", () => ({ auth: async () => sessao.atual }));
// SDK simulado: só models.list (o que o painel usa). Chave fora da lista → 401.
const sdk = vi.hoisted(() => ({ aceitas: [] as string[], chamadas: [] as string[], criadas: 0 }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    apiKey: string;
    constructor(o: { apiKey: string }) { this.apiKey = o.apiKey; sdk.criadas++; }
    models = { list: () => clienteFalso(sdk.aceitas, sdk.chamadas)(this.apiKey).models.list() };
  },
}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste-do-cofre";

import {
  CHAVE_MODELO_ANTHROPIC_PAINEL, CHAVE_SEGREDO_ANTHROPIC_PAINEL, conferirModelosDasFuncoes, familiaDoModelo, gravarModeloDaFuncao, mascararChaveAnthropic,
  modelosAnthropicPainel, removerAnthropicPainel, salvarChaveAnthropicPainel, salvarModeloDaFuncao, salvarModeloPreferencialAnthropic, statusAnthropicPainel,
  statusModelosPorFuncao, testarAnthropicPainel, type AnthropicPainelDeps, type ClienteModelos,
} from "@/lib/ia/anthropic-painel";
import { CHAVE_MODELO_PREFERENCIAL, chaveAvisoDaFuncao, chaveModeloDaFuncao, modeloDaFuncao } from "@/lib/ia/modelo-por-funcao";
import { FUNCOES_ANTHROPIC, haAlgoParaSalvar } from "@/lib/ia/funcoes-anthropic";
import { criptografarSegredo, descriptografarSegredo } from "@/lib/segredo";

const CHAVE = "sk-ant-api03-chave-de-teste-0000000000wxyz";
const CHAVE_NOVA = "sk-ant-api03-outra-chave-1111111111abcd";
const CHAVE_RESTRITA = "sk-ant-api03-chave-restrita-22222222hhhh";
const MODELOS = [
  { id: "claude-opus-5-5", display_name: "Claude Opus 5.5", created_at: "2026-10-01T00:00:00Z" },
  { id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5", created_at: "2026-10-01T00:00:00Z" },
  { id: "claude-haiku-5", display_name: "Claude Haiku 5", created_at: "2026-09-01T00:00:00Z" },
  { id: "claude-fable-1", display_name: "Claude Fable 1", created_at: "2026-08-01T00:00:00Z" },
];

function clienteFalso(aceitas: string[], chamadas: string[]) {
  return (apiKey: string): ClienteModelos => ({
    models: {
      list: () => ({
        async *[Symbol.asyncIterator]() {
          chamadas.push(apiKey);
          if (!aceitas.includes(apiKey)) throw Object.assign(new Error(`401 invalid x-api-key ${apiKey}`), { status: 401 });
          // a chave "restrita" só oferece o Haiku
          for (const m of apiKey === CHAVE_RESTRITA ? MODELOS.filter((x) => x.id.includes("haiku")) : MODELOS) yield m;
        },
      }),
    },
  });
}

function setup(aceitas = [CHAVE, CHAVE_NOVA, CHAVE_RESTRITA]) {
  const banco = new Map<string, string>();
  const chamadas: string[] = [];
  const criarCliente = vi.fn(clienteFalso(aceitas, chamadas));
  const deps: AnthropicPainelDeps = {
    lerBanco: async (k) => banco.get(k),
    gravarBanco: async (k, v) => { banco.set(k, v); },
    criarCliente, encrypt: criptografarSegredo, decrypt: descriptografarSegredo,
  };
  return { banco, deps, criarCliente, chamadas };
}

beforeEach(() => { process.env.AUTH_SECRET = "segredo-de-teste-do-cofre"; });

describe("Anthropic — chave protegida", () => {
  it("testa antes de salvar, grava criptografada e nenhuma resposta devolve a chave (só os 4 últimos)", async () => {
    const s = setup();
    const r = await salvarChaveAnthropicPainel(`  ${CHAVE}  `, s.deps);
    expect(r.modelos).toBe(4);
    expect(s.chamadas).toEqual([CHAVE]);
    const gravado = s.banco.get(CHAVE_SEGREDO_ANTHROPIC_PAINEL)!;
    expect(gravado).not.toContain("sk-ant");
    expect(descriptografarSegredo(gravado)).toBe(CHAVE);
    const status = await statusAnthropicPainel(s.deps);
    expect(status).toEqual({ configurado: true, final: "…wxyz", modeloPreferencial: null, ativa: false, ilegivel: false, aviso: null });
    const respostas = [r, status, await testarAnthropicPainel(s.deps), await modelosAnthropicPainel(s.deps),
      await salvarModeloPreferencialAnthropic("claude-opus-5-5", s.deps), await statusModelosPorFuncao({}, s.deps)];
    for (const resp of respostas) expect(JSON.stringify(resp)).not.toContain(CHAVE);
  });

  it("chave recusada não é salva e a mensagem não mostra a chave", async () => {
    const s = setup([]);
    const erro = await salvarChaveAnthropicPainel(CHAVE, s.deps).catch((e) => e);
    expect(erro.message).toContain("HTTP 401");
    expect(erro.message).not.toContain(CHAVE);
    expect(s.banco.has(CHAVE_SEGREDO_ANTHROPIC_PAINEL)).toBe(false);
  });

  it("formato inválido nem chega à Anthropic", async () => {
    const s = setup();
    await expect(salvarChaveAnthropicPainel("sk-ant curta", s.deps)).rejects.toThrow(/inválida/);
    await expect(salvarChaveAnthropicPainel("", s.deps)).rejects.toThrow(/Cole a chave/);
    expect(s.criarCliente).not.toHaveBeenCalled();
  });

  it("trocar substitui a chave; remover apaga chave, preferência e modelos por função", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await salvarModeloPreferencialAnthropic("claude-sonnet-5-5", s.deps);
    await salvarModeloDaFuncao("central_vendas_agente", "claude-haiku-5", s.deps);
    await salvarChaveAnthropicPainel(CHAVE_NOVA, s.deps);
    expect(descriptografarSegredo(s.banco.get(CHAVE_SEGREDO_ANTHROPIC_PAINEL)!)).toBe(CHAVE_NOVA);
    expect((await statusAnthropicPainel(s.deps)).final).toBe("…abcd");
    await removerAnthropicPainel(s.deps);
    expect(await statusAnthropicPainel(s.deps)).toEqual({ configurado: false, final: null, modeloPreferencial: null, ativa: false, ilegivel: false, aviso: null });
    expect((await statusModelosPorFuncao({}, s.deps)).funcoes.map((f) => f.modelo)).toEqual([null, null]);
  });

  it("testar sem chave salva não chama a Anthropic; chave revogada mostra o erro mascarado", async () => {
    const s = setup();
    expect(await testarAnthropicPainel(s.deps)).toEqual({ ok: false, mensagem: "Nenhuma chave da Anthropic salva." });
    expect(s.criarCliente).not.toHaveBeenCalled();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    const s2 = setup([]);
    s2.banco.set(CHAVE_SEGREDO_ANTHROPIC_PAINEL, s.banco.get(CHAVE_SEGREDO_ANTHROPIC_PAINEL)!);
    const r = await testarAnthropicPainel(s2.deps);
    expect(r.ok).toBe(false);
    expect(r.mensagem).not.toContain(CHAVE);
  });

  it("mascararChaveAnthropic", () => {
    expect(mascararChaveAnthropic(`falhou com ${CHAVE}.`)).toBe("falhou com sk-ant-….");
  });

  it("chave salva que não decifra: status avisa para cadastrar de novo; não chega à Anthropic", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    process.env.AUTH_SECRET = "outro-segredo-depois-da-rotacao";
    const st = await statusAnthropicPainel(s.deps);
    expect(st).toMatchObject({ configurado: false, ilegivel: true, aviso: expect.stringMatching(/não pode ser lida.*cadastre de novo/) });
    expect(await testarAnthropicPainel(s.deps)).toEqual({ ok: false, mensagem: st.aviso });
    await expect(modelosAnthropicPainel(s.deps)).rejects.toThrow(/cadastre de novo/);
    expect(s.criarCliente).toHaveBeenCalledTimes(1); // só a validação do salvar
  });

  it("valor gravado como plain: é recriptografado na primeira leitura", async () => {
    const s = setup();
    s.banco.set(CHAVE_SEGREDO_ANTHROPIC_PAINEL, `plain:${CHAVE}`);
    expect((await statusAnthropicPainel(s.deps)).final).toBe("…wxyz");
    const gravado = s.banco.get(CHAVE_SEGREDO_ANTHROPIC_PAINEL)!;
    expect(gravado.startsWith("plain:")).toBe(false);
    expect(descriptografarSegredo(gravado)).toBe(CHAVE);
  });
});

describe("Anthropic — modelos e preferência", () => {
  it("lista os modelos devolvidos pela API, com nome e id oficiais e a família", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    expect((await modelosAnthropicPainel(s.deps)).map((m) => [m.id, m.nome, m.familia])).toEqual([
      ["claude-opus-5-5", "Claude Opus 5.5", "opus"], ["claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet"],
      ["claude-haiku-5", "Claude Haiku 5", "haiku"], ["claude-fable-1", "Claude Fable 1", "fable"],
    ]);
    expect(familiaDoModelo("claude-x-1")).toBe("outro");
  });

  it("preferência validada contra os ids listados e trocável depois", async () => {
    const s = setup();
    await expect(salvarModeloPreferencialAnthropic("claude-opus-5-5", s.deps)).rejects.toThrow(/Salve a chave/);
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await expect(salvarModeloPreferencialAnthropic("claude-inexistente", s.deps)).rejects.toThrow(/não está disponível/);
    expect(s.banco.get(CHAVE_MODELO_ANTHROPIC_PAINEL)).toBeUndefined();
    await salvarModeloPreferencialAnthropic("claude-opus-5-5", s.deps);
    await salvarModeloPreferencialAnthropic("claude-haiku-5", s.deps);
    expect((await statusAnthropicPainel(s.deps)).modeloPreferencial).toBe("claude-haiku-5");
  });

  it("trocar a chave revalida o preferencial e o modelo de cada função: o que a chave nova não oferece é limpo, com aviso", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await salvarModeloPreferencialAnthropic("claude-opus-5-5", s.deps);
    await salvarModeloDaFuncao("incorporacao_mercado", "claude-sonnet-5-5", s.deps);
    const r = await salvarChaveAnthropicPainel(CHAVE_RESTRITA, s.deps);
    expect(r.modeloLimpo).toBe("claude-opus-5-5");
    expect(r.mensagem).toMatch(/claude-opus-5-5 não é oferecido.*foi limpo/);
    expect(r.mensagem).toMatch(/claude-sonnet-5-5 de "Mercado da Incorporação/);
    const st = await statusModelosPorFuncao({}, s.deps);
    expect(st.funcoes.find((f) => f.id === "incorporacao_mercado")).toMatchObject({ modelo: null, sumiu: "claude-sonnet-5-5" });
    // salvar a opção vazia tira o aviso (e a tela deixa salvar por isso)
    expect(haAlgoParaSalvar({ modelo: null, sumiu: "claude-sonnet-5-5" }, "")).toBe(true);
    expect(haAlgoParaSalvar({ modelo: null, sumiu: null }, "")).toBe(false);
    expect(haAlgoParaSalvar({ modelo: "a", sumiu: null }, "b")).toBe(true);
    await salvarModeloDaFuncao("incorporacao_mercado", "", s.deps);
    expect((await statusModelosPorFuncao({}, s.deps)).funcoes.find((f) => f.id === "incorporacao_mercado")?.sumiu).toBeNull();
  });

  it("modelo que sumiu da conta, conferido ao listar: a função cai para a próxima opção e o painel avisa", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await salvarModeloDaFuncao("central_vendas_agente", "claude-opus-5-5", s.deps);
    expect(await conferirModelosDasFuncoes([{ id: "claude-haiku-5", nome: "H", familia: "haiku", lancadoEm: null }], s.deps)).toEqual([{ funcao: "central_vendas_agente", modelo: "claude-opus-5-5" }]);
    expect(s.banco.get(chaveModeloDaFuncao("central_vendas_agente"))).toBe("");
    expect(s.banco.get(chaveAvisoDaFuncao("central_vendas_agente"))).toBe("claude-opus-5-5");
  });

  it("QA S-11 achado 6: falha ao gravar o modelo da função não deixa nada pela metade (o aviso volta)", async () => {
    const s = setup();
    s.banco.set(chaveAvisoDaFuncao("central_vendas_agente"), "claude-antigo");
    const falha: AnthropicPainelDeps = { ...s.deps, gravarBanco: async (k, v) => { if (k === chaveModeloDaFuncao("central_vendas_agente")) throw new Error("banco fora"); s.banco.set(k, v); } };
    await expect(gravarModeloDaFuncao("central_vendas_agente", null, falha)).rejects.toThrow(/banco fora/);
    expect(s.banco.get(chaveAvisoDaFuncao("central_vendas_agente"))).toBe("claude-antigo");
  });

  it("valor de função desconhecida (Dolores/Maquete não existem aqui) é recusado", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await expect(salvarModeloDaFuncao("dolores_whatsapp" as never, "claude-haiku-5", s.deps)).rejects.toThrow(/Função desconhecida/);
    expect(FUNCOES_ANTHROPIC).toEqual(["central_vendas_agente", "incorporacao_mercado"]);
  });
});

describe("modeloDaFuncao — resolução (só nomes de modelo)", () => {
  const leitor = (m: Record<string, string>) => ({ lerBanco: async (k: string) => m[k] });
  it("ambiente → função → anterior → preferencial → padrão", async () => {
    const base = { [chaveModeloDaFuncao("incorporacao_mercado")]: "da-funcao", [CHAVE_MODELO_PREFERENCIAL]: "preferido" };
    expect(await modeloDaFuncao("incorporacao_mercado", { ambiente: "do-env", padrao: "p" }, leitor(base))).toEqual({ modelo: "do-env", origem: "ambiente" });
    expect(await modeloDaFuncao("incorporacao_mercado", { ambiente: "  ", padrao: "p" }, leitor(base))).toEqual({ modelo: "da-funcao", origem: "funcao" });
    expect(await modeloDaFuncao("central_vendas_agente", { anterior: "da-central" }, leitor(base))).toEqual({ modelo: "da-central", origem: "anterior" });
    expect(await modeloDaFuncao("central_vendas_agente", {}, leitor(base))).toEqual({ modelo: "preferido", origem: "preferencial" });
    expect(await modeloDaFuncao("central_vendas_agente", { padrao: "p" }, leitor({}))).toEqual({ modelo: "p", origem: "padrao" });
    expect(await modeloDaFuncao("central_vendas_agente", {}, leitor({}))).toEqual({ modelo: null, origem: null });
    expect(await modeloDaFuncao("maquete_leitura" as never, {}, leitor(base))).toEqual({ modelo: null, origem: null });
  });
  it("banco fora do ar (erro assíncrono ou síncrono) cai para o próximo, sem lançar", async () => {
    expect(await modeloDaFuncao("central_vendas_agente", { anterior: "x" }, { lerBanco: async () => { throw new Error("fora"); } })).toEqual({ modelo: "x", origem: "anterior" });
    expect(await modeloDaFuncao("incorporacao_mercado", { padrao: "p" }, { lerBanco: () => { throw new Error("síncrono"); } })).toEqual({ modelo: "p", origem: "padrao" });
  });
  it("nunca lê a chave: só as chaves de modelo", async () => {
    const lidas: string[] = [];
    await modeloDaFuncao("central_vendas_agente", {}, { lerBanco: async (k) => { lidas.push(k); return undefined; } });
    expect(lidas).toEqual([chaveModeloDaFuncao("central_vendas_agente"), CHAVE_MODELO_PREFERENCIAL]);
    expect(lidas.some((k) => k === CHAVE_SEGREDO_ANTHROPIC_PAINEL)).toBe(false);
  });
  it("status por função: 'valendo' é a resolução real da função; sem a chave DELA, o painel diz que não roda", async () => {
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await salvarModeloPreferencialAnthropic("claude-haiku-5", s.deps);
    const st = await statusModelosPorFuncao({
      central_vendas_agente: { anterior: "claude-sonnet-5", temChave: true },
      incorporacao_mercado: { ambiente: "claude-env", padrao: "claude-sonnet-5-5", temChave: false, semChave: "Sem ANTHROPIC_API_KEY" },
    }, s.deps);
    expect(st.configurado).toBe(true);
    expect(st.funcoes.map((f) => [f.id, f.valendo, f.semChave])).toEqual([
      ["central_vendas_agente", { modelo: "claude-sonnet-5", origem: "anterior" }, null],
      ["incorporacao_mercado", { modelo: "claude-env", origem: "ambiente" }, "Sem ANTHROPIC_API_KEY"],
    ]);
    await salvarModeloDaFuncao("central_vendas_agente", "claude-opus-5-5", s.deps);
    expect((await statusModelosPorFuncao({ central_vendas_agente: { anterior: "claude-sonnet-5" } }, s.deps)).funcoes[0].valendo).toEqual({ modelo: "claude-opus-5-5", origem: "funcao" });
  });
});

describe("Anthropic — acesso e isolamento", () => {
  it("só o admin usa as ações do painel; nenhuma chama a Anthropic para quem não é admin", async () => {
    const acoes = await import("@/lib/actions/integracoes");
    sdk.criadas = 0;
    for (const [role, permissoes] of [["colaborador", ["incorporacao", "central_vendas"]], ["corretor", undefined], ["cliente", undefined]] as const) {
      sessao.atual = { user: { id: "u-teste", role, ...(permissoes ? { permissoes: [...permissoes] } : {}) } };
      expect(await acoes.statusAnthropicAcao()).toEqual({ erro: "Não autorizado." });
      expect(await acoes.salvarAnthropicAcao(CHAVE)).toEqual({ erro: "Não autorizado." });
      expect(await acoes.testarAnthropicAcao()).toEqual({ ok: false, mensagem: "Não autorizado." });
      expect(await acoes.modelosAnthropicAcao()).toEqual({ erro: "Não autorizado." });
      expect(await acoes.salvarModeloAnthropicAcao("claude-opus-5-5")).toEqual({ erro: "Não autorizado." });
      expect(await acoes.removerAnthropicAcao()).toEqual({ erro: "Não autorizado." });
      expect(await acoes.modelosPorFuncaoAnthropicAcao()).toEqual({ erro: "Não autorizado." });
      expect(await acoes.salvarModeloFuncaoAnthropicAcao("central_vendas_agente", "claude-opus-5-5")).toEqual({ erro: "Não autorizado." });
    }
    expect(sdk.criadas).toBe(0);
  });

  it("salvar a chave do painel NÃO muda ANTHROPIC_API_KEY, a chave do Mercado nem a da Central", async () => {
    const { MERCADO_ENV } = await import("@/lib/incorporacao/mercado-config");
    const antes = { env: process.env.ANTHROPIC_API_KEY, mercado: MERCADO_ENV.anthropicApiKey, modelo: MERCADO_ENV.incorporacaoIaModelo };
    const s = setup();
    await salvarChaveAnthropicPainel(CHAVE, s.deps);
    await salvarModeloPreferencialAnthropic("claude-haiku-5", s.deps);
    await testarAnthropicPainel(s.deps);
    expect(process.env.ANTHROPIC_API_KEY).toBe(antes.env);
    expect(MERCADO_ENV.anthropicApiKey).toBe(antes.mercado);
    expect(MERCADO_ENV.anthropicApiKey).not.toBe(CHAVE);
    expect(MERCADO_ENV.incorporacaoIaModelo).toBe(antes.modelo);
  });

  /** O que o módulo de modelos (src/lib/ia/modelo-por-funcao.ts) não pode conter. */
  function problemasDoModuloDeModelos(texto: string): string[] {
    const p: string[] = [];
    if (/anthropic-painel|@\/lib\/segredo|descriptografarSegredo|\bdecrypt\b|criarCliente|CHAVE_SEGREDO_ANTHROPIC_PAINEL|anthropic_painel_api_key|api_key|apiKey/.test(texto)) p.push("só nomes de modelo");
    if (/anthropic_painel_(?!modelo["'`])/.test(texto)) p.push("texto de chave montado em pedaços");
    if (/\bimport\s*\(|\brequire\s*\(|\bcreateRequire\b/.test(texto)) p.push("import dinâmico proibido");
    return p;
  }
  const IMPORTS_DO_MODULO_DE_MODELOS = [
    `import { prisma } from "@/lib/db";`,
    `import { FUNCOES_ANTHROPIC, ehFuncaoAnthropic, type FuncaoAnthropic } from "@/lib/ia/funcoes-anthropic";`,
  ];
  function importsErradosDoModuloDeModelos(texto: string): string[] {
    const declarados = Array.from(texto.matchAll(/^\s*import\b[^;]*;/gm), (m) => m[0].trim().replace(/\s+/g, " "));
    const modulos = Array.from(texto.matchAll(/(?:\bfrom|\bimport)\s*["'`]([^"'`]+)["'`]/g), (m) => m[1]);
    const permitidos = IMPORTS_DO_MODULO_DE_MODELOS.map((l) => l.match(/from "([^"]+)"/)![1]);
    const p: string[] = [];
    if (JSON.stringify(declarados) !== JSON.stringify(IMPORTS_DO_MODULO_DE_MODELOS)) p.push(`imports fora da lista: ${declarados.join(" | ")}`);
    if (modulos.length !== permitidos.length || modulos.some((m, i) => m !== permitidos[i])) p.push(`módulos citados: ${modulos.join(", ")}`);
    return p;
  }
  const raiz = path.resolve(__dirname, "..", "..", "..");
  const ler = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

  it("a guarda do módulo de modelos pega decrypt, criarCliente, nome da chave, chave em pedaços e import dinâmico", () => {
    for (const t of [
      `const c = (deps as any).decrypt(await deps.lerBanco("segredo.anthropic_painel_" + "api_key"));`,
      `const k = await deps.lerBanco("segredo.anthropic_painel_" + parte);`,
      "const k = await deps.lerBanco(`segredo.anthropic_painel_${x}`);",
      `await (deps as any).criarCliente(k);`,
      `const apiKey = 1;`,
      `const m = await import("@/lib/seg" + "redo");`,
      `const m = require("@/lib/segredo");`,
    ]) expect(problemasDoModuloDeModelos(t), t).not.toEqual([]);
    const fonte = ler("src/lib/ia/modelo-por-funcao.ts");
    expect(problemasDoModuloDeModelos(fonte)).toEqual([]);
    expect(importsErradosDoModuloDeModelos(fonte)).toEqual([]);
    for (const [nome, t] of [
      ["import a mais", fonte.replace(IMPORTS_DO_MODULO_DE_MODELOS[1], `${IMPORTS_DO_MODULO_DE_MODELOS[1]}\nimport { descriptografarSegredo } from "@/lib/segredo";`)],
      ["import de efeito", fonte.replace(IMPORTS_DO_MODULO_DE_MODELOS[1], `${IMPORTS_DO_MODULO_DE_MODELOS[1]}\nimport "@/lib/segredo";`)],
      ["reexportação", `${fonte}\nexport { descriptografarSegredo } from "@/lib/segredo";`],
    ] as const) expect(importsErradosDoModuloDeModelos(t), nome).not.toEqual([]);
    // o painel só passa o leitor do banco (sem decrypt/criarCliente) ao módulo de modelos
    const painel = ler("src/lib/ia/anthropic-painel.ts");
    const chamadas = Array.from(painel.matchAll(/(?:modeloDaFuncao|modelosGravadosDasFuncoes)\(/g));
    expect(chamadas.length).toBeGreaterThan(0);
    for (const c of chamadas) {
      const resto = painel.slice(c.index!);
      let nivel = 0, fim = 0;
      for (let i = resto.indexOf("("); i < resto.length; i++) { if (resto[i] === "(") nivel++; if (resto[i] === ")" && --nivel === 0) { fim = i; break; } }
      expect(resto.slice(0, fim + 1)).toMatch(/soLeitor\(deps\)\)?$/);
    }
  });

  it("nenhum código do sistema lê a chave do painel: só o painel, as ações dele e o módulo de modelos (só nomes); Central e Mercado só importam modeloDaFuncao", () => {
    const permitidos: Record<string, "painel" | "acoes" | "modelos" | "tela"> = {
      [path.join("src", "lib", "ia", "anthropic-painel.ts")]: "painel",
      [path.join("src", "lib", "actions", "integracoes.ts")]: "acoes",
      [path.join("src", "lib", "ia", "modelo-por-funcao.ts")]: "modelos",
      [path.join("src", "app", "admin", "integracoes", "_components", "anthropic-card.tsx")]: "tela",
    };
    // quem pode importar o módulo de modelos, e só com modeloDaFuncao
    const consumidoresDeModelos = [path.join("src", "lib", "central-vendas", "ia.ts"), path.join("src", "lib", "incorporacao", "mercado-anuncios.ts")];
    const marcas = ["anthropic-painel", "anthropic_painel", "CHAVE_SEGREDO_ANTHROPIC_PAINEL", "CHAVE_MODELO_ANTHROPIC_PAINEL"];
    const usam: string[] = [], erradas: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = path.join(dir, nome);
        if (statSync(p).isDirectory()) { if (!["node_modules", "generated", "__tests__"].includes(nome)) varrer(p); continue; }
        if (!/\.(ts|tsx|js|mjs|sql)$/.test(p) || /\.(test|spec)\.tsx?$/.test(p)) continue;
        const rel = path.relative(raiz, p);
        const texto = readFileSync(p, "utf8");
        const tipo = permitidos[rel];
        if (tipo === "painel") continue;
        if (tipo === "modelos") { erradas.push(...[...problemasDoModuloDeModelos(texto), ...importsErradosDoModuloDeModelos(texto)].map((x) => `${rel} (${x})`)); continue; }
        if (tipo === "tela") { if (marcas.some((m) => texto.includes(m)) || /@\/lib\/ia\/anthropic-painel|@\/lib\/segredo/.test(texto)) erradas.push(`${rel} (tela importa o painel/cofre)`); continue; }
        if (tipo === "acoes") {
          if (texto.includes("CHAVE_SEGREDO_ANTHROPIC_PAINEL") || texto.includes("anthropic_painel_api_key")) erradas.push(`${rel} (cita a chave)`);
          continue;
        }
        if (marcas.some((m) => texto.includes(m))) usam.push(rel);
        const imp = Array.from(texto.matchAll(/import \{([^}]*)\} from "@\/lib\/ia\/modelo-por-funcao";/g));
        const citaModelos = /(?:from|import\s*\()\s*["'`]@\/lib\/ia\/modelo-por-funcao["'`]/.test(texto);
        if (citaModelos && !consumidoresDeModelos.includes(rel)) erradas.push(`${rel} (importa o módulo de modelos)`);
        if (consumidoresDeModelos.includes(rel)) {
          const nomes = imp.flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
          if (imp.length !== 1 || nomes.join() !== "modeloDaFuncao") erradas.push(`${rel}: ${nomes.join(", ")}`);
        }
      }
    };
    varrer(path.join(raiz, "src"));
    expect(usam).toEqual([]);
    expect(erradas).toEqual([]);
    // As duas funções continuam com a chave DELAS (nunca a do painel): a Central usa a chave própria ou
    // ANTHROPIC_API_KEY; o Mercado, só ANTHROPIC_API_KEY.
    expect(ler("src/lib/central-vendas/ia.ts")).toMatch(/const chave = segredo\(config, "chaveAnthropic"\) \|\| process\.env\.ANTHROPIC_API_KEY;/);
    expect(ler("src/lib/incorporacao/mercado-config.ts")).toMatch(/anthropicApiKey: process\.env\.ANTHROPIC_API_KEY \?\? "",/);
    expect(ler("src/lib/incorporacao/segredos-mercado.ts")).not.toMatch(/anthropic/i);
  });

  it("nas ações, só as do painel Anthropic usam as funções do painel", () => {
    const fonte = ler("src/lib/actions/integracoes.ts");
    const imp = /import \{([^}]*)\} from "@\/lib\/ia\/anthropic-painel";/.exec(fonte)!;
    const funcoes = imp[1].split(",").map((x) => x.trim()).filter((x) => x && !x.startsWith("type "));
    const corpo = fonte.replace(imp[0], "");
    const inicios = Array.from(corpo.matchAll(/^(?:(?:export )?async function (\w+)|const (\w+) =)/gm)).map((m) => ({ 1: m[1] ?? m[2], index: m.index })).map((m) => ({ nome: m[1], em: m.index! }));
    const usos: string[] = [];
    for (const f of funcoes) for (const m of corpo.matchAll(new RegExp(`\\b${f}\\b`, "g"))) usos.push(inicios.filter((i) => i.em < m.index!).pop()?.nome ?? "(fora de função)");
    const permitidas = new Set(["motivoAnthropic", "statusAnthropicAcao", "testarAnthropicAcao", "salvarAnthropicAcao", "removerAnthropicAcao", "modelosAnthropicAcao",
      "salvarModeloAnthropicAcao", "modelosPorFuncaoAnthropicAcao", "salvarModeloFuncaoAnthropicAcao"]);
    expect(usos.length).toBeGreaterThan(0);
    expect(usos.filter((u) => !permitidas.has(u))).toEqual([]);
  });
});

describe("ligações: a função usa o modelo escolhido, com a variável de ambiente na frente", () => {
  it("Mercado: INCORPORACAO_IA_MODELO → função → preferencial → padrão; banco fora do ar = padrão", async () => {
    const db = await import("@/lib/db");
    const valores = new Map<string, string>();
    const espiao = vi.spyOn(db.prisma.configuracao, "findUnique").mockImplementation((async (a: { where: { chave: string } }) => (valores.has(a.where.chave) ? { valor: valores.get(a.where.chave)! } : null)) as never);
    const { modeloMercadoAnuncios } = await import("@/lib/incorporacao/mercado-anuncios");
    const antes = process.env.INCORPORACAO_IA_MODELO;
    try {
      delete process.env.INCORPORACAO_IA_MODELO;
      expect(await modeloMercadoAnuncios()).toMatch(/^claude-/); // padrão de sempre (MERCADO_ENV)
      valores.set(CHAVE_MODELO_PREFERENCIAL, "claude-preferido");
      expect(await modeloMercadoAnuncios()).toBe("claude-preferido");
      valores.set(chaveModeloDaFuncao("incorporacao_mercado"), "claude-do-mercado");
      expect(await modeloMercadoAnuncios()).toBe("claude-do-mercado");
      process.env.INCORPORACAO_IA_MODELO = "claude-do-servidor";
      expect(await modeloMercadoAnuncios()).toBe("claude-do-servidor");
      delete process.env.INCORPORACAO_IA_MODELO;
      espiao.mockRejectedValue(new Error("banco fora"));
      expect(await modeloMercadoAnuncios()).toMatch(/^claude-/);
    } finally {
      espiao.mockRestore();
      if (antes === undefined) delete process.env.INCORPORACAO_IA_MODELO; else process.env.INCORPORACAO_IA_MODELO = antes;
    }
  });
});
