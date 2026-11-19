// Paridade 17/11 (bloco 2) — porte de Prospecta `server/incorporacao-proposta-terreno.test.ts` (EPIC-024 S-06).
// Dados FICTÍCIOS. Lá: tRPC + PGlite; aqui: gerador do PDF puro, migração com PGlite e as funções do servidor com o
// prisma simulado em memória. Nenhum e-mail real: o envio é injetado (falso). Diferenças de identidade: cabeçalho
// "GRUPO SANTA FÉ" e autor "grupo_santa_fe"; o Santa Fé não tem email_logs (o registro fica na tabela de envios).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gerarPdfPropostaTerreno, secoesPropostaTerreno, type DadosPropostaTerreno } from "@/lib/incorporacao/proposta-terreno-pdf";
import { parseNegociacao, type Proposta } from "@/lib/incorporacao/negociacao";

const PROPOSTA: Proposta = {
  id: "prop-1", data: "2026-11-10", autor: "grupo_santa_fe", tipo: "compra_parcelada", valorTotal: 1_500_000, entradaPct: 20,
  prazoParcelamentoMeses: 24, condicoes: "Escritura em até 60 dias após a aprovação.", status: "enviada",
};
const BASE: DadosPropostaTerreno = {
  empreendimento: { nome: "Residencial Exemplo", cidade: "Cidade Teste", uf: "PA", endereco: "Rua Fictícia, 100", tipo: "vertical" },
  terreno: { areaM2: 12_000, matricula: "MAT-0001" },
  proprietario: { nome: "Proprietário Fictício", contato: "(00) 0000-0000", email: "dono@exemplo.test" },
  proposta: PROPOSTA,
  proponente: { empresa: "Grupo Santa Fé", responsavel: "Usuária Teste" },
  dataEmissao: "2026-11-16",
};
/** Textos desenhados no PDF (operandos de Tj, sem os escapes de parênteses). */
const textoDoPdf = (b: Uint8Array) => Array.from(Buffer.from(b).toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g), (m) => m[1].replace(/\\([()\\])/g, "$1")).join("\n");

describe("conteúdo do PDF — só o que está registrado", () => {
  it("traz cada campo registrado", () => {
    const pdf = textoDoPdf(gerarPdfPropostaTerreno(BASE));
    for (const t of ["GRUPO SANTA F", "PROPOSTA DE AQUISIÇÃO DE TERRENO", "Residencial Exemplo", "Vertical", "Cidade Teste/PA", "Proprietário Fictício",
      "(00) 0000-0000", "dono@exemplo.test", "Rua Fictícia, 100", "12.000 m²", "1,2 ha", "MAT-0001", "Compra parcelada", "10/11/2026",
      "R$ 1.500.000,00", "20% do valor proposto", "24 meses", "Escritura em até 60 dias", "Emitida em 16/11/2026", "Usuária Teste", "De acordo"]) {
      expect(pdf, t).toContain(t);
    }
  });

  it("campos vazios são omitidos, sem marcador nem valor inventado", () => {
    const minimo: DadosPropostaTerreno = {
      ...BASE, empreendimento: { nome: "Gleba Mínima" }, terreno: {}, proprietario: {},
      proposta: { id: "p", data: "2026-11-01", autor: "grupo_santa_fe", tipo: "compra_avista", valorTotal: 0, status: "enviada" },
      proponente: { empresa: "Grupo Santa Fé" },
    };
    const secoes = secoesPropostaTerreno(minimo);
    expect(secoes.map((s) => s.titulo)).toEqual(["Empreendimento", "Proposta", "Proponente"]);
    expect(secoes.find((s) => s.titulo === "Proposta")!.linhas).toEqual([["Modalidade", "Compra à vista"], ["Data da proposta", "01/11/2026"]]);
    const pdf = textoDoPdf(gerarPdfPropostaTerreno(minimo));
    for (const ausente of ["Valor proposto", "Entrada", "Prazo de parcelamento", "Matrícula", "E-mail", "undefined", "null", "NaN", "R$ 0,00", "Responsável", "Permuta ("])
      expect(pdf, ausente).not.toContain(ausente);
  });

  it("permuta financeira mostra o percentual registrado, não um valor calculado", () => {
    const s = secoesPropostaTerreno({ ...BASE, proposta: { ...PROPOSTA, tipo: "permuta_financeira", valorTotal: undefined, entradaPct: undefined, prazoParcelamentoMeses: undefined, permutaPctVgv: 12.5 } });
    expect(s.find((x) => x.titulo === "Proposta")!.linhas).toContainEqual(["Permuta (percentual do VGV)", "12,5%"]);
    expect(JSON.stringify(s)).not.toContain("R$");
  });

  it("mesma entrada → mesmos bytes (data de criação e identificador fixos)", async () => {
    const a = gerarPdfPropostaTerreno(BASE);
    await new Promise((r) => setTimeout(r, 1100));
    expect(Buffer.from(gerarPdfPropostaTerreno(BASE)).equals(Buffer.from(a))).toBe(true);
    expect(Buffer.from(gerarPdfPropostaTerreno({ ...BASE, dataEmissao: "2026-11-15" })).equals(Buffer.from(a))).toBe(false);
  });
});

// ─── servidor com prisma simulado ─────────────────────────────────────────────
let gravado = "";
const envios: Record<string, unknown>[] = [];
let logo: { exibicaoPng: Uint8Array; exibicaoSha256: string; sha256: string; mime: string; nome: string } | null = null;
let seq = 0;
vi.mock("@/lib/db", () => ({
  prisma: {
    estudoIncorporacao: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => where.id !== "e1" ? null : ({
        nome: "Residencial Exemplo", municipio: "Cidade Teste", estado: "PA", endereco: "Rua Fictícia, 100", tipoIncorporacao: "vertical",
        areaM2: 12_000, matriculaImovel: "MAT-0001", negociacaoTerrenoJson: gravado,
      })),
    },
    estudoLogotipo: { findFirst: vi.fn(async () => logo) },
    estudoPropostaEnvio: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const e = { ...data, id: `env${++seq}`, criadoEm: new Date(Date.now() + seq) }; envios.push(e); return e; }),
      findMany: vi.fn(async ({ where }: { where: { estudoId: string } }) => envios.filter((e) => e.estudoId === where.estudoId).sort((a, b) => (b.criadoEm as Date).getTime() - (a.criadoEm as Date).getTime())),
    },
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => { throw new Error("e-mail real não pode ser chamado no teste"); }) }));

describe("migração 20261117230000_proposta_terreno_envios", () => {
  it("aditiva e idempotente, com RLS; só 'enviado'/'falhou'; sai junto com o estudo", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(`CREATE TABLE "estudos_incorporacao" (id text PRIMARY KEY); INSERT INTO "estudos_incorporacao" VALUES ('e1');`);
      const sql = readFileSync("prisma/migrations/20261117230000_proposta_terreno_envios/migration.sql", "utf8");
      await pg.exec(sql);
      await pg.exec(sql);
      expect((await pg.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'estudos_incorporacao_propostas_envios'`)).rows).toEqual([{ relrowsecurity: true }]);
      const ins = (id: string, status: string, data = "2026-11-17") => pg.exec(`INSERT INTO estudos_incorporacao_propostas_envios (id, "estudoId", "propostaId", destinatario, status, "dataEmissao", "pdfSha256") VALUES ('${id}', 'e1', 'p', 'a@b.co', '${status}', '${data}', 'x')`);
      await ins("a", "enviado");
      await expect(ins("b", "aceita")).rejects.toThrow();
      await expect(ins("c", "falhou", "17/11/2026")).rejects.toThrow();
      await pg.exec(`DELETE FROM "estudos_incorporacao"`);
      expect((await pg.query(`SELECT count(*)::int n FROM estudos_incorporacao_propostas_envios`)).rows).toEqual([{ n: 0 }]);
    } finally { await pg.close(); }
  });
});

describe("PDF e envio (servidor)", () => {
  const usuario = { id: "u1", nome: "Usuária Teste" };
  beforeEach(() => {
    gravado = JSON.stringify({ proprietarioNome: "Proprietário Fictício", proprietarioContato: "(00) 0000-0000", proprietarioEmail: "dono@exemplo.test",
      propostas: [PROPOSTA, { ...PROPOSTA, id: "prop-2", autor: "proprietario", status: "contraproposta" }] });
    logo = null;
  });

  it("o PDF baixado é byte a byte o anexo do e-mail; enviar não aceita a proposta", async () => {
    const { pdfDaPropostaTerreno, enviarPropostaTerrenoPorEmail, hojeBrasil } = await import("@/lib/incorporacao/proposta-terreno");
    const baixado = await pdfDaPropostaTerreno("e1", "prop-1", usuario);
    expect(baixado.dataEmissao).toBe(hojeBrasil());
    const enviar = vi.fn(async () => true);
    const r = await enviarPropostaTerrenoPorEmail("e1", "prop-1", " Dono@Exemplo.test ", usuario, baixado.dataEmissao, enviar);
    expect(r.ok).toBe(true);
    const mensagem = (enviar.mock.calls[0] as unknown as [{ to: string; attachments: { content: Buffer; filename: string }[] }])[0];
    expect(mensagem.to).toBe("dono@exemplo.test");
    expect(mensagem.attachments[0].content.equals(Buffer.from(baixado.base64, "base64"))).toBe(true);
    expect(mensagem.attachments[0].filename).toBe(baixado.nomeArquivo);
    expect(r.envio).toMatchObject({ status: "enviado", destinatario: "dono@exemplo.test", pdfSha256: baixado.sha256, dataEmissao: hojeBrasil(), enviadoPorNome: "Usuária Teste" });
    expect(parseNegociacao(gravado)!.propostas.find((p) => p.id === "prop-1")!.status).toBe("enviada");
  });

  it("os envios ficam fora do JSON da negociação (salvar a aba não os apaga)", async () => {
    const { enviosDasPropostasTerreno } = await import("@/lib/incorporacao/proposta-terreno");
    const antes = await enviosDasPropostasTerreno("e1");
    expect(antes.length).toBeGreaterThan(0);
    gravado = JSON.stringify({ proprietarioNome: "Proprietário Fictício", proprietarioContato: "", propostas: [PROPOSTA] }); // a aba regravou
    expect(await enviosDasPropostasTerreno("e1")).toEqual(antes);
  });

  it("falha fica registrada com o motivo e o reenvio funciona", async () => {
    const { enviarPropostaTerrenoPorEmail, enviosDasPropostasTerreno, hojeBrasil } = await import("@/lib/incorporacao/proposta-terreno");
    const falhou = await enviarPropostaTerrenoPorEmail("e1", "prop-1", "dono@exemplo.test", usuario, hojeBrasil(), vi.fn(async () => false));
    expect(falhou.ok).toBe(false);
    expect(falhou.envio.status).toBe("falhou");
    expect(falhou.motivo).toBeTruthy();
    const reenvio = await enviarPropostaTerrenoPorEmail("e1", "prop-1", "dono@exemplo.test", usuario, hojeBrasil(), vi.fn(async () => true));
    expect(reenvio.ok).toBe(true);
    const lista = await enviosDasPropostasTerreno("e1");
    expect(lista.slice(0, 2).map((e) => e.status)).toEqual(["enviado", "falhou"]);
    expect(parseNegociacao(gravado)!.propostas.find((p) => p.id === "prop-1")!.status).toBe("enviada");
  });

  it("valida destinatário, data de emissão, autor da proposta e proposta inexistente", async () => {
    const { pdfDaPropostaTerreno, enviarPropostaTerrenoPorEmail, hojeBrasil } = await import("@/lib/incorporacao/proposta-terreno");
    const nunca = vi.fn(async () => true);
    await expect(enviarPropostaTerrenoPorEmail("e1", "prop-1", "nao-e-email", usuario, hojeBrasil(), nunca)).rejects.toThrow(/inválido/);
    await expect(pdfDaPropostaTerreno("e1", "prop-1", usuario, "2099-01-01")).rejects.toThrow(/Data de emissão/);
    await expect(pdfDaPropostaTerreno("e1", "prop-2", usuario)).rejects.toThrow(/do proprietário/);
    await expect(pdfDaPropostaTerreno("e1", "nao-existe", usuario)).rejects.toThrow(/não encontrada/);
    await expect(pdfDaPropostaTerreno("e9", "prop-1", usuario)).rejects.toThrow(/Estudo não encontrado/);
    expect(nunca).not.toHaveBeenCalled();
  });

  it("sem o módulo Incorporação, as ações recusam (erro como dado) e nada é enviado", async () => {
    vi.doMock("@/lib/auth/modulos", () => ({ exigirModuloAcao: vi.fn(async () => { throw new Error("Sem permissão para este módulo."); }) }));
    vi.resetModules();
    const acoes = await import("@/lib/actions/proposta-terreno");
    expect(await acoes.pdfPropostaTerreno("e1", "prop-1")).toEqual({ erroAcao: "Sem permissão para este módulo." });
    expect(await acoes.enviarPropostaTerreno("e1", "prop-1", "dono@exemplo.test", "2026-11-17")).toEqual({ erroAcao: "Sem permissão para este módulo." });
    await expect(acoes.enviosPropostaTerreno("e1")).rejects.toThrow(/permissão/i);
    vi.doUnmock("@/lib/auth/modulos");
  });

  it("usa o logotipo do empreendimento (S-02) no cabeçalho quando existe; PNG inválido fica de fora", async () => {
    const { pdfDaPropostaTerreno } = await import("@/lib/incorporacao/proposta-terreno");
    const sem = await pdfDaPropostaTerreno("e1", "prop-1", usuario);
    expect(Buffer.from(sem.base64, "base64").toString("latin1")).not.toContain("/Subtype /Image");
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636460f85f0f0002870180eb47ba920000000049454e44ae426082", "hex");
    logo = { exibicaoPng: png, exibicaoSha256: "y", sha256: "x", mime: "image/png", nome: "l.png" };
    const com = await pdfDaPropostaTerreno("e1", "prop-1", usuario);
    expect(Buffer.from(com.base64, "base64").toString("latin1")).toContain("/Subtype /Image");
    logo = { ...logo, exibicaoPng: png.subarray(0, 9) };
    const invalido = await pdfDaPropostaTerreno("e1", "prop-1", usuario);
    expect(Buffer.from(invalido.base64, "base64").toString("latin1")).not.toContain("/Subtype /Image");
  });
});
