import { beforeEach, describe, expect, it, vi } from "vitest";

// Revisão do Codex no PR #180 — as rotas de API seguem a mesma permissão por
// módulo das telas e actions (item 06): colaborador com o módulo liberado
// acessa; sem o módulo, empreiteiro, cliente ou conta inativa, não.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  documento: vi.fn(),
  obra: vi.fn(),
  lead: vi.fn(),
  conexao: vi.fn(),
  usuarioAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  prisma: {
    estudoDocumentoRegistro: { findUnique: mocks.documento },
    obra: { findUnique: mocks.obra },
    lead: { findMany: mocks.lead },
    conexaoWhatsApp: { findUnique: mocks.conexao },
    usuario: { findFirst: mocks.usuarioAdmin },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/incorporacao/registro-drive", () => ({ lerDocumentoRegistro: vi.fn() }));

import { GET as baixarDocumento } from "@/app/api/incorporacao/documentos/[documentoId]/route";
import { POST as enviarFoto } from "@/app/api/obras/[id]/fotos/route";
import { POST as enviarWhatsapp } from "@/app/api/whatsapp/enviar/route";

const sessao = (role: string, extra: Record<string, unknown> = {}) =>
  mocks.auth.mockResolvedValue({ user: { id: "u1", role, ...extra } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.documento.mockResolvedValue({ ativo: true, driveFileId: null, mime: "application/pdf", nome: "a.pdf", arquivo: { dados: Buffer.from("PDF") } });
  mocks.obra.mockResolvedValue(null);
  mocks.lead.mockResolvedValue([]);
});

describe("documento do registro da incorporação", () => {
  const chamar = () => baixarDocumento(new Request("http://x"), { params: Promise.resolve({ documentoId: "d1" }) });

  it("colaborador com o módulo Incorporação baixa o documento", async () => {
    sessao("colaborador", { permissoes: ["incorporacao"] });
    const r = await chamar();
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe("PDF");
  });

  it("sem o módulo, corretor, empreiteiro ou conta inativa: recusado", async () => {
    sessao("colaborador", { permissoes: ["obras"] });
    expect((await chamar()).status).toBe(403);
    sessao("corretor");
    expect((await chamar()).status).toBe(403);
    sessao("empreiteiro");
    expect((await chamar()).status).toBe(403);
    sessao("admin", { ativo: false });
    expect((await chamar()).status).toBe(401);
    mocks.auth.mockResolvedValue(null);
    expect((await chamar()).status).toBe(401);
  });
});

describe("envio de foto da obra", () => {
  const chamar = () => enviarFoto(
    new Request("http://x", { method: "POST", body: JSON.stringify({}) }) as never,
    { params: Promise.resolve({ id: "o1" }) },
  );

  it("colaborador com o módulo Obras passa da permissão (cai na validação da imagem)", async () => {
    sessao("colaborador", { permissoes: ["obras"] });
    expect((await chamar()).status).toBe(400);
  });

  it("sem o módulo Obras: 403", async () => {
    sessao("colaborador", { permissoes: ["leads"] });
    expect((await chamar()).status).toBe(403);
    sessao("corretor");
    expect((await chamar()).status).toBe(403);
  });
});

describe("envio de WhatsApp", () => {
  const chamar = () => enviarWhatsapp(new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ mensagem: "oi", destinatarios: [{ id: "1", nome: "X", telefone: "999", leadId: "l1" }] }),
  }) as never);

  it("empreiteiro, cliente e colaborador sem o módulo WhatsApp são recusados", async () => {
    for (const [role, extra] of [["empreiteiro", {}], ["cliente", {}], ["colaborador", { permissoes: ["obras"] }]] as const) {
      sessao(role, extra);
      expect((await chamar()).status).toBe(403);
    }
    expect(mocks.lead).not.toHaveBeenCalled();
  });

  it("corretor sem cadastro de corretor ativo é recusado", async () => {
    sessao("corretor");
    expect((await chamar()).status).toBe(403);
  });

  it("colaborador com o módulo segue para a validação dos destinatários", async () => {
    sessao("colaborador", { permissoes: ["whatsapp"] });
    expect((await chamar()).status).toBe(400);
    expect(mocks.lead).toHaveBeenCalled();
  });
});
