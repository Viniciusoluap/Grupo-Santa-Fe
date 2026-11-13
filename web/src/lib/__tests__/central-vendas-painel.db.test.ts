// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-painel.test.ts) —
// etapa 9: indicadores (só dados reais), CSV, permissões e telas de configuração (server actions).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;
const sessao = vi.hoisted(() => ({ atual: null as null | { user: { id: string; role: string; permissoes?: string[] } } }));
vi.mock("@/auth", () => ({ auth: async () => sessao.atual }));
const como = (id: string, role: string, permissoes?: string[]) => { sessao.atual = { user: { id, role, ...(permissoes ? { permissoes } : {}) } }; };

import { criarBanco, montarCenario, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { calcularIndicadores, type LinhaIndicador } from "@/lib/central-vendas/indicadores";
import { exigirResultado } from "@/lib/acao-resultado";
import * as acoes from "@/lib/actions/central-vendas";

let b: Banco;
let c: Cenario;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
beforeEach(async () => { c = await montarCenario(b); });
const ok = async <T,>(p: Promise<T | { erroAcao: string }>) => exigirResultado(await p);
const falha = async (p: Promise<unknown>) => ((await p) as { erroAcao?: string }).erroAcao ?? "";

describe("indicadores", () => {
  const d = (s: string) => new Date(s);
  const base: Omit<LinhaIndicador, "leadId"> = {
    nome: "x", criadoEm: d("2026-11-01T12:00:00Z"), origem: "instagram", campanha: null, produtoId: 1, operadorId: "op2", primeiraMensagemEm: null,
    primeiraRespostaEm: null, qualificadoEm: null, docsCompletosEm: null, enviadoAnaliseEm: null, decisaoEm: null,
    statusAtendimento: "novo", statusDocumental: "nao_iniciado", statusAnalise: "nao_enviado",
  };
  it("sem leads: tudo zero ou null (nada estimado)", () => {
    const i = calcularIndicadores([]);
    expect(i).toMatchObject({ recebidos: 0, taxaConversao: null, tempoPrimeiraRespostaMin: null, origens: [], atendimentosPorOperador: [] });
    expect(i.tempoMedioEtapasMin).toEqual({ entradaAteQualificacao: null, qualificacaoAteDocumentos: null, documentosAteDecisao: null });
  });
  it("batem com os dados de teste e respeitam os filtros", () => {
    const linhas: LinhaIndicador[] = [
      { ...base, leadId: "1", primeiraMensagemEm: d("2026-11-01T12:00:00Z"), primeiraRespostaEm: d("2026-11-01T12:02:00Z"), qualificadoEm: d("2026-11-01T13:00:00Z"),
        docsCompletosEm: d("2026-11-02T13:00:00Z"), enviadoAnaliseEm: d("2026-11-02T13:00:00Z"), decisaoEm: d("2026-11-03T13:00:00Z"), statusDocumental: "completo", statusAnalise: "aprovado" },
      { ...base, leadId: "2", primeiraMensagemEm: d("2026-11-01T12:00:00Z"), primeiraRespostaEm: d("2026-11-01T12:04:00Z"), qualificadoEm: d("2026-11-01T14:00:00Z"), statusDocumental: "parcial" },
      { ...base, leadId: "3", origem: "site", operadorId: "op3", produtoId: 2, statusDocumental: "completo", docsCompletosEm: d("2026-11-04T00:00:00Z"), enviadoAnaliseEm: d("2026-11-04T00:00:00Z"), statusAnalise: "pendente" },
      { ...base, leadId: "4", criadoEm: d("2026-10-01T12:00:00Z"), origem: null },
    ];
    const i = calcularIndicadores(linhas, { de: d("2026-11-01T00:00:00Z") });
    expect(i).toMatchObject({
      recebidos: 3, qualificados: 2, tempoPrimeiraRespostaMin: 3, aguardandoDocumentos: 1, documentacaoCompleta: 2, enviadosAnalise: 2,
      pendencias: 1, aprovados: 1, reprovados: 0, taxaConversao: 33.3,
      atendimentosPorOperador: [{ operadorId: "op2", total: 2 }, { operadorId: "op3", total: 1 }],
      origens: [{ origem: "instagram", total: 2 }, { origem: "site", total: 1 }],
    });
    expect(i.tempoMedioEtapasMin).toEqual({ entradaAteQualificacao: 90, qualificacaoAteDocumentos: 1440, documentosAteDecisao: 1440 });
    expect(calcularIndicadores(linhas, { operadorId: "op3" }).recebidos).toBe(1);
    expect(calcularIndicadores(linhas, { produtoId: 1, origem: "instagram" }).recebidos).toBe(2);
    expect(calcularIndicadores(linhas, { origem: "sem origem" }).recebidos).toBe(1);
  });
});

describe("ações da Central de Vendas", () => {
  let ana: string;
  beforeEach(async () => {
    ana = await c.novoLead({ nome: "Ana", telefone: "99988887777" });
    const bia = await c.novoLead({ nome: "Bia", telefone: "99911112222" });
    await c.prisma.lead.update({ where: { id: ana }, data: { origem: "instagram" } });
    await c.prisma.centralVendasLead.createMany({ data: [
      { leadId: ana, operadorId: U.olga, statusAnalise: "em_analise", enviadoAnaliseEm: c.relogio.agora },
      { leadId: bia, operadorId: U.otto },
    ] });
  });

  it("painel e CSV com dados reais; operadora vê só os próprios atendimentos; CSV sem telefone", async () => {
    como(U.admin, "admin");
    const p = await ok(acoes.painelCentralVendas({}));
    expect(p.indicadores).toMatchObject({ recebidos: 2, enviadosAnalise: 1, emAnalise: 1, aprovados: 0, taxaConversao: 0 });
    expect([...p.indicadores.atendimentosPorOperador].sort((x, y) => x.operadorId.localeCompare(y.operadorId))).toEqual([{ operadorId: U.olga, total: 1, nome: "Olga Operadora" }, { operadorId: U.otto, total: 1, nome: "Otto Operador" }]);
    como(U.olga, "colaborador", ["leads"]);
    expect((await ok(acoes.painelCentralVendas({ operadorId: U.otto }))).indicadores.recebidos).toBe(1);
    expect((await ok(acoes.atendimentosCentralVendas({}))).map(a => a.nome)).toEqual(["Ana"]);
    como(U.admin, "admin");
    const { csv } = await ok(acoes.exportarCsvCentralVendas({}));
    expect(csv.startsWith("﻿Lead;Nome;Entrada")).toBe(true);
    expect(csv).not.toContain("99988887777");
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("configurações, produtos, checklists, campanhas e templates: só o admin", async () => {
    como(U.olga, "colaborador", ["leads"]);
    expect(await falha(acoes.configuracaoCentralVendas())).toMatch(/administrador/);
    expect(await falha(acoes.salvarProdutoCentralVendas({ nome: "Produto X", tipo: "produto" }))).toMatch(/administrador/);
    // Operadora não decide a análise (não é analista).
    expect(await falha(acoes.registrarDecisaoCentralVendas({ leadId: ana, decisao: "aprovado" }))).toMatch(/analista/);
    como("corretor-1", "corretor");
    expect(await falha(acoes.painelCentralVendas({}))).toMatch(/permissão/);
    como(U.ivo, "colaborador", ["obras"]);
    expect(await falha(acoes.painelCentralVendas({}))).toMatch(/permissão/);
  });

  it("token de entrada é mostrado uma vez e fica cifrado; a tela só sabe que existe", async () => {
    como(U.admin, "admin");
    const { token } = await ok(acoes.gerarTokenCentralVendas("tokenSite"));
    expect(token.length).toBeGreaterThan(20);
    const cfg = await ok(acoes.configuracaoCentralVendas());
    expect(cfg.config.segredosDefinidos.tokenSite).toBe(true);
    expect(JSON.stringify(cfg)).not.toContain(token);
    expect((await c.prisma.centralVendasConfig.findFirst())?.dados).not.toContain(token);
  });

  it("produto, checklist, campanha com link wa.me e template validado", async () => {
    como(U.admin, "admin");
    await ok(acoes.salvarChecklistCentralVendas({ nome: "MCMV", itens: [{ chave: "rg", nome: "RG", tipo: "rg", obrigatorio: true }], ativo: true }));
    await ok(acoes.salvarProdutoCentralVendas({ nome: "Colina Park", tipo: "empreendimento", descricao: "", requisitos: "", condicoes: "", checklistId: 1, ativo: true }));
    expect((await ok(acoes.produtosCentralVendas()))[0]).toMatchObject({ slug: "colina-park", checklistId: 1 });
    expect(await ok(acoes.criarCampanhaCentralVendas({ canal: "Instagram", nome: "Lançamento", produtoId: 1 }))).toEqual({ codigo: "instagram-colina-park" });
    expect(await ok(acoes.criarCampanhaCentralVendas({ canal: "Instagram", nome: "Lançamento 2", produtoId: 1 }))).toEqual({ codigo: "instagram-colina-park-2" });
    const camp = await ok(acoes.campanhasCentralVendas());
    expect(camp.campanhas.map(k => k.link)).toContain("https://wa.me/5599900000000?text=Ol%C3%A1!%20%5Bref%3Ainstagram-colina-park%5D");
    expect(await falha(acoes.salvarTemplateCentralVendas({ slug: "cv-reativacao", conteudo: "Oi {{cpf}}" }))).toMatch(/Variáveis inválidas/);
    await ok(acoes.salvarTemplateCentralVendas({ slug: "cv-reativacao", conteudo: "Oi, {{nome}}! Vamos retomar?" }));
    expect((await ok(acoes.templatesCentralVendas())).find(t => t.slug === "cv-reativacao")).toMatchObject({ personalizado: true, conteudo: "Oi, {{nome}}! Vamos retomar?" });
    expect(await c.prisma.whatsappTemplate.findUnique({ where: { slug: "cv-reativacao" }, select: { finalidade: true } })).toEqual({ finalidade: "Central de Vendas" });
  });

  it("reprocessar só aceita falha/incerto e fica registrado", async () => {
    como(U.admin, "admin");
    const j = await c.prisma.centralVendasFila.create({ data: { chave: "j1", leadId: ana, status: "concluido" } });
    expect(await falha(acoes.reprocessarCentralVendas(j.id))).toMatch(/falha ou incertos/);
    await c.prisma.centralVendasFila.update({ where: { id: j.id }, data: { status: "falhou", tentativas: 5 } });
    await ok(acoes.reprocessarCentralVendas(j.id));
    expect(await c.prisma.centralVendasFila.findUnique({ where: { id: j.id }, select: { status: true, tentativas: true } })).toEqual({ status: "pendente", tentativas: 0 });
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "reprocessamento_manual" } })).toBe(1);
  });
});
