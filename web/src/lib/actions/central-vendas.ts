"use server";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo do router tRPC `centralVendas` em
// Prospecta/server/central-vendas/router.ts). Faz parte do módulo CRM (`leads`), sem módulo novo no painel.
// Configurações, produtos, checklists, sequências, campanhas, templates, auditoria e fila: só administrador.
// Operador (colaborador) vê só os próprios atendimentos. A decisão da análise exige admin ou analista da Central.
// Erros voltam como dado ({ erroAcao }) para a tela mostrar a mensagem em português.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao, type UsuarioDaSessao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { VARIAVEIS_TEMPLATE_PERMITIDAS } from "@/lib/whatsapp/templates";
import {
  DECISOES_ANALISE, STATUS_ATENDIMENTO, TIPOS_SEQUENCIA, configParaTela, configSchema, itemChecklistSchema, lerItensChecklist, lerPassos,
  passoSequenciaSchema,
} from "@/lib/central-vendas/config";
import { calcularIndicadores, csvCentral, filtrar, type LinhaIndicador } from "@/lib/central-vendas/indicadores";
import { ROTULOS_MOTIVO, linkCampanha, slug } from "@/lib/central-vendas/regras";
import { CATEGORIA_TEMPLATES_CENTRAL, TEMPLATES_CENTRAL } from "@/lib/central-vendas/templates";
import { DecisaoInvalida, podeDecidir, registrarDecisao } from "@/lib/central-vendas/analise";
import { agora, carregarConfig, cifrar, registrarEvento, salvarConfig } from "@/lib/central-vendas/base";
import { executarRotinaCentralVendas, rotinaSeNecessario } from "@/lib/central-vendas/rotina";

const ehAdmin = (u: UsuarioDaSessao) => u.perfil === "admin";
/** Equipe com o módulo CRM (admin ou colaborador; corretor fica de fora). */
const equipe = () => exigirModuloAcao("leads", { somenteEquipe: true });
async function admin() {
  const u = await equipe();
  if (!ehAdmin(u)) throw new Error("Só o administrador altera a Central de Vendas.");
  return u;
}
const atualizarTela = () => revalidatePath("/admin/central-vendas");

const filtrosSchema = z.object({
  de: z.string().date().optional().nullable(), ate: z.string().date().optional().nullable(),
  operadorId: z.string().max(40).optional().nullable(), produtoId: z.number().int().positive().optional().nullable(),
  origem: z.string().max(100).optional().nullable(),
}).default({});
type Filtros = z.input<typeof filtrosSchema>;

async function linhasIndicador(): Promise<LinhaIndicador[]> {
  const rows = await prisma.centralVendasLead.findMany({ where: { lead: { excluidoEm: null } }, include: { lead: { select: { nome: true, origem: true } } } });
  return rows.map(({ lead, ...cv }) => ({
    leadId: cv.leadId, nome: lead.nome, criadoEm: cv.criadoEm, origem: lead.origem ?? cv.origem, campanha: cv.campanha, produtoId: cv.produtoId,
    operadorId: cv.operadorId, primeiraMensagemEm: cv.primeiraMensagemEm, primeiraRespostaEm: cv.primeiraRespostaEm,
    qualificadoEm: cv.qualificadoEm, docsCompletosEm: cv.docsCompletosEm, enviadoAnaliseEm: cv.enviadoAnaliseEm, decisaoEm: cv.decisaoEm,
    statusAtendimento: cv.statusAtendimento, statusDocumental: cv.statusDocumental, statusAnalise: cv.statusAnalise,
  }));
}

/** Datas do filtro no fuso de Fortaleza (início e fim do dia). Operador vê só os próprios atendimentos. */
function filtrosEfetivos(u: UsuarioDaSessao, entrada: Filtros) {
  const f = filtrosSchema.parse(entrada ?? {});
  return {
    de: f.de ? new Date(`${f.de}T00:00:00-03:00`) : null, ate: f.ate ? new Date(`${f.ate}T23:59:59.999-03:00`) : null,
    operadorId: ehAdmin(u) ? f.operadorId ?? null : u.id, produtoId: f.produtoId ?? null, origem: f.origem ?? null,
  };
}

async function nomes() {
  const [us, ps] = await Promise.all([
    prisma.usuario.findMany({ where: { papel: { in: ["admin", "colaborador"] } }, select: { id: true, nome: true } }),
    prisma.centralVendasProduto.findMany({ select: { id: true, nome: true } }),
  ]);
  return { operadores: new Map(us.map(u => [u.id, u.nome])), produtos: new Map(ps.map(p => [p.id, p.nome])) };
}

async function exigirLeadVisivel(u: UsuarioDaSessao, leadId: string) {
  const cv = await prisma.centralVendasLead.findUnique({ where: { leadId }, select: { operadorId: true } });
  if (!cv) throw new Error("Atendimento não encontrado na Central.");
  if (!ehAdmin(u) && cv.operadorId !== u.id) throw new Error("Atendimento de outro operador.");
}

async function conexaoAtiva() {
  return prisma.conexaoWhatsApp.findFirst({ where: { provedor: "evolution", status: "conectado" }, orderBy: { criadoEm: "asc" }, select: { numero: true } });
}

const num = (v: { toString(): string } | null) => (v == null ? null : Number(v.toString()));

// ── Painel, CSV e atendimentos ──

export async function painelCentralVendas(entrada: Filtros = {}) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    await rotinaSeNecessario().catch(() => null); // SLA e fila em dia ao abrir o painel
    const f = filtrosEfetivos(u, entrada);
    const todas = await linhasIndicador();
    const n = await nomes();
    const ind = calcularIndicadores(todas, f);
    return {
      indicadores: { ...ind, atendimentosPorOperador: ind.atendimentosPorOperador.map(o => ({ ...o, nome: n.operadores.get(o.operadorId) ?? "Usuário" })) },
      opcoes: {
        operadores: ehAdmin(u) ? Array.from(new Set(todas.map(t => t.operadorId).filter((x): x is string => x != null))).map(id => ({ id, nome: n.operadores.get(id) ?? "Usuário" })) : [],
        produtos: Array.from(n.produtos.entries()).map(([id, nome]) => ({ id, nome })),
        origens: Array.from(new Set(todas.map(t => t.origem ?? "sem origem"))).sort(),
      },
      ativo: (await carregarConfig()).ativo,
      admin: ehAdmin(u),
    };
  });
}

export async function exportarCsvCentralVendas(entrada: Filtros = {}) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    const linhas = filtrar(await linhasIndicador(), filtrosEfetivos(u, entrada)).sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
    return { csv: csvCentral(linhas, await nomes()), total: linhas.length };
  });
}

export async function atendimentosCentralVendas(entrada: { status?: string; analise?: string } = {}) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    const p = z.object({ status: z.enum(STATUS_ATENDIMENTO).optional(), analise: z.string().max(20).optional() }).parse(entrada ?? {});
    const decide = await podeDecidir(u.id);
    // Operador vê os próprios; analista vê também os que aguardam a decisão dele.
    const visiveis = ehAdmin(u) ? {} : { OR: [{ operadorId: u.id }, ...(decide ? [{ statusAnalise: { in: ["em_analise", "pendente"] } }] : [])] };
    const rows = await prisma.centralVendasLead.findMany({
      where: { lead: { excluidoEm: null }, ...visiveis, ...(p.status ? { statusAtendimento: p.status } : {}), ...(p.analise ? { statusAnalise: p.analise } : {}) },
      include: { lead: { select: { nome: true, origem: true } } }, orderBy: { atualizadoEm: "desc" }, take: 300,
    });
    const n = await nomes();
    return rows.map(({ lead, ...cv }) => ({
      leadId: cv.leadId, nome: lead.nome, cidade: cv.cidade, origem: lead.origem ?? cv.origem, campanha: cv.campanha,
      operador: cv.operadorId ? n.operadores.get(cv.operadorId) ?? null : null, operadorId: cv.operadorId,
      statusAtendimento: cv.statusAtendimento, statusDocumental: cv.statusDocumental, statusAnalise: cv.statusAnalise,
      motivo: cv.motivoTransferencia ? ROTULOS_MOTIVO[cv.motivoTransferencia as keyof typeof ROTULOS_MOTIVO] ?? cv.motivoTransferencia : null,
      resumo: cv.resumoTransferencia, pendencias: cv.pendenciasAnalise, motivoReprovacao: cv.motivoReprovacao, optOut: cv.optOut, atualizadoEm: cv.atualizadoEm,
      podeDecidir: decide && (cv.statusAnalise === "em_analise" || cv.statusAnalise === "pendente"),
    }));
  });
}

export async function registrarDecisaoCentralVendas(entrada: { leadId: string; decisao: string; pendencias?: string; motivoInterno?: string }) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    const p = z.object({ leadId: z.string().min(1).max(40), decisao: z.enum(DECISOES_ANALISE), pendencias: z.string().max(2000).optional(), motivoInterno: z.string().max(2000).optional() }).parse(entrada);
    try { const r = await registrarDecisao({ ...p, userId: u.id }); atualizarTela(); return r; }
    catch (e) { if (e instanceof DecisaoInvalida) throw new Error(e.message); throw e; }
  });
}

export async function encerrarAtendimentoCentralVendas(leadId: string) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    await exigirLeadVisivel(u, leadId);
    await prisma.centralVendasLead.update({ where: { leadId }, data: { statusAtendimento: "encerrado", atualizadoEm: agora() } });
    await registrarEvento({ tipo: "encerrado", leadId, origem: "humano", payload: { por: u.id } });
    atualizarTela();
    return { ok: true };
  });
}

/** Volta a permitir mensagens automáticas (opt-out) — decisão humana, registrada. */
export async function reativarAutomacaoCentralVendas(leadId: string) {
  return capturarErroAcao(async () => {
    const u = await equipe();
    await exigirLeadVisivel(u, leadId);
    await prisma.centralVendasLead.update({ where: { leadId }, data: { optOut: false, optOutEm: null, atualizadoEm: agora() } });
    await registrarEvento({ tipo: "opt_out_removido", leadId, origem: "humano", payload: { por: u.id } });
    atualizarTela();
    return { ok: true };
  });
}

// ── Configurações (só admin) ──

export async function configuracaoCentralVendas() {
  return capturarErroAcao(async () => {
    await admin();
    const c = await carregarConfig();
    const pessoas = await prisma.usuario.findMany({ where: { ativo: true, papel: { in: ["admin", "colaborador"] } }, orderBy: { nome: "asc" }, select: { id: true, nome: true, papel: true } });
    const conn = await conexaoAtiva();
    return { config: configParaTela(c), pessoas, numeroConexao: conn?.numero ?? null };
  });
}

const configSemSegredos = configSchema.omit({ segredos: true });
export async function salvarConfiguracaoCentralVendas(entrada: z.input<typeof configSemSegredos>) {
  return capturarErroAcao(async () => {
    const u = await admin();
    const input = configSemSegredos.parse(entrada);
    if (input.intervaloMaxSeg < input.intervaloMinSeg) throw new Error("O intervalo máximo precisa ser maior que o mínimo.");
    const atual = await carregarConfig();
    await salvarConfig({ ...input, segredos: atual.segredos }, u.id);
    await registrarEvento({ tipo: "configuracao_alterada", origem: "humano", payload: { por: u.id, ativo: input.ativo, modoTeste: input.modoTeste, logyca: input.logyca.ativo } });
    atualizarTela();
    return { ok: true };
  });
}

/** Gera um token de entrada novo (site ou Logyca). É mostrado uma única vez; fica cifrado no banco. */
export async function gerarTokenCentralVendas(nome: "tokenSite" | "tokenLogycaEntrada") {
  return capturarErroAcao(async () => {
    const u = await admin();
    const n = z.enum(["tokenSite", "tokenLogycaEntrada"]).parse(nome);
    const token = randomBytes(24).toString("base64url");
    const c = await carregarConfig();
    await salvarConfig({ ...c, segredos: { ...c.segredos, [n]: cifrar(token) } }, u.id);
    await registrarEvento({ tipo: "token_gerado", origem: "humano", payload: { nome: n, por: u.id } });
    return { token };
  });
}

/** Token de envio da Logyca ou chave própria da IA: entram cifrados e nunca voltam para a tela. */
export async function definirSegredoCentralVendas(nome: "tokenLogycaEnvio" | "chaveAnthropic", valor: string) {
  return capturarErroAcao(async () => {
    const u = await admin();
    const p = z.object({ nome: z.enum(["tokenLogycaEnvio", "chaveAnthropic"]), valor: z.string().trim().max(500) }).parse({ nome, valor });
    const c = await carregarConfig();
    const segredos = { ...c.segredos };
    if (p.valor) segredos[p.nome] = cifrar(p.valor); else delete segredos[p.nome];
    await salvarConfig({ ...c, segredos }, u.id);
    await registrarEvento({ tipo: p.valor ? "segredo_definido" : "segredo_removido", origem: "humano", payload: { nome: p.nome, por: u.id } });
    return { ok: true };
  });
}

// ── Base de produtos/empreendimentos (a IA só fala o que está aqui) ──

export async function produtosCentralVendas() {
  return capturarErroAcao(async () => {
    await equipe();
    const rows = await prisma.centralVendasProduto.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
    return rows.map(p => ({ ...p, precoMin: num(p.precoMin), precoMax: num(p.precoMax) }));
  });
}

const produtoSchema = z.object({
  id: z.number().int().positive().optional(), nome: z.string().trim().min(2).max(160), slug: z.string().trim().max(80).optional(),
  tipo: z.enum(["empreendimento", "produto"]), descricao: z.string().max(4000).default(""), cidade: z.string().trim().max(100).optional().nullable(),
  precoMin: z.number().min(0).max(1e10).optional().nullable(), precoMax: z.number().min(0).max(1e10).optional().nullable(),
  requisitos: z.string().max(4000).default(""), condicoes: z.string().max(4000).default(""),
  checklistId: z.number().int().positive().optional().nullable(), ativo: z.boolean().default(true),
});
export async function salvarProdutoCentralVendas(entrada: z.input<typeof produtoSchema>) {
  return capturarErroAcao(async () => {
    await admin();
    const input = produtoSchema.parse(entrada);
    const dados = {
      nome: input.nome, slug: slug(input.slug || input.nome), tipo: input.tipo, descricao: input.descricao, cidade: input.cidade || null,
      precoMin: input.precoMin != null ? input.precoMin.toFixed(2) : null, precoMax: input.precoMax != null ? input.precoMax.toFixed(2) : null,
      requisitos: input.requisitos, condicoes: input.condicoes, checklistId: input.checklistId ?? null, ativo: input.ativo, atualizadoEm: agora(),
    };
    if (!dados.slug) throw new Error("Informe um código (letras e números).");
    try {
      if (input.id) await prisma.centralVendasProduto.update({ where: { id: input.id }, data: dados });
      else await prisma.centralVendasProduto.create({ data: dados });
    } catch { throw new Error("Já existe um produto com esse código."); }
    atualizarTela();
    return { ok: true };
  });
}

// ── Checklists por produto/modalidade ──

export async function checklistsCentralVendas() {
  return capturarErroAcao(async () => {
    await equipe();
    return (await prisma.centralVendasChecklist.findMany({ orderBy: { nome: "asc" } })).map(c => ({ ...c, itens: lerItensChecklist(c.documentos) }));
  });
}

const checklistSchema = z.object({
  id: z.number().int().positive().optional(), nome: z.string().trim().min(2).max(120), slug: z.string().trim().max(60).optional(),
  itens: z.array(itemChecklistSchema).min(1).max(40), ativo: z.boolean().default(true),
});
export async function salvarChecklistCentralVendas(entrada: z.input<typeof checklistSchema>) {
  return capturarErroAcao(async () => {
    await admin();
    const input = checklistSchema.parse(entrada);
    if (new Set(input.itens.map(i => i.chave)).size !== input.itens.length) throw new Error("Cada documento precisa de uma chave diferente.");
    const dados = { nome: input.nome, slug: slug(input.slug || input.nome), documentos: JSON.stringify(input.itens), ativo: input.ativo, atualizadoEm: agora() };
    try {
      if (input.id) await prisma.centralVendasChecklist.update({ where: { id: input.id }, data: dados });
      else await prisma.centralVendasChecklist.create({ data: dados });
    } catch { throw new Error("Já existe um checklist com esse código."); }
    atualizarTela();
    return { ok: true };
  });
}

// ── Sequências (follow-up, sem resposta, reativação) ──

export async function sequenciasCentralVendas() {
  return capturarErroAcao(async () => {
    await equipe();
    return (await prisma.centralVendasSequencia.findMany({ orderBy: { tipo: "asc" } })).map(s => ({ ...s, passosLista: lerPassos(s.passos) }));
  });
}

const sequenciaSchema = z.object({
  id: z.number().int().positive().optional(), tipo: z.enum(TIPOS_SEQUENCIA), nome: z.string().trim().min(2).max(120),
  passos: z.array(passoSequenciaSchema).min(1).max(10), ativo: z.boolean().default(true),
});
export async function salvarSequenciaCentralVendas(entrada: z.input<typeof sequenciaSchema>) {
  return capturarErroAcao(async () => {
    await admin();
    const input = sequenciaSchema.parse(entrada);
    const dados = { tipo: input.tipo, nome: input.nome, passos: JSON.stringify(input.passos), ativo: input.ativo, atualizadoEm: agora() };
    if (input.id) await prisma.centralVendasSequencia.update({ where: { id: input.id }, data: dados });
    else await prisma.centralVendasSequencia.create({ data: dados });
    atualizarTela();
    return { ok: true };
  });
}

// ── Campanhas e gerador de links wa.me ──

export async function campanhasCentralVendas() {
  return capturarErroAcao(async () => {
    await equipe();
    const c = await carregarConfig();
    const conn = await conexaoAtiva();
    const numero = c.numeroCampanhas || conn?.numero || "";
    const rows = await prisma.centralVendasCampanha.findMany({ orderBy: { criadoEm: "desc" } });
    return { numero, campanhas: rows.map(r => ({ ...r, link: numero ? linkCampanha(numero, r.codigo) : null })) };
  });
}

export async function criarCampanhaCentralVendas(entrada: { canal: string; nome: string; produtoId?: number | null }) {
  return capturarErroAcao(async () => {
    await admin();
    const input = z.object({ canal: z.string().trim().min(2).max(60), nome: z.string().trim().min(2).max(160), produtoId: z.number().int().positive().optional().nullable() }).parse(entrada);
    const p = input.produtoId ? await prisma.centralVendasProduto.findUnique({ where: { id: input.produtoId }, select: { slug: true } }) : null;
    const base = slug([input.canal, p?.slug].filter(Boolean).join("-")) || "campanha";
    const existentes = new Set((await prisma.centralVendasCampanha.findMany({ where: { codigo: { startsWith: base } }, select: { codigo: true } })).map(r => r.codigo));
    let codigo = base;
    for (let i = 2; existentes.has(codigo); i++) codigo = `${base}-${i}`;
    await prisma.centralVendasCampanha.create({ data: { codigo, canal: slug(input.canal), nome: input.nome, produtoId: input.produtoId ?? null, criadoEm: agora() } });
    atualizarTela();
    return { codigo };
  });
}

// ── Templates (whatsapp_templates, slug cv-*) ──

export async function templatesCentralVendas() {
  return capturarErroAcao(async () => {
    await equipe();
    const rows = await prisma.whatsappTemplate.findMany({ where: { slug: { startsWith: "cv-" } } });
    return TEMPLATES_CENTRAL.map(t => {
      const r = rows.find(x => x.slug === t.slug);
      return { slug: t.slug, nome: t.nome, conteudo: r?.conteudo ?? t.conteudo, personalizado: Boolean(r), ativo: r?.ativo ?? true };
    });
  });
}

export async function salvarTemplateCentralVendas(entrada: { slug: string; conteudo: string }) {
  return capturarErroAcao(async () => {
    const u = await admin();
    const input = z.object({ slug: z.string().regex(/^cv-[a-z0-9-]+$/), conteudo: z.string().trim().min(2).max(4096) }).parse(entrada);
    const t = TEMPLATES_CENTRAL.find(x => x.slug === input.slug);
    if (!t) throw new Error("Template da Central não encontrado.");
    const invalidas = Array.from(input.conteudo.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)).map(m => m[1].toLowerCase()).filter(v => !VARIAVEIS_TEMPLATE_PERMITIDAS.has(v));
    if (invalidas.length) throw new Error(`Variáveis inválidas: ${Array.from(new Set(invalidas)).map(v => `{{${v}}}`).join(", ")}.`);
    await prisma.whatsappTemplate.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, nome: t.nome, finalidade: CATEGORIA_TEMPLATES_CENTRAL, conteudo: input.conteudo, criadoPorId: u.id, atualizadoPorId: u.id },
      update: { conteudo: input.conteudo, ativo: true, atualizadoPorId: u.id },
    });
    atualizarTela();
    return { ok: true };
  });
}

// ── Auditoria e fila ──

export async function auditoriaCentralVendas(leadId?: string) {
  return capturarErroAcao(async () => {
    await admin();
    const where = leadId ? { leadId } : {};
    const [eventos, fila] = await Promise.all([
      prisma.centralVendasEvento.findMany({ where, orderBy: { id: "desc" }, take: 200 }),
      prisma.centralVendasFila.findMany({
        where, orderBy: { id: "desc" }, take: 200,
        select: { id: true, tipo: true, leadId: true, status: true, tentativas: true, proximaTentativaEm: true, ultimoErro: true, proativa: true, criadoEm: true },
      }),
    ]);
    return { eventos, fila };
  });
}

/** Recoloca na fila um item "falhou" ou "incerto" (decisão humana: "incerto" pode já ter saído). */
export async function reprocessarCentralVendas(id: number) {
  return capturarErroAcao(async () => {
    const u = await admin();
    const jobId = z.number().int().positive().parse(id);
    const r = await prisma.centralVendasFila.updateMany({
      where: { id: jobId, status: { in: ["falhou", "incerto"] } },
      data: { status: "pendente", tentativas: 0, proximaTentativaEm: agora(), atualizadoEm: agora() },
    });
    if (!r.count) throw new Error("Só itens com falha ou incertos podem ser reprocessados.");
    const job = await prisma.centralVendasFila.findUnique({ where: { id: jobId }, select: { leadId: true } });
    await registrarEvento({ tipo: "reprocessamento_manual", leadId: job?.leadId ?? null, origem: "humano", payload: { job: jobId, por: u.id } });
    return { ok: true };
  });
}

export async function executarRotinaAgoraCentralVendas() {
  return capturarErroAcao(async () => {
    await admin();
    return executarRotinaCentralVendas({ limiteMs: 20_000 });
  });
}
