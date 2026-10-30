// Lote 03 (29/10/2026) — correções 01 a 04 da Central WhatsApp com o banco real (TEST_DATABASE_URL).
// Gêmeo de Prospecta/server/whatsapp-lote3.test.ts. Nada externo é chamado: o envio pela Evolution é simulado.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin", corretorId: undefined as string | undefined } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
vi.mock("@/lib/whatsapp/evolution-config", () => ({ configEvolution: async () => ({ url: "https://evo.teste", apiKey: "k" }), urlServidorEvolution: async () => "https://evo.teste" }));
const lixeira = vi.hoisted(() => vi.fn<(ids: (string | null | undefined)[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/drive-organizacao", async (original) => ({ ...(await original<typeof import("@/lib/drive-organizacao")>()), lixeiraDeArquivosSemUso: lixeira }));
vi.mock("@/lib/evolution", async (original) => ({ ...(await original<typeof import("@/lib/evolution")>()), enviarTextoEvolution: vi.fn(async () => "ext-ok") }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const SUF = `wa3-${Date.now()}`;
const R = String(Math.floor(1000 + Math.random() * 9000));
// Telefones únicos por execução: DDD 93 + 9 + R + sufixo.
const FONE_ANA = `(93) 9${R}-2210`;
const JID_ANA = `55939${R}2210`;
const FONE_BRUNO = `(93) 9${R}-6600`;
const JID_BRUNO = `55939${R}6600`;
const JID_SEM_LEAD = `55939${R}4444`;
const JID_OUTRO = `55939${R}5555`;

describe.skipIf(!url)("WhatsApp › lote 03 (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/whatsapp");
  const usuarios: string[] = [];
  const corretores: string[] = [];
  let admin: { id: string };
  let conexaoAdmin: { id: string }, conexaoB: { id: string };
  let corretorA: { id: string }, corretorB: { id: string; usuarioId: string | null };
  let ana: { id: string }, anaDup: { id: string }, andre: { id: string }, bruno: { id: string }, arquivado: { id: string };
  const comoAdmin = () => { sessao.user = { id: admin.id, role: "admin", corretorId: undefined }; };
  const comoCorretorB = () => { sessao.user = { id: corretorB.usuarioId!, role: "corretor", corretorId: corretorB.id }; };
  const msg = (conexaoId: string, destinatario: string, extra: Record<string, unknown> = {}) =>
    prisma.mensagemWhatsapp.create({ data: { conexaoId, destinatario, mensagem: "oi", status: "recebida", direcao: "entrada", lida: false, ...extra } });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    acoes = await import("@/lib/actions/whatsapp");
    const mkUsuario = async (papel: string, nome: string) => {
      const u = await prisma.usuario.create({ data: { nome, email: `${nome}-${SUF}@teste.local`, senha: "x", papel } });
      usuarios.push(u.id);
      return u;
    };
    admin = await mkUsuario("admin", "adminwa3");
    const uA = await mkUsuario("corretor", "corretorawa3");
    const uB = await mkUsuario("corretor", "corretorbwa3");
    corretorA = await prisma.corretor.create({ data: { usuarioId: uA.id, nome: "Corretor A", email: `ca-${SUF}@teste.local`, telefone: "1", creci: "1" } });
    corretorB = await prisma.corretor.create({ data: { usuarioId: uB.id, nome: "Corretor B", email: `cb-${SUF}@teste.local`, telefone: "1", creci: "2" } });
    corretores.push(corretorA.id, corretorB.id);
    conexaoAdmin = await prisma.conexaoWhatsApp.create({ data: { usuarioId: admin.id, provedor: "evolution", instancia: `inst-${SUF}`, status: "conectado" } });
    conexaoB = await prisma.conexaoWhatsApp.create({ data: { usuarioId: uB.id, provedor: "evolution", instancia: `instb-${SUF}`, status: "conectado" } });
    ana = await prisma.lead.create({ data: { nome: `Ana Souza ${SUF}`, telefone: FONE_ANA, cpf: `111.${R.slice(0, 3)}.333-44`, servico: "[]", corretorId: corretorB.id } });
    anaDup = await prisma.lead.create({ data: { nome: `Ana Duplicada ${SUF}`, telefone: JID_ANA.slice(2), servico: "[]", corretorId: corretorA.id } });
    andre = await prisma.lead.create({ data: { nome: `André Renan ${SUF}`, telefone: `(93) 9${R}-0000`, servico: "[]", corretorId: corretorB.id, excluidoEm: new Date("2026-10-26T12:00:00Z") } });
    arquivado = await prisma.lead.create({ data: { nome: `Arquivado ${SUF}`, telefone: `(93) 9${R}-1111`, servico: "[]", corretorId: corretorB.id, arquivadoEm: new Date() } });
    bruno = await prisma.lead.create({ data: { nome: `Bruno Lima ${SUF}`, telefone: FONE_BRUNO, servico: "[]", corretorId: corretorB.id } });
    comoAdmin();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.conexaoWhatsApp.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.lead.deleteMany({ where: { OR: [{ nome: { contains: SUF } }, { telefone: { contains: `9${R}` } }] } });
    await prisma.corretor.deleteMany({ where: { id: { in: corretores } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("01 — prévia e exclusão em lote: só as conversas escolhidas, com mídia, sem tocar em leads; auditoria sem dados pessoais", async () => {
    comoAdmin();
    const m1 = await msg(conexaoAdmin.id, JID_SEM_LEAD);
    await msg(conexaoAdmin.id, JID_SEM_LEAD.replace(`939${R}`, `93${R}`)); // sem o 9º dígito
    await msg(conexaoAdmin.id, JID_OUTRO);
    const fica = await msg(conexaoAdmin.id, `55939${R}7777`);
    await msg(conexaoB.id, JID_SEM_LEAD); // outra conexão
    await prisma.whatsappMidia.create({ data: { mensagemId: m1.id, conteudo: Buffer.from("x"), driveFileId: `drive-${SUF}` } });
    const leadsAntes = await prisma.lead.count({ where: { nome: { contains: SUF } } });

    expect(await acoes.previaExclusaoConversasWhatsapp([JID_SEM_LEAD, JID_OUTRO])).toEqual({ conversas: 2, mensagens: 3 });
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await acoes.excluirConversasWhatsapp([JID_SEM_LEAD, JID_OUTRO])).toEqual({ conversas: 2, apagadas: 3 });
    const registro = String(log.mock.calls.at(-1)?.[0]);
    log.mockRestore();
    expect(JSON.parse(registro)).toMatchObject({ evento: "whatsapp.conversas_excluidas", usuarioId: admin.id, conversas: 2, mensagens: 3 });
    expect(registro).not.toContain(R);

    expect((await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conexaoAdmin.id }, select: { id: true } })).map((m) => m.id)).toEqual([fica.id]);
    expect(await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoB.id } })).toBe(1);
    expect(await prisma.whatsappMidia.count({ where: { mensagemId: m1.id } })).toBe(0);
    // Revisão PR #242 (P2): a cópia da mídia no Drive vai para a lixeira, como na exclusão unitária.
    expect(lixeira).toHaveBeenLastCalledWith([`drive-${SUF}`]);
    expect(await prisma.lead.count({ where: { nome: { contains: SUF } } })).toBe(leadsAntes);
    await prisma.mensagemWhatsapp.deleteMany({ where: { conexaoId: { in: [conexaoAdmin.id, conexaoB.id] } } });
  });

  it("01 — corretor: se uma conversa é de lead de outro corretor, nada é apagado", async () => {
    comoCorretorB();
    try {
      await msg(conexaoB.id, JID_BRUNO); // lead do próprio corretor
      await msg(conexaoB.id, JID_OUTRO, { leadId: anaDup.id }); // lead do corretor A
      const r = await acoes.excluirConversasWhatsapp([JID_BRUNO, JID_OUTRO]);
      expect(r.erro).toMatch(/outro corretor/);
      expect(await prisma.mensagemWhatsapp.count({ where: { conexaoId: conexaoB.id } })).toBe(2);
      expect(await acoes.excluirConversasWhatsapp([JID_BRUNO])).toEqual({ conversas: 1, apagadas: 1 });
    } finally {
      await prisma.mensagemWhatsapp.deleteMany({ where: { conexaoId: conexaoB.id } });
      comoAdmin();
    }
  });

  it("02 — telefone em dois leads: lista ambos; vínculo manual vence a inferência e pode ser desfeito", async () => {
    comoAdmin();
    await msg(conexaoAdmin.id, JID_ANA);
    const cand = await acoes.buscarLeadsParaVincularWhatsapp(JID_ANA, "");
    expect(cand.leads.map((l) => l.id).sort()).toEqual([ana.id, anaDup.id].sort());
    expect(cand.leads.every((l) => l.mesmoTelefone)).toBe(true);

    const conversa = async () => (await acoes.conversasWhatsapp()).conversas.find((c) => c.numero === JID_ANA)!;
    const antes = await conversa();
    expect(antes.vinculo).toBe("telefone");
    const escolhido = antes.leadId === ana.id ? anaDup : ana;

    expect(await acoes.vincularLeadWhatsapp(JID_ANA, escolhido.id)).toEqual({ leadId: escolhido.id });
    expect(await conversa()).toMatchObject({ leadId: escolhido.id, vinculo: "manual" });
    // Mensagem nova (webhook grava pela inferência) não derruba o vínculo.
    await msg(conexaoAdmin.id, JID_ANA, { leadId: antes.leadId });
    expect(await conversa()).toMatchObject({ leadId: escolhido.id, vinculo: "manual" });
    // O cadastro do lead não muda.
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: ana.id }, select: { nome: true, telefone: true } });
    expect(lead).toEqual({ nome: `Ana Souza ${SUF}`, telefone: FONE_ANA });

    expect(await acoes.desvincularLeadWhatsapp(JID_ANA)).toEqual({ ok: true });
    expect((await conversa()).vinculo).toBe("telefone");
    expect(await prisma.whatsappVinculoConversa.count({ where: { conexaoId: conexaoAdmin.id } })).toBe(0);
  });

  it("02 — busca por CPF; lead excluído não aparece nem pode ser vinculado; corretor só vincula os próprios", async () => {
    comoAdmin();
    expect((await acoes.buscarLeadsParaVincularWhatsapp(JID_SEM_LEAD, `111.${R.slice(0, 3)}`)).leads.map((l) => l.id)).toContain(ana.id);
    expect((await acoes.buscarLeadsParaVincularWhatsapp(JID_SEM_LEAD, `André Renan ${SUF}`)).leads).toEqual([]);
    expect((await acoes.vincularLeadWhatsapp(JID_SEM_LEAD, andre.id)).erro).toMatch(/excluído/);
    comoCorretorB();
    try {
      await msg(conexaoB.id, JID_SEM_LEAD);
      expect((await acoes.vincularLeadWhatsapp(JID_SEM_LEAD, anaDup.id)).erro).toMatch(/outro corretor/);
      expect(await acoes.vincularLeadWhatsapp(JID_SEM_LEAD, bruno.id)).toEqual({ leadId: bruno.id });
    } finally { comoAdmin(); }
  });

  it("02 — criar lead avisa quando o telefone já existe; com confirmação cria e já vincula", async () => {
    comoAdmin();
    const r = await acoes.criarLeadDaConversaWhatsapp(JID_ANA, "Nova", false);
    expect(r.duplicados).toBe(2);
    const criado = await acoes.criarLeadDaConversaWhatsapp(JID_ANA, `Nova ${SUF}`, true);
    expect(criado.erro).toBeUndefined();
    expect((await acoes.conversasWhatsapp()).conversas.find((c) => c.numero === JID_ANA)).toMatchObject({ leadId: criado.leadId, vinculo: "manual" });
  });

  it("03 — André Renan (excluído) e lead arquivado não entram na prévia, documentos nem no envio", async () => {
    comoCorretorB();
    try {
      const { LEAD_ATIVO_WHATSAPP } = await import("@/lib/whatsapp/conversas");
      // Mesmo filtro da página (destinatários).
      const lista = await prisma.lead.findMany({ where: { ...LEAD_ATIVO_WHATSAPP, corretorId: corretorB.id }, select: { id: true } });
      expect(lista.map((l) => l.id).sort()).toEqual([ana.id, bruno.id].sort());
      expect((await acoes.previaEnvioWhatsapp("Oi {{nome}}", [bruno.id, andre.id, arquivado.id])).itens.map((p) => p.id)).toEqual([bruno.id]);
      expect((await acoes.documentosParaEnvioWhatsapp([bruno.id, andre.id])).map((d) => d.id)).toEqual([bruno.id]);
      const { POST } = await import("@/app/api/whatsapp/enviar/route");
      const corpo = { mensagem: "Olá", destinatarios: [bruno, andre, arquivado].map((l) => ({ id: l.id, nome: "x", telefone: "1", leadId: l.id })) };
      const res = await POST(new Request("http://x/api/whatsapp/enviar", { method: "POST", body: JSON.stringify(corpo) }) as never);
      expect(await res.json()).toMatchObject({ enviadas: 1, falhas: 0 });
      expect((await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conexaoB.id, direcao: "saida" }, select: { leadId: true } })).map((m) => m.leadId)).toEqual([bruno.id]);
    } finally {
      await prisma.mensagemWhatsapp.deleteMany({ where: { conexaoId: conexaoB.id } });
      comoAdmin();
    }
  });

  it("04 — Mensagens Enviadas contadas no banco: passa de 100, ignora falhas e entradas, respeita o período", async () => {
    comoCorretorB(); // escopo da própria conexão: contagem exata mesmo com o banco compartilhado
    try {
      const dias = (n: number) => new Date(Date.now() - n * 86400000);
      const base = { conexaoId: conexaoB.id, destinatario: "55939", mensagem: "x" };
      await prisma.mensagemWhatsapp.createMany({ data: [
        ...Array.from({ length: 150 }, (_, i) => ({ ...base, status: ["enviada", "entregue", "lida"][i % 3], direcao: "saida", enviadaEm: dias(2) })),
        ...Array.from({ length: 5 }, () => ({ ...base, status: "falhou", direcao: "saida", enviadaEm: dias(2) })),
        ...Array.from({ length: 20 }, () => ({ ...base, status: "enviada", direcao: "saida", enviadaEm: dias(45) })),
        ...Array.from({ length: 7 }, () => ({ ...base, status: "recebida", direcao: "entrada", lida: false, enviadaEm: dias(1) })),
      ] });
      expect(await acoes.resumoEnviosWhatsapp()).toMatchObject({ periodo: "30", enviadas: 150, lidas: 50, falhas: 5, taxaLeitura: 33 });
      expect(await acoes.resumoEnviosWhatsapp("90")).toMatchObject({ enviadas: 170, falhas: 5 });
      expect(await acoes.resumoEnviosWhatsapp("tudo")).toMatchObject({ enviadas: 170, desde: null });
      expect(await acoes.resumoEnviosWhatsapp("7")).toMatchObject({ enviadas: 150 });
    } finally {
      await prisma.mensagemWhatsapp.deleteMany({ where: { conexaoId: conexaoB.id } });
      comoAdmin();
    }
  });
});
