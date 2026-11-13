// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-analise.test.ts) —
// etapa 7: retorno da análise. Decisão só por humano; cada decisão dispara a mensagem certa.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { criarBanco, montarCenario, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { registrarDecisao } from "@/lib/central-vendas/analise";
import { agendarLembretes } from "@/lib/central-vendas/documentos";
import { processarFila } from "@/lib/central-vendas/envio";

let b: Banco;
let c: Cenario;
let leadId: string;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
beforeEach(async () => {
  c = await montarCenario(b);
  await c.prisma.centralVendasChecklist.create({ data: { slug: "mcmv", nome: "MCMV", documentos: '[{"chave":"rg","nome":"RG","tipo":"rg","obrigatorio":true}]' } });
  leadId = await c.novoLead({ nome: "Ana Souza", telefone: "99988887777", etapaOperacional: "em_atendimento" });
  await c.prisma.centralVendasLead.create({ data: { leadId, statusAtendimento: "aguardando_cliente", statusDocumental: "completo", statusAnalise: "em_analise", operadorId: U.olga, checklistId: 1, enviadoAnaliseEm: c.relogio.agora } });
});
const cv = async () => (await c.prisma.centralVendasLead.findFirst({ select: { statusAtendimento: true, statusDocumental: true, statusAnalise: true, decisaoPor: true } }))!;

describe("decisão da análise", () => {
  it("pendente: mensagem com as pendências, volta a aguardar documentos e os lembretes recomeçam", async () => {
    await registrarDecisao({ leadId, decisao: "pendente", pendencias: "extrato do FGTS atualizado", userId: U.ana });
    expect(await cv()).toMatchObject({ statusDocumental: "aguardando_documentos", statusAnalise: "pendente", decisaoPor: U.ana });
    expect(c.envios.map(e => e.texto)).toEqual(["Ana, a análise apontou estas pendências: extrato do FGTS atualizado. Envie por aqui assim que puder para continuarmos."]);
    // Checklist do lead está completo, mas a pendência reabre o ciclo: o lembrete D+1 volta a contar da decisão.
    await c.prisma.centralVendasChecklist.create({ data: { slug: "extra", nome: "Extra", documentos: '[{"chave":"fgts","nome":"Extrato do FGTS","tipo":"fgts","obrigatorio":true}]' } });
    await c.prisma.centralVendasLead.updateMany({ data: { checklistId: 2 } });
    c.avancar(24 * 60);
    expect(await agendarLembretes()).toBe(1);
  });

  it("aprovado: entra no follow-up, avisa o operador e manda o template sem valores", async () => {
    await registrarDecisao({ leadId, decisao: "aprovado", userId: U.admin });
    expect(await cv()).toMatchObject({ statusAnalise: "aprovado", decisaoPor: U.admin });
    expect(await c.prisma.lead.findFirst({ select: { etapaOperacional: true, temperatura: true } })).toEqual({ etapaOperacional: "aprovado_follow_up", temperatura: "quente" });
    expect(c.envios).toHaveLength(1);
    expect(c.envios[0].texto).toBe("Ana, sua análise foi concluída com resultado positivo! Olga, da nossa equipe, vai falar com você sobre os próximos passos.");
    expect(c.envios[0].texto).not.toMatch(/R\$|\d/);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "follow-up" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.olga }]);
  });

  it("reprovado: mensagem neutra (sem o motivo) e transferência para humano", async () => {
    await registrarDecisao({ leadId, decisao: "reprovado", motivoInterno: "Restrição no CPF", userId: U.ana });
    expect(await cv()).toMatchObject({ statusAnalise: "reprovado", statusAtendimento: "em_atendimento_humano" });
    expect(c.envios).toHaveLength(1);
    expect(c.envios[0].texto).not.toMatch(/CPF|restri|reprovad|negad/i);
    expect((await c.prisma.centralVendasLead.findFirst())?.motivoReprovacao).toBe("Restrição no CPF");
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "reprovada" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.olga }]);
  });

  it("fora da janela 8h–20h a mensagem da decisão espera a abertura seguinte", async () => {
    c.relogio.agora = new Date("2026-11-13T01:30:00Z"); // 22h30 em Fortaleza
    await registrarDecisao({ leadId, decisao: "aprovado", userId: U.admin });
    expect(c.envios).toHaveLength(0);
    c.relogio.agora = new Date("2026-11-13T11:45:00Z"); // 8h45
    await processarFila();
    expect(c.envios).toHaveLength(1);
  });
});

describe("nenhuma automação consegue marcar aprovado", () => {
  it("exige admin ou analista ativo; operador, inativo ou id inexistente são recusados", async () => {
    for (const userId of [U.olga, U.ivo, "nao-existe", ""]) {
      await expect(registrarDecisao({ leadId, decisao: "aprovado", userId })).rejects.toThrow(/administrador ou um analista/);
    }
    expect(await cv()).toMatchObject({ statusAnalise: "em_analise", decisaoPor: null });
  });
  it("o banco recusa decisão sem o humano que decidiu", async () => {
    await expect(c.pg.exec(`UPDATE central_vendas_leads SET "statusAnalise" = 'aprovado'`)).rejects.toThrow(/decisao_humana/);
  });
  it("só decide quem está em análise; pendente exige a descrição", async () => {
    await expect(registrarDecisao({ leadId, decisao: "pendente", pendencias: "", userId: U.admin })).rejects.toThrow(/pendências/);
    await registrarDecisao({ leadId, decisao: "aprovado", userId: U.admin });
    await expect(registrarDecisao({ leadId, decisao: "reprovado", userId: U.admin })).rejects.toThrow(/não está em análise/);
  });
});
