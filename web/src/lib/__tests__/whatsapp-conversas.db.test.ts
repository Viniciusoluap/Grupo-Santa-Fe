// Pedido de 25/10 (Conversas): webhook da Evolution e ações da aba Conversas com o banco real
// (TEST_DATABASE_URL). Nenhuma chamada externa: a Evolution não é acionada nestes cenários.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin", corretorId: undefined as string | undefined } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const SUF = `zap-${Date.now()}`;
// Telefones únicos por execução (outra execução em paralelo no mesmo banco não interfere).
const R = String(Math.floor(1000 + Math.random() * 9000));
const FONE_LEAD = `949${R}1233`;   // (94) 9 R-1233
const JID = `5594${R}1233`;        // como o WhatsApp manda, sem o 9º dígito
const NOVO = `55949${R}7777`;      // contato ainda sem lead

describe.skipIf(!url)("WhatsApp › Conversas (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let wh: typeof import("@/lib/whatsapp/webhook-evolution");
  let acoes: typeof import("@/lib/actions/whatsapp");
  const usuarios: string[] = [];
  const corretores: string[] = [];
  let admin: { id: string };
  let conexaoAdmin: { id: string; instancia: string | null };
  let corretorA: { id: string }, corretorB: { id: string; usuarioId: string | null };
  let leadA: { id: string };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    wh = await import("@/lib/whatsapp/webhook-evolution");
    acoes = await import("@/lib/actions/whatsapp");
    const mkUsuario = async (papel: string, nome: string) => {
      const u = await prisma.usuario.create({ data: { nome, email: `${nome}-${SUF}@teste.local`, senha: "x", papel } });
      usuarios.push(u.id);
      return u;
    };
    admin = await mkUsuario("admin", "adminzap");
    const uA = await mkUsuario("corretor", "corretora");
    const uB = await mkUsuario("corretor", "corretorb");
    corretorA = await prisma.corretor.create({ data: { usuarioId: uA.id, nome: "Corretor A", email: `ca-${SUF}@teste.local`, telefone: "1", creci: "1" } });
    corretorB = await prisma.corretor.create({ data: { usuarioId: uB.id, nome: "Corretor B", email: `cb-${SUF}@teste.local`, telefone: "1", creci: "2" } });
    corretores.push(corretorA.id, corretorB.id);
    conexaoAdmin = await prisma.conexaoWhatsApp.create({ data: { usuarioId: admin.id, provedor: "evolution", instancia: `inst-${SUF}`, status: "conectado" } });
    await prisma.conexaoWhatsApp.create({ data: { usuarioId: uB.id, provedor: "evolution", instancia: `instb-${SUF}`, status: "conectado" } });
    leadA = await prisma.lead.create({ data: { nome: `Cliente Zap ${SUF}`, telefone: `(94) 9${R}-1233`, servico: "[]", corretorId: corretorA.id } });
    sessao.user = { id: admin.id, role: "admin", corretorId: undefined };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.notificacao.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.conexaoWhatsApp.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.lead.deleteMany({ where: { OR: [{ nome: { contains: SUF } }, { telefone: NOVO.slice(2) }, { id: leadA?.id }] } });
    await prisma.corretor.deleteMany({ where: { id: { in: corretores } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  const upsert = (instancia: string, id: string, jid: string, extra: Record<string, unknown> = {}) =>
    wh.processarEventoEvolution({ event: "MESSAGES_UPSERT", instance: instancia, data: { key: { id, remoteJid: jid, fromMe: false }, pushName: "Nome WhatsApp divergente", message: { conversation: `msg ${id}` }, ...extra } });

  it("mensagem recebida: grava entrada não lida, vincula o lead pelo telefone (sem 9º dígito) e avisa o dono", async () => {
    expect(await upsert(conexaoAdmin.instancia!, `e1-${SUF}`, `${JID}@s.whatsapp.net`)).toBe("mensagens:1");
    const m = await prisma.mensagemWhatsapp.findFirstOrThrow({ where: { externalId: `e1-${SUF}` } });
    expect(m).toMatchObject({ direcao: "entrada", lida: false, status: "recebida", leadId: leadA.id, destinatario: JID, nomeDestinatario: `Cliente Zap ${SUF}`, mensagem: `msg e1-${SUF}` });
    const n = await prisma.notificacao.findFirstOrThrow({ where: { usuarioId: admin.id } });
    expect(n.link).toBe(`/admin/whatsapp?aba=conversas&numero=${JID}`);
    expect(n.titulo).toContain(`Cliente Zap ${SUF}`);
  });

  it("não duplica por externalId; ignora grupos; instância desconhecida não grava", async () => {
    expect(await upsert(conexaoAdmin.instancia!, `e1-${SUF}`, `${JID}@s.whatsapp.net`)).toBe("mensagens:0");
    expect(await upsert(conexaoAdmin.instancia!, `g1-${SUF}`, "1203630@g.us")).toBe("mensagens:0");
    expect(await upsert("nao-existe", `x-${SUF}`, `${JID}@s.whatsapp.net`)).toBe("conexao-desconhecida");
    expect(await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoAdmin.id } })).toBe(1);
  });

  it("mensagem enviada pelo celular vira saída lida; status de entrega/leitura e conexão", async () => {
    await upsert(conexaoAdmin.instancia!, `s1-${SUF}`, `${NOVO}@s.whatsapp.net`, { key: { id: `s1-${SUF}`, remoteJid: `${NOVO}@s.whatsapp.net`, fromMe: true } });
    const s = await prisma.mensagemWhatsapp.findFirstOrThrow({ where: { externalId: `s1-${SUF}` } });
    expect(s).toMatchObject({ direcao: "saida", lida: true, status: "enviada", leadId: null });
    await wh.processarEventoEvolution({ event: "MESSAGES_UPDATE", instance: conexaoAdmin.instancia!, data: { keyId: `s1-${SUF}`, status: "READ" } });
    expect((await prisma.mensagemWhatsapp.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("lida");
    await wh.processarEventoEvolution({ event: "connection.update", instance: conexaoAdmin.instancia!, data: { state: "close" } });
    expect((await prisma.conexaoWhatsApp.findUniqueOrThrow({ where: { id: conexaoAdmin.id } })).status).toBe("desconectado");
    await prisma.conexaoWhatsApp.update({ where: { id: conexaoAdmin.id }, data: { status: "conectado" } });
  });

  it("conversas agrupadas, abrir marca como lida e criar lead vincula as mensagens", async () => {
    const r = await acoes.conversasWhatsapp();
    expect(r.erro).toBeUndefined();
    expect(r.conversas.map((c) => c.numero).sort()).toEqual([JID, NOVO].sort());
    expect(r.conversas.find((c) => c.numero === JID)).toMatchObject({ leadId: leadA.id, naoLidas: 1 });

    const msgs = await acoes.mensagensConversaWhatsapp(FONE_LEAD);
    expect(msgs.mensagens).toHaveLength(1);
    expect((await acoes.conversasWhatsapp()).conversas.find((c) => c.numero === JID)?.naoLidas).toBe(0);

    const criado = await acoes.criarLeadDaConversaWhatsapp(NOVO, "Novo Contato");
    expect(criado.erro).toBeUndefined();
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: criado.leadId! } });
    expect(lead).toMatchObject({ nome: "Novo Contato", telefone: NOVO.slice(2), origem: "whatsapp", servico: "[]" });
    expect((await prisma.mensagemWhatsapp.findFirstOrThrow({ where: { externalId: `s1-${SUF}` } })).leadId).toBe(lead.id);
  });

  it("histórico de envios só com saídas; prévia preenche e aponta o que falta", async () => {
    const saidas = await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoAdmin.id, direcao: "saida" } });
    expect(saidas).toBe(1);
    const p = await acoes.previaEnvioWhatsapp("Oi {{nome}}, com {{corretor}} às {{horario}}", [leadA.id]);
    expect(p.itens[0]).toMatchObject({ texto: "Oi Cliente, com Corretor A às {{horario}}", faltando: ["horario"] });
  });

  it("rota do webhook: recusa sem o cabeçalho secreto e processa com ele", async () => {
    const { POST } = await import("@/app/api/whatsapp/evolution-webhook/route");
    const corpo = JSON.stringify({ event: "connection.update", instance: conexaoAdmin.instancia, data: { state: "open" } });
    const sem = await POST(new Request("http://x/api/whatsapp/evolution-webhook", { method: "POST", body: corpo, headers: { "x-webhook-token": "errado" } }));
    expect(sem.status).toBe(401);
    const com = await POST(new Request("http://x/api/whatsapp/evolution-webhook", { method: "POST", body: corpo, headers: { "x-webhook-token": wh.segredoWebhookEvolution() } }));
    expect(await com.json()).toEqual({ ok: true, r: "conexao" });
  });

  it("corretor: não vê nem responde conversa de lead de outro corretor", async () => {
    sessao.user = { id: corretorB.usuarioId!, role: "corretor", corretorId: corretorB.id };
    try {
      await upsert(`instb-${SUF}`, `b1-${SUF}`, `${JID}@s.whatsapp.net`);
      expect((await acoes.conversasWhatsapp()).conversas).toEqual([]);
      expect((await acoes.mensagensConversaWhatsapp(JID)).erro).toBe("Conversa de outro corretor.");
      expect((await acoes.responderWhatsapp(JID, "oi")).erro).toBe("Conversa de outro corretor.");
      expect((await acoes.previaEnvioWhatsapp("Oi {{nome}}", [leadA.id])).itens).toEqual([]);
    } finally {
      sessao.user = { id: admin.id, role: "admin", corretorId: undefined };
    }
  });

  it("excluir conversa remove só as mensagens locais daquele número", async () => {
    sessao.user = { id: admin.id, role: "admin", corretorId: undefined };
    await upsert(conexaoAdmin.instancia!, `del-${SUF}`, `${JID}@s.whatsapp.net`);
    const antes = await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoAdmin.id } });
    const r = await acoes.excluirConversaWhatsapp(JID);
    expect(r.erro).toBeUndefined();
    expect(r.apagadas).toBeGreaterThan(0);
    expect(await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoAdmin.id } })).toBeLessThan(antes);
    expect(await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoAdmin.id, destinatario: NOVO } })).toBeGreaterThan(0);
  });
});
