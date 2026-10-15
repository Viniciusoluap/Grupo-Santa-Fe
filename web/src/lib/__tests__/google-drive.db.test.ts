// Pedido A5 (opção A) — Google Drive com a conta Google do dono (OAuth).
// Mesmos cenários de .tmp-test/google-drive-oauth.test.ts da Prospecta. Banco real (TEST_DATABASE_URL).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.gruposantafee.com.br" }) }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin" } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const CALLBACK = "https://www.gruposantafee.com.br/api/google-drive/callback";
const JSON_WEB = JSON.stringify({ web: { client_id: "123-abc.apps.googleusercontent.com", client_secret: "GOCSPX-segredo", redirect_uris: [CALLBACK] } });

describe.skipIf(!url)("Google Drive com a conta do dono (OAuth, banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/google-drive");
  let conexao: typeof import("@/lib/google-drive-conexao");
  let drive: typeof import("@/lib/incorporacao/registro-drive");
  let testar: typeof import("@/lib/actions/documentos-registro").testarGoogleDrive;
  let adminId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    acoes = await import("@/lib/actions/google-drive");
    conexao = await import("@/lib/google-drive-conexao");
    drive = await import("@/lib/incorporacao/registro-drive");
    ({ testarGoogleDrive: testar } = await import("@/lib/actions/documentos-registro"));
    adminId = (await prisma.usuario.findFirst({ where: { papel: "admin", ativo: true }, select: { id: true } }))!.id;
    sessao.user.id = adminId;
    await prisma.googleDriveOauth.deleteMany();
  });
  afterEach(() => { vi.unstubAllGlobals(); sessao.user.role = "admin"; sessao.user.id = adminId; });
  afterAll(async () => { await prisma.$disconnect(); });

  it("salva o JSON criptografado e nunca devolve o segredo", async () => {
    expect(await acoes.statusGoogleDrive()).toMatchObject({ credencial: false, conectado: false, callback: CALLBACK });
    expect(await acoes.salvarCredencialGoogleDrive(JSON_WEB)).toEqual({ uriCadastrada: true, callback: CALLBACK });
    const l = await prisma.googleDriveOauth.findUnique({ where: { id: 1 } });
    expect(l?.clientId).toBe("123-abc.apps.googleusercontent.com");
    expect(l?.clientSecretEncrypted).not.toContain("GOCSPX");
    expect(JSON.stringify(await acoes.statusGoogleDrive())).not.toContain("GOCSPX");
  });

  it("recusa JSON da conta de serviço, do app para computador e texto inválido", async () => {
    expect(await acoes.salvarCredencialGoogleDrive('{"type":"service_account"}')).toMatchObject({ erroAcao: expect.stringMatching(/conta de serviço/) });
    expect(await acoes.salvarCredencialGoogleDrive('{"installed":{}}')).toMatchObject({ erroAcao: expect.stringMatching(/Aplicativo da Web/) });
    expect(await acoes.salvarCredencialGoogleDrive("xx")).toMatchObject({ erroAcao: expect.stringMatching(/JSON válido/) });
  });

  it("colaborador não acessa", async () => {
    const colab = await prisma.usuario.findFirst({ where: { papel: "colaborador" }, select: { id: true } });
    if (!colab) return;
    sessao.user.id = colab.id; sessao.user.role = "colaborador";
    expect(await acoes.statusGoogleDrive()).toMatchObject({ erroAcao: expect.any(String) });
  });

  it("conexão: troca o código, cria a pasta raiz e passa a ser a fonte dos arquivos", async () => {
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (String(u).startsWith("https://oauth2.googleapis.com/token")) {
        const corpo = String(init?.body);
        if (corpo.includes("authorization_code")) {
          expect(corpo).toContain(`redirect_uri=${encodeURIComponent(CALLBACK)}`);
          return Response.json({ access_token: "at1", refresh_token: "rt-secreto", scope: "https://www.googleapis.com/auth/drive.file openid email", expires_in: 3600 });
        }
        return Response.json({ access_token: "at2", expires_in: 3600 });
      }
      if (String(u).includes("userinfo")) return Response.json({ email: "dono@gmail.com" });
      if (String(u).startsWith("https://www.googleapis.com/drive/v3/files?fields=id")) return Response.json({ id: "pasta-raiz-1" });
      return Response.json({});
    }));
    expect(await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", adminId)).toEqual({ email: "dono@gmail.com" });
    const l = await prisma.googleDriveOauth.findUnique({ where: { id: 1 } });
    expect(l?.refreshTokenEncrypted).not.toContain("rt-secreto");
    expect(l).toMatchObject({ rootFolderId: "pasta-raiz-1", accountEmail: "dono@gmail.com" });
    expect(await acoes.statusGoogleDrive()).toMatchObject({ conectado: true, email: "dono@gmail.com" });
    expect(await drive.fonteDrive()).toEqual({ modo: "oauth", root: "pasta-raiz-1", email: "dono@gmail.com" });
    expect(await conexao.tokenOAuth(true)).toBe("at2");
  });

  it("autorização revogada no Google: explica que é preciso reconectar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, { status: 400 })));
    const r = await testar();
    expect(r).toMatchObject({ ok: false, modo: "oauth", email: "dono@gmail.com" });
    expect((r as { explicacao: string }).explicacao).toMatch(/Conectar Google Drive/);
  });

  it("sem a permissão do Drive marcada: recusa a conexão", async () => {
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: "a", refresh_token: "r", scope: "openid email" })));
    await expect(conexao.concluirConexao("c", "https://www.gruposantafee.com.br", adminId)).rejects.toThrow(/permissão do Google Drive/);
    expect(await acoes.statusGoogleDrive()).toMatchObject({ conectado: false });
  });

  it("desconectar revoga o token e volta para o banco", async () => {
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    vi.stubGlobal("fetch", vi.fn(async (u: string) => String(u).startsWith("https://oauth2.googleapis.com/token")
      ? Response.json({ access_token: "a", refresh_token: "r", scope: "https://www.googleapis.com/auth/drive.file" })
      : Response.json({ id: "p2", email: "x@y" })));
    await conexao.concluirConexao("c", "https://www.gruposantafee.com.br", adminId);
    const revoga = vi.fn(async () => new Response(null));
    vi.stubGlobal("fetch", revoga);
    expect(await acoes.desconectarGoogleDrive()).toEqual({ ok: true });
    expect(String((revoga.mock.calls as unknown[][])[0]?.[0])).toContain("oauth2.googleapis.com/revoke");
    expect(await acoes.statusGoogleDrive()).toMatchObject({ conectado: false });
    expect(await drive.fonteDrive()).toBeNull();
    expect(await drive.tentarUploadDrive(async () => "nunca")).toEqual({ fileId: null, nota: null });
  });
});
