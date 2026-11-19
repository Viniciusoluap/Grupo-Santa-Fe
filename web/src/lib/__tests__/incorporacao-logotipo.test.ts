// Paridade 17/11 (bloco 2) — porte de Prospecta `server/incorporacao-logotipo.test.ts` (EPIC-024 S-02).
// Lá: tRPC + PGlite + express. Aqui: migração conferida com PGlite; regras do envio/troca/exclusão com o prisma e a
// tabela de partes simulados em memória; rotas Next chamadas direto. Os casos de IA não foram portados (o Santa Fé
// não tem gerador de imagem); PDF é reconhecido, mas recusado no envio (diferença registrada no HANDOFF).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tipoDoLogo } from "@/lib/incorporacao/logotipo";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3e8d5b30000000049454e44ae426082", "hex");
const PNG_B = Buffer.concat([PNG, Buffer.from("estudo-b")]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF");
const SVG = Buffer.from('﻿<?xml version="1.0"?>\n<!-- logo --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4"/></svg>');

type Linha = { id: string; estudoId: string; mime: string; nome: string; origem: string; sha256: string; tamanho: number; original: Uint8Array; exibicaoPng: Uint8Array; exibicaoSha256: string; largura: number | null; altura: number | null; enviadoPorId: string | null; criadoEm: Date; excluidoEm: Date | null };
const tabela: Linha[] = [];
const partes = new Map<string, { nome: string; bytes: Buffer }>();
let modulos = ["incorporacao"];
let seq = 0;

const filtra = (w: { estudoId?: string; excluidoEm?: null }) => tabela.filter((l) => (w.estudoId === undefined || l.estudoId === w.estudoId) && (w.excluidoEm !== null || l.excluidoEm === null));
const ultimo = (ls: Linha[]) => [...ls].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime() || b.id.localeCompare(a.id))[0] ?? null;
const proj = (l: Linha | null, sel: Record<string, boolean>) => l && Object.fromEntries(Object.entries(sel).filter(([, v]) => v).map(([k]) => [k, (l as never)[k]]));
const estudoLogotipo = {
  findFirst: vi.fn(async ({ where, select }: { where: { estudoId: string; excluidoEm: null }; select: Record<string, boolean> }) => proj(ultimo(filtra(where)), select)),
  findMany: vi.fn(async ({ where, select }: { where: { excluidoEm: null }; select: Record<string, boolean> }) => filtra(where).map((l) => proj(l, select))),
  updateMany: vi.fn(async ({ where, data }: { where: { estudoId: string; excluidoEm: null }; data: Partial<Linha> }) => { const ls = filtra(where); ls.forEach((l) => Object.assign(l, data)); return { count: ls.length }; }),
  create: vi.fn(async ({ data }: { data: Omit<Linha, "id" | "criadoEm" | "excluidoEm"> }) => { const l = { ...data, id: `l${String(++seq).padStart(4, "0")}`, criadoEm: new Date(Date.now() + seq), excluidoEm: null }; tabela.push(l); return l; }),
};
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: vi.fn(async (m: string) => { if (!modulos.includes(m)) throw new Error("Sem permissão para este módulo."); return { id: "u1" }; }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    estudoLogotipo,
    estudoIncorporacao: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "e1" || where.id === "e2" ? { id: where.id } : null)) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ estudoLogotipo, $queryRaw: vi.fn(async () => [{ travado: 1 }]) })),
  },
}));
vi.mock("@/lib/documentos-upload-partes", () => ({
  guardarParte: vi.fn(async (e: { uploadId: string; nome: string; chunk: string }) => { partes.set(e.uploadId, { nome: e.nome, bytes: Buffer.from(e.chunk, "base64") }); }),
  montarPartes: vi.fn(async (uploadId: string) => { const p = partes.get(uploadId); if (!p) throw new Error("Envio incompleto. Tente novamente."); return p; }),
  limparPartes: vi.fn(async (uploadId: string) => { partes.delete(uploadId); }),
}));

let envio = 0;
async function enviar(estudoId: string, dados: Buffer, nome: string, exibicao = PNG) {
  const { enviarParteLogotipo, salvarLogotipo } = await import("@/lib/actions/logotipo-incorporacao");
  const uploadId = `logo-teste-${String(++envio).padStart(12, "0")}`;
  await enviarParteLogotipo(estudoId, uploadId, 0, 1, nome, new Blob([new Uint8Array(dados)]));
  const r = await salvarLogotipo(estudoId, { uploadId, nome, exibicaoBase64: exibicao.toString("base64"), largura: 100, altura: 50 });
  if (!r.ok) throw new Error(r.erro);
  return r.logo;
}

describe("migração 20261117220000_logotipo_empreendimento", () => {
  it("aditiva e idempotente, com RLS; o logotipo sai junto com a exclusão do estudo; só tipos aceitos", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(`CREATE TABLE "estudos_incorporacao" (id text PRIMARY KEY, nome text); INSERT INTO "estudos_incorporacao" VALUES ('e1', 'A'), ('e2', 'B');`);
      const sql = readFileSync("prisma/migrations/20261117220000_logotipo_empreendimento/migration.sql", "utf8");
      await pg.exec(sql);
      await pg.exec(sql);
      expect((await pg.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'estudos_incorporacao_logos'`)).rows).toEqual([{ relrowsecurity: true }]);
      const ins = (id: string, estudo: string, mime = "image/png") => pg.exec(`INSERT INTO estudos_incorporacao_logos (id, "estudoId", mime, nome, sha256, tamanho, original, "exibicaoPng", "exibicaoSha256") VALUES ('${id}', '${estudo}', '${mime}', 'l.png', 'x', 1, '\\x01', '\\x01', 'y')`);
      await ins("a", "e1");
      await ins("b", "e2");
      await expect(ins("c", "e1", "image/gif")).rejects.toThrow();
      await pg.exec(`DELETE FROM "estudos_incorporacao" WHERE id = 'e1'`);
      expect((await pg.query(`SELECT id FROM estudos_incorporacao_logos`)).rows).toEqual([{ id: "b" }]);
      expect((await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'estudos_incorporacao' ORDER BY 1`)).rows).toEqual([{ column_name: "id" }, { column_name: "nome" }]);
    } finally { await pg.close(); }
  });
});

describe("tipo pelo conteúdo", () => {
  it("reconhece PNG, JPG, PDF e SVG pelos bytes e recusa o resto", () => {
    expect(tipoDoLogo(PNG)).toBe("image/png");
    expect(tipoDoLogo(JPG)).toBe("image/jpeg");
    expect(tipoDoLogo(PDF)).toBe("application/pdf");
    expect(tipoDoLogo(SVG)).toBe("image/svg+xml");
    expect(tipoDoLogo(Buffer.from("<html><svg></svg></html>"))).toBeNull();
    expect(tipoDoLogo(Buffer.from("GIF89a"))).toBeNull();
  });
});

describe("envio, troca e exclusão", () => {
  beforeEach(() => { modulos = ["incorporacao"]; });

  it("um logotipo por estudo; trocar marca o anterior; A nunca aparece em B", async () => {
    const { obterLogotipo } = await import("@/lib/actions/logotipo-incorporacao");
    const a1 = await enviar("e1", PNG, "logo.png");
    expect(a1).toMatchObject({ estudoId: "e1", mime: "image/png", origem: "envio", largura: 1, altura: 1 });
    expect(await obterLogotipo("e2")).toBeNull();
    const a2 = await enviar("e1", JPG, "Logo Final.jpg");
    expect(a2?.mime).toBe("image/jpeg");
    expect(a2?.id).not.toBe(a1?.id);
    expect(tabela.filter((l) => l.estudoId === "e1" && !l.excluidoEm)).toHaveLength(1);
    const b = await enviar("e2", SVG, "b.svg", PNG_B);
    expect(b?.mime).toBe("image/svg+xml");
    expect((await obterLogotipo("e1"))?.id).toBe(a2?.id);
    expect((await obterLogotipo("e2"))?.id).toBe(b?.id);
    expect(b?.versao).not.toBe(a2?.versao);
  });

  it("recusa conteúdo que não bate com o tipo, exibição que não é PNG, PDF (Santa Fé) e estudo inexistente", async () => {
    await expect(enviar("e1", Buffer.from("<html>oi</html>"), "falso.png")).rejects.toThrow(/PNG, JPG, SVG ou PDF/);
    await expect(enviar("e1", JPG, "logo.png")).rejects.toThrow(/não corresponde à extensão/);
    await expect(enviar("e1", PNG, "logo.png", JPG)).rejects.toThrow(/exibição/);
    await expect(enviar("e1", PDF, "logo.pdf")).rejects.toThrow(/PDF ainda não é aceito/);
    await expect(enviar("e99", PNG, "logo.png")).rejects.toThrow(/não encontrado/);
  });

  it("listagem: versões sem bytes", async () => {
    const { versoesDosLogos } = await import("@/lib/incorporacao/logotipo-db");
    const versoes = await versoesDosLogos();
    expect(versoes.map((v) => v.estudoId).sort()).toEqual(["e1", "e2"]);
    for (const v of versoes) expect(Object.keys(v).sort()).toEqual(["altura", "estudoId", "largura", "versao"]);
  });

  it("listagem não quebra sem a tabela (migração ainda não aplicada)", async () => {
    const { versoesDosLogos } = await import("@/lib/incorporacao/logotipo-db");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    estudoLogotipo.findMany.mockRejectedValueOnce(Object.assign(new Error("The table estudos_incorporacao_logos does not exist"), { code: "P2021" }));
    expect(await versoesDosLogos()).toEqual([]);
    aviso.mockRestore();
  });

  it("rota de imagem: só o PNG de exibição, com ETag; original como download; estudo sem logo = 404; sem módulo = 403", async () => {
    const { GET: imagem } = await import("@/app/api/incorporacao/logo/[id]/route");
    const { GET: original } = await import("@/app/api/incorporacao/logo/[id]/original/route");
    const { NextRequest } = await import("next/server");
    const pedir = (id: string, h: Record<string, string> = {}) => imagem(new NextRequest(`http://x/api/incorporacao/logo/${id}`, { headers: h }), { params: Promise.resolve({ id }) });
    const r = await pedir("e2");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await r.arrayBuffer()).equals(PNG_B)).toBe(true);
    const etag = r.headers.get("etag")!;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect((await pedir("e2", { "if-none-match": etag })).status).toBe(304);
    const o = await original(new Request("http://x"), { params: Promise.resolve({ id: "e2" }) });
    expect(o.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(Buffer.from(await o.arrayBuffer()).equals(SVG)).toBe(true);
    expect((await pedir("e3")).status).toBe(404);
    modulos = ["obras"];
    expect((await pedir("e1")).status).toBe(403);
  });

  it("excluir tira só o logotipo daquele estudo", async () => {
    const { excluirLogotipo, obterLogotipo } = await import("@/lib/actions/logotipo-incorporacao");
    await excluirLogotipo("e1");
    expect(await obterLogotipo("e1")).toBeNull();
    expect(await obterLogotipo("e2")).not.toBeNull();
  });

  it("portão de QA: PNG só com a assinatura é recusado; as medidas gravadas são as do próprio PNG", async () => {
    await expect(enviar("e1", PNG, "logo.png", Buffer.concat([PNG.subarray(0, 8), Buffer.from([0])]))).rejects.toThrow(/PNG válido/);
    const semIhdr = Buffer.from(PNG); semIhdr.write("XXXX", 12, "latin1");
    await expect(enviar("e1", PNG, "logo.png", semIhdr)).rejects.toThrow(/PNG válido/);
    const salvo = await enviar("e1", PNG, "logo.png"); // o teste declara 100 × 50; o PNG tem 1 × 1 — vale o PNG
    expect(salvo).toMatchObject({ largura: 1, altura: 1 });
  });

  it("sem o módulo Incorporação, nada passa", async () => {
    modulos = ["obras"];
    const { obterLogotipo, excluirLogotipo, salvarLogotipo } = await import("@/lib/actions/logotipo-incorporacao");
    await expect(obterLogotipo("e2")).rejects.toThrow(/permissão/i);
    await expect(excluirLogotipo("e2")).rejects.toThrow(/permissão/i);
    await expect(salvarLogotipo("e2", { uploadId: "x".repeat(20), nome: "a.png", exibicaoBase64: PNG.toString("base64"), largura: 1, altura: 1 })).rejects.toThrow(/permissão/i);
  });
});
