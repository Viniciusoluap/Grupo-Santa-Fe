// Paridade com a Prospecta (11/11): anexos da Due Diligence/registro de qualquer tipo (foto, DWG,
// Word...), até 50 MB, enviados em partes de 2 MiB; setas para mover tarefas e documentos.
// Banco simulado em memória (sem TEST_DATABASE_URL) + migração conferida em PGlite.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { anexoVisualizavel, mimeDoAnexo, nomeAnexoSeguro, PARTE_ANEXO_BYTES, partesDoAnexo } from "@/lib/incorporacao/anexos";
import { mimeConferidoRegistro } from "@/lib/incorporacao/registro-documento-validacao";
import { moverItem } from "@/lib/incorporacao/due-diligence";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "admin" } }) }));

const ETAPA = "11111111-1111-4111-8111-111111111111", DOC = "22222222-2222-4222-8222-222222222222";
const ITEM = `dd_${ETAPA}_${DOC}`;
const DD = JSON.stringify({ versao: 1, etapas: [{ id: ETAPA, nome: "Etapa", procedimentos: "", observacoes: "", tarefas: [], documentos: [{ id: DOC, nome: "Planta", obtido: false }] }] });

// ── banco em memória (só o que as ações usam) ──
const db = vi.hoisted(() => ({
  partes: new Map<string, { uploadId: string; parte: number; estudoId: string; itemId: string; usuarioId: string; dados: Buffer; criadoEm: Date }>(),
  docs: [] as { id: string; estudoId: string; itemId: string; nome: string; mime: string; tamanho: number; sha256: string; ativo: boolean; armazenamento?: string; arquivoId?: string; enviadoEm: Date }[],
  arquivos: new Map<string, Buffer>(),
}));
vi.mock("@/lib/incorporacao/registro-drive", () => ({
  diagnosticarDrive: vi.fn(), driveRegistroConfigurado: async () => false,
  hashDocumento: (b: Buffer) => `h${b.length}-${b[0] ?? 0}-${b[b.length - 1] ?? 0}`,
  tentarUploadDrive: async () => ({ fileId: null, nota: null }), uploadDocumentoRegistro: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const chave = (w: { uploadId: string; parte: number }) => `${w.uploadId}#${w.parte}`;
  const estudoDocumentoRegistro = {
    findMany: async ({ where }: { where: { estudoId: string } }) => db.docs.filter((d) => d.estudoId === where.estudoId && d.ativo)
      .map((d) => ({ ...d, enviadoPorId: "u1", notaArmazenamento: null })),
    findFirst: async ({ where }: { where: { estudoId: string; itemId: string } }) => db.docs.find((d) => d.estudoId === where.estudoId && d.itemId === where.itemId && d.ativo) ?? null,
    updateMany: async ({ where }: { where: { estudoId: string; itemId: string } }) => { db.docs.forEach((d) => { if (d.estudoId === where.estudoId && d.itemId === where.itemId) d.ativo = false; }); return { count: 1 }; },
    create: async ({ data }: { data: (typeof db.docs)[number] }) => { db.docs.push({ ...data, id: `doc${db.docs.length + 1}`, ativo: true, enviadoEm: new Date() }); return {}; },
  };
  const arquivo = { create: async ({ data }: { data: { dados: Uint8Array } }) => { const id = `arq${db.arquivos.size + 1}`; db.arquivos.set(id, Buffer.from(data.dados)); return { id }; } };
  const prisma = {
    estudoIncorporacao: { findUnique: async () => ({ id: "e1", registroIncorporacaoJson: null, dueDiligenceJson: DD }) },
    estudoDocumentoRegistro, arquivo,
    estudoDocumentoParte: {
      deleteMany: async ({ where }: { where: { uploadId?: string; usuarioId?: string; criadoEm?: { lt: Date } } }) => {
        for (const [k, p] of db.partes) if ((where.criadoEm && p.criadoEm < where.criadoEm.lt) || (where.uploadId && p.uploadId === where.uploadId && p.usuarioId === where.usuarioId)) db.partes.delete(k);
        return { count: 0 };
      },
      findUnique: async ({ where }: { where: { uploadId_parte: { uploadId: string; parte: number } } }) => db.partes.get(chave(where.uploadId_parte)) ?? null,
      upsert: async ({ where, create, update }: { where: { uploadId_parte: { uploadId: string; parte: number } }; create: Omit<NonNullable<ReturnType<typeof db.partes.get>>, "criadoEm">; update: { dados: Buffer } }) => {
        const k = chave(where.uploadId_parte), atual = db.partes.get(k);
        db.partes.set(k, atual ? { ...atual, dados: update.dados, criadoEm: new Date() } : { ...create, criadoEm: new Date() });
        return {};
      },
      findMany: async ({ where }: { where: { uploadId: string; usuarioId: string; estudoId: string; itemId: string } }) => [...db.partes.values()]
        .filter((p) => p.uploadId === where.uploadId && p.usuarioId === where.usuarioId && p.estudoId === where.estudoId && p.itemId === where.itemId)
        .sort((a, b) => a.parte - b.parte),
      count: async ({ where }: { where: { uploadId: string } }) => [...db.partes.values()].filter((p) => p.uploadId === where.uploadId).length,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ $executeRaw: async () => 0, estudoDocumentoRegistro, arquivo }),
  };
  return { prisma };
});

describe("Tipos de anexo (mesma regra da Prospecta)", () => {
  it("tipo do navegador; sem ele (iPad), pela extensão; senão genérico", () => {
    expect(mimeDoAnexo("planta.dwg", "")).toBe("image/vnd.dwg");
    expect(mimeDoAnexo("Memorial.DOCX", "")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(mimeDoAnexo("IMG_0001.HEIC", "")).toBe("image/heic");
    expect(mimeDoAnexo("sem-extensao", "")).toBe("application/octet-stream");
  });
  it("só PDF/foto/texto abrem na aba; HTML/SVG nunca", () => {
    expect(anexoVisualizavel("application/pdf")).toBe(true);
    for (const m of ["text/html", "image/svg+xml", "image/vnd.dwg"]) expect(anexoVisualizavel(m)).toBe(false);
  });
  it("arquivo que diz ser PDF sem assinatura vira genérico; DWG passa", () => {
    expect(mimeConferidoRegistro("application/pdf", Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(mimeConferidoRegistro("application/pdf", Buffer.from("<html>"))).toBe("application/octet-stream");
    expect(mimeConferidoRegistro("image/vnd.dwg", Buffer.from("AC1032"))).toBe("image/vnd.dwg");
    expect(nomeAnexoSeguro("../a/b\u0000.dwg")).toBe(".._a_b_.dwg");
  });
});

describe("Due Diligence: mover tarefas e documentos", () => {
  it("move para cima/baixo e ignora fora dos limites", () => {
    expect(moverItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moverItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("Envio em partes (até 50 MB)", () => {
  beforeEach(() => { db.partes.clear(); db.docs.length = 0; db.arquivos.clear(); });
  const envio = async (bytes: Buffer, nome: string, mime: string, uploadId = "envio-de-teste-0001") => {
    const acoes = await import("@/lib/actions/documentos-registro");
    for (let parte = 0; parte < partesDoAnexo(bytes.length); parte++) {
      const r = await acoes.enviarParteDocumentoRegistro("e1", ITEM, uploadId, parte, new File([new Uint8Array(bytes.subarray(parte * PARTE_ANEXO_BYTES, (parte + 1) * PARTE_ANEXO_BYTES))], "p"));
      expect(r).toEqual({ ok: true });
    }
    return acoes.finalizarDocumentoRegistro("e1", ITEM, uploadId, nome, mime, bytes.length);
  };

  it("DWG de 5 MiB em 3 partes chega íntegro no banco, com o nome e o tipo", async () => {
    const dwg = Buffer.alloc(5 * 1024 * 1024 + 123);
    for (let i = 0; i < dwg.length; i++) dwg[i] = (i * 31 + 7) % 256;
    const r = await envio(dwg, "Planta baixa.dwg", "image/vnd.dwg");
    expect(r).toMatchObject({ armazenamento: "banco" });
    expect(db.docs).toHaveLength(1);
    expect(db.docs[0]).toMatchObject({ nome: "Planta baixa.dwg", mime: "image/vnd.dwg", tamanho: dwg.length, armazenamento: "banco" });
    expect(db.arquivos.get(db.docs[0].arquivoId!)!.equals(dwg)).toBe(true);
    expect(db.partes.size).toBe(0); // área temporária limpa
  });

  it("recusa envio incompleto e parte de tamanho inválido", async () => {
    const acoes = await import("@/lib/actions/documentos-registro");
    await acoes.enviarParteDocumentoRegistro("e1", ITEM, "envio-incompleto-01", 0, new File([new Uint8Array(PARTE_ANEXO_BYTES).fill(1)], "p"));
    expect(await acoes.finalizarDocumentoRegistro("e1", ITEM, "envio-incompleto-01", "a.zip", "application/zip", PARTE_ANEXO_BYTES + 10))
      .toMatchObject({ erroAcao: expect.stringMatching(/incompleto/) });
    expect(await acoes.enviarParteDocumentoRegistro("e1", ITEM, "envio-grande-00001", 0, new File([new Uint8Array(PARTE_ANEXO_BYTES + 1)], "p")))
      .toMatchObject({ erroAcao: expect.stringMatching(/inválida/) });
    expect(await acoes.enviarParteDocumentoRegistro("e1", `dd_${ETAPA}_33333333-3333-4333-8333-333333333333`, "envio-item-errado-1", 0, new File(["x"], "p")))
      .toMatchObject({ erroAcao: expect.stringMatching(/inválido/) });
  });

  it("envio direto (até 3 MB) também aceita qualquer tipo, como Word", async () => {
    const acoes = await import("@/lib/actions/documentos-registro");
    const r = await acoes.enviarDocumentoRegistro("e1", ITEM, new File([new TextEncoder().encode("PK\u0003\u0004 word")], "Memorial.docx", { type: "" }));
    expect(r).toMatchObject({ armazenamento: "banco" });
    expect(db.docs[0].mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
});

describe("Migração das partes", () => {
  it("cria a tabela temporária, idempotente, sem mexer em nada existente", async () => {
    const pg = new PGlite();
    const sql = readFileSync(new URL("../../../prisma/migrations/20261111180000_anexos_em_partes/migration.sql", import.meta.url), "utf8");
    await pg.exec(sql); await pg.exec(sql);
    await pg.query(`INSERT INTO estudo_documento_partes ("uploadId", parte, "estudoId", "itemId", "usuarioId", dados) VALUES ('u', 0, 'e', 'i', 'x', '\\x00')`);
    expect((await pg.query("SELECT count(*)::int AS n FROM estudo_documento_partes")).rows[0]).toEqual({ n: 1 });
  });
});
