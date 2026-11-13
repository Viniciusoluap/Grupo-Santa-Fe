// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-distribuicao.test.ts) —
// etapa 4: rodízio entre operadores e SLA de primeira resposta humana (reatribuição).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { criarBanco, montarCenario, NUMERO_TESTE, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { verificarSla } from "@/lib/central-vendas/distribuicao";
import { receberContato } from "@/lib/central-vendas/entrada";
import { transferirParaHumano } from "@/lib/central-vendas/ia";
import { minutosUteisEntre, proximoOperador } from "@/lib/central-vendas/regras";

let b: Banco;
let c: Cenario;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
const montar = async (config = {}) => { c = await montarCenario(b, { config }); };

describe("regras puras", () => {
  it("rodízio volta ao primeiro e pula o atual na reatribuição", () => {
    expect(proximoOperador(["b", "a"], null)).toBe("a");
    expect(proximoOperador(["a", "b"], "a")).toBe("b");
    expect(proximoOperador(["a", "b"], "b")).toBe("a");
    expect(proximoOperador(["a", "b"], "b", "b")).toBe("a");
    expect(proximoOperador(["a"], "a", "a")).toBeNull();
    expect(proximoOperador([], null)).toBeNull();
  });
  it("SLA só conta minutos em horário de atendimento (Fortaleza, seg–sex 8h–18h)", () => {
    const h = { dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00" };
    expect(minutosUteisEntre(new Date("2026-11-12T20:55:00Z"), new Date("2026-11-13T11:05:00Z"), h)).toBe(10);
    expect(minutosUteisEntre(new Date("2026-11-13T20:50:00Z"), new Date("2026-11-16T11:10:00Z"), h)).toBe(20);
    expect(minutosUteisEntre(new Date("2026-11-12T13:00:00Z"), new Date("2026-11-12T13:16:00Z"), h)).toBe(16);
  });
});

describe("distribuição automática", () => {
  beforeEach(() => montar({ operadores: [U.olga, U.otto, U.ivo], numerosTeste: [NUMERO_TESTE, "5599911110001", "5599911110002"] }));

  it("rodízio entre operadores ativos (inativo fica de fora) e responsável do CRM preenchido", async () => {
    for (const t of [NUMERO_TESTE, "5599911110001", "5599911110002"]) { await receberContato({ origem: "whatsapp", telefone: t }); c.avancar(1); }
    const ids = [await c.lead(1), await c.lead(2), await c.lead(3)];
    const cv = await c.prisma.centralVendasLead.findMany({ select: { leadId: true, operadorId: true } });
    expect(ids.map(id => cv.find(x => x.leadId === id)?.operadorId)).toEqual([U.olga, U.otto, U.olga]);
    const ls = await c.prisma.lead.findMany({ select: { id: true, responsavelId: true } });
    expect(ids.map(id => ls.find(l => l.id === id)?.responsavelId)).toEqual([U.olga, U.otto, U.olga]);
  });
});

describe("SLA de primeira resposta humana", () => {
  beforeEach(() => montar());
  const transferido = async () => {
    await receberContato({ origem: "whatsapp", telefone: NUMERO_TESTE });
    await transferirParaHumano((await c.lead())!, "pedido_cliente");
  };

  it("estourado (15 min em horário comercial) → reatribui automaticamente, avisa e registra", async () => {
    await transferido();
    c.avancar(10);
    expect(await verificarSla()).toMatchObject({ reatribuidos: 0 });
    c.avancar(6);
    expect(await verificarSla()).toMatchObject({ reatribuidos: 1 });
    expect(await c.prisma.centralVendasLead.findMany({ select: { operadorId: true } })).toEqual([{ operadorId: U.otto }]);
    expect(await c.prisma.centralVendasEvento.findMany({ where: { tipo: "sla_reatribuido" }, select: { payload: true } })).toEqual([{ payload: JSON.stringify({ de: U.olga, para: U.otto, slaMinutos: 15 }) }]);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "reatribuído" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.otto }]);
    expect((await c.prisma.lead.findFirst())?.responsavelId).toBe(U.otto);
    // O relógio do SLA recomeça com o novo operador.
    expect(await verificarSla()).toMatchObject({ reatribuidos: 0 });
  });

  it("resposta humana dentro do prazo é registrada e não reatribui (mensagem automática não conta)", async () => {
    await transferido(); // a própria transferência manda uma mensagem automática ao cliente
    c.avancar(5);
    await c.prisma.mensagemWhatsapp.create({ data: { conexaoId: "conn-1", leadId: (await c.lead())!, destinatario: "99988887777", mensagem: "Oi, aqui é a Olga", direcao: "saida", enviadaEm: c.relogio.agora } });
    c.avancar(20);
    expect(await verificarSla()).toMatchObject({ respondidos: 1, reatribuidos: 0 });
    expect((await c.prisma.centralVendasLead.findFirst())?.primeiraRespostaHumanaEm).not.toBeNull();
  });

  it("sem outro operador: registra o estouro e avisa o admin uma vez", async () => {
    await c.salvarConfig({ operadores: [U.olga] });
    await transferido();
    c.avancar(30);
    await verificarSla();
    await verificarSla();
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "sla_estourado" } })).toBe(1);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "SLA estourado" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.admin }]);
  });
});
