// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-envio.test.ts) —
// etapa 8: proteções de envio (opt-out, janela, limite diário, modo de teste, intervalo), fila com
// reprocessamento sem duplicar, e sequências de follow-up, sem resposta e reativação.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { aviso, criarBanco, montarCenario, NUMERO_TESTE, OUTRO_NUMERO, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { enfileirarTemplate, marcarIncertos, processarFila } from "@/lib/central-vendas/envio";
import { agendarSequencias } from "@/lib/central-vendas/sequencias";
import { processarEventoEvolution } from "@/lib/whatsapp/webhook-evolution";
import { bloqueioEnvio, ehOptOut } from "@/lib/central-vendas/regras";

let b: Banco;
let c: Cenario;
let n = 0;
let ana: string, bruno: string;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
beforeEach(async () => {
  c = await montarCenario(b);
  ana = await c.novoLead({ nome: "Ana Souza", telefone: "99988887777" });
  bruno = await c.novoLead({ nome: "Bruno Fora", telefone: "99911112222" });
  await c.prisma.centralVendasLead.createMany({ data: [{ leadId: ana, operadorId: U.olga }, { leadId: bruno, operadorId: U.otto }] });
});
const proativa = (leadId = ana, slug = "cv-reativacao") => enfileirarTemplate({ leadId, slug, chave: `t:${++n}`, proativa: true });
const fila = () => c.prisma.centralVendasFila.findMany({ orderBy: { id: "asc" }, select: { status: true, tentativas: true } });

describe("regras puras de envio", () => {
  const base = { ativo: true, optOut: false, modoTeste: false, numerosTeste: [], numero: NUMERO_TESTE, proativa: true, agora: new Date("2026-11-12T13:00:00Z"), janela: { inicio: "08:00", fim: "20:00" }, enviadosHoje: 0, limiteDiario: 20 };
  it("cada proteção bloqueia", () => {
    expect(bloqueioEnvio(base)).toBeNull();
    expect(bloqueioEnvio({ ...base, ativo: false })).toBe("desligado");
    expect(bloqueioEnvio({ ...base, optOut: true })).toBe("opt_out");
    expect(bloqueioEnvio({ ...base, optOut: true, ignorarOptOut: true })).toBeNull();
    expect(bloqueioEnvio({ ...base, modoTeste: true, numerosTeste: [OUTRO_NUMERO] })).toBe("modo_teste");
    expect(bloqueioEnvio({ ...base, agora: new Date("2026-11-12T23:00:00Z") })).toBe("fora_horario"); // 20h
    expect(bloqueioEnvio({ ...base, agora: new Date("2026-11-12T10:59:00Z") })).toBe("fora_horario"); // 7h59
    expect(bloqueioEnvio({ ...base, proativa: false, agora: new Date("2026-11-12T23:00:00Z") })).toBeNull();
    expect(bloqueioEnvio({ ...base, enviadosHoje: 20 })).toBe("limite_diario");
    expect(["SAIR", "parar", " Sair! ", "PARAR."].every(ehOptOut)).toBe(true);
    expect(ehOptOut("quero sair do aluguel")).toBe(false);
  });
});

describe("proteções na fila", () => {
  it("opt-out por SAIR: confirma uma vez, cancela pendentes e bloqueia os próximos", async () => {
    c.relogio.agora = new Date("2026-11-12T23:30:00Z"); // 20h30: a proativa fica pendente
    await proativa();
    await processarEventoEvolution(aviso("S1", NUMERO_TESTE, "SAIR"));
    await processarEventoEvolution(aviso("S2", NUMERO_TESTE, "SAIR"));
    expect(c.envios.map(e => e.texto)).toEqual(["Pronto, Ana. Você não receberá mais mensagens automáticas. Se precisar, é só chamar."]);
    expect((await c.prisma.centralVendasLead.findUnique({ where: { leadId: ana } }))?.optOut).toBe(true);
    expect((await fila())[0].status).toBe("descartado");
    c.relogio.agora = new Date("2026-11-13T13:00:00Z");
    await proativa();
    await processarFila();
    expect(c.envios).toHaveLength(1);
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "envio_bloqueado" } })).toBe(1);
  });

  it("fora da janela adia para 8h; modo de teste descarta número fora da lista", async () => {
    c.relogio.agora = new Date("2026-11-12T23:30:00Z");
    await proativa();
    await processarFila();
    expect(c.envios).toHaveLength(0);
    const quando = (await c.prisma.centralVendasFila.findFirst())!.proximaTentativaEm.toISOString();
    expect(quando.startsWith("2026-11-13T11:")).toBe(true); // 8h–8h30 em Fortaleza
    c.relogio.agora = new Date("2026-11-13T11:40:00Z");
    await processarFila();
    expect(c.envios).toHaveLength(1);
    await proativa(bruno);
    await processarFila();
    expect(c.envios).toHaveLength(1);
    expect((await fila()).at(-1)!.status).toBe("descartado");
  });

  it("limite diário por número e intervalo aleatório entre envios", async () => {
    await c.salvarConfig({ limiteDiarioPorNumero: 2 });
    for (let i = 0; i < 3; i++) await proativa();
    await processarFila();
    expect(c.envios).toHaveLength(2);
    expect(c.dormidas).toEqual([15_000]); // só entre o 1º e o 2º envio: 10 s + 0,5 × (20 − 10) s
    expect((await fila()).map(f => f.status)).toEqual(["concluido", "concluido", "pendente"]);
    c.avancar(24 * 60);
    await processarFila();
    expect(c.envios).toHaveLength(3);
  });

  it("falha de envio vai para a fila e é reprocessada sem duplicar", async () => {
    c.falharProximos(1);
    await proativa();
    await processarFila();
    expect(await fila()).toEqual([{ status: "pendente", tentativas: 1 }]);
    c.avancar(1);
    await processarFila();
    await processarFila();
    expect(c.envios).toHaveLength(1);
    expect(await fila()).toEqual([{ status: "concluido", tentativas: 2 }]);
    expect(await c.prisma.mensagemWhatsapp.count({ where: { direcao: "saida" } })).toBe(1);
  });

  it("após 5 falhas para, avisa o admin; queda no meio do envio vira 'incerto' e não reenvia", async () => {
    c.falharProximos(99);
    await proativa();
    for (let i = 0; i < 8; i++) { await processarFila(); c.avancar(20); }
    expect(await fila()).toEqual([{ status: "falhou", tentativas: 5 }]);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "falha" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.admin }]);
    c.falharProximos(0);
    const job = (await proativa())!;
    await c.prisma.centralVendasFila.update({ where: { id: job.id }, data: { status: "processando", atualizadoEm: new Date(c.relogio.agora.getTime() - 11 * 60_000) } });
    expect(await marcarIncertos()).toBe(1);
    await processarFila();
    expect(c.envios).toHaveLength(0);
    expect((await fila())[1].status).toBe("incerto");
  });
});

describe("sequências", () => {
  it("follow-up após aprovação: um passo por vez, sem repetir", async () => {
    await c.prisma.centralVendasSequencia.create({ data: { tipo: "followup_aprovado", nome: "Pós-aprovação", passos: '[{"aposDias":1,"templateSlug":"cv-followup-aprovado"},{"aposDias":3,"templateSlug":"cv-followup-aprovado"}]' } });
    await c.prisma.centralVendasLead.update({ where: { leadId: ana }, data: { statusAnalise: "aprovado", decisaoPor: U.admin, decisaoEm: c.relogio.agora } });
    expect(await agendarSequencias()).toBe(0);
    c.avancar(24 * 60);
    expect(await agendarSequencias()).toBe(1);
    expect(await agendarSequencias()).toBe(0);
    c.avancar(2 * 24 * 60);
    expect(await agendarSequencias()).toBe(1);
    await processarFila();
    expect(c.envios.map(e => e.texto)).toEqual([expect.stringContaining("próximos passos"), expect.stringContaining("próximos passos")]);
  });

  it("sem resposta e reativação 30/60/90 dias; desligada, não agenda", async () => {
    const t0 = c.relogio.agora;
    await c.prisma.centralVendasSequencia.createMany({ data: [
      { tipo: "sem_resposta", nome: "Sem resposta", passos: '[{"aposDias":1,"templateSlug":"cv-sem-resposta"}]' },
      { tipo: "reativacao", nome: "Reativação", passos: '[{"aposDias":30,"templateSlug":"cv-reativacao"},{"aposDias":60,"templateSlug":"cv-reativacao"},{"aposDias":90,"templateSlug":"cv-reativacao"}]' },
    ] });
    await c.prisma.centralVendasLead.update({ where: { leadId: ana }, data: { statusAtendimento: "aguardando_cliente", ultimaMensagemClienteEm: t0, ultimaMensagemEnviadaEm: new Date(t0.getTime() + 60_000) } });
    c.avancar(24 * 60 + 2);
    expect(await agendarSequencias()).toBe(1);
    expect((await c.prisma.centralVendasLead.findUnique({ where: { leadId: ana } }))?.statusAtendimento).toBe("sem_resposta");
    c.avancar(30 * 24 * 60);
    expect(await agendarSequencias()).toBe(2); // reativação D+30 da Ana e do Bruno (entrou há 31 dias, nunca escreveu)
    expect(await agendarSequencias()).toBe(0);
    await c.salvarConfig({ automacoes: { ia: true, documentos: true, lembretes: true, followup: true, reativacao: false } });
    c.avancar(30 * 24 * 60);
    expect(await agendarSequencias()).toBe(0);
  });
});
