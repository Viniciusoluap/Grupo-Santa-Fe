// Lote 2, correção 03 (AD-06): Gerador de PCI — banco de dados (modelos versionados,
// rascunho, PCIs geradas). Chamar só depois de conferir o acesso (actions/rotas).
// Gêmeo de Prospecta/server/pci-gerador.ts. O envio de PCI da obra (./pci.ts) não muda.
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  LIMITE_MODELO_PCI_BYTES,
  MENSAGEM_XLSB_SO_LEITURA,
  formatoModeloPci,
  nomeArquivoPciGerada,
  normalizarFormularioPci,
  pendenciasPci,
  preencherPciAutomatico,
  type FormatoModeloPci,
  type FormularioPci,
} from "@/lib/pci-gerador";
import { gerarPdfPci, gerarPlanilhaPci, lerFormularioPci, validarModeloPci } from "@/lib/caixa/pci-gerador";
import { cidadeEstadoDoEndereco, coordenadasDaPci, coordenadasSalvas } from "@/lib/obra-localizacao";
import { listarEngenheiros } from "@/lib/engenheiros";
import { podeAcessarModulo, podeAdministrarSeguranca, type UsuarioAcesso } from "@/lib/perfis-acesso";

/** Gerador: admin ou colaborador com Obras (empreiteiro e corretor, não). Mesma regra do Prospecta. */
export const podeUsarGeradorPci = (u: UsuarioAcesso) => (u.perfil === "admin" || u.perfil === "colaborador") && podeAcessarModulo(u, "obras");
/** Modelos oficiais (Sub PCI atual, em Integrações): só admin ativo. */
export const podeGerenciarModelosPci = (u: Pick<UsuarioAcesso, "perfil" | "ativo">) => podeAdministrarSeguranca(u);

export class ErroGeradorPci extends Error {}

export type ModeloPciResumo = {
  id: string; versao: number; arquivo: string; formato: FormatoModeloPci; tamanho: number; atual: boolean;
  enviadoEm: Date; autor: string | null; observacao: string | null;
};

async function nomesDeUsuarios(ids: (string | null)[]): Promise<Map<string, string>> {
  const validos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!validos.length) return new Map();
  const us = await prisma.usuario.findMany({ where: { id: { in: validos } }, select: { id: true, nome: true } });
  return new Map(us.map((u) => [u.id, u.nome]));
}

export async function listarModelosPci(): Promise<ModeloPciResumo[]> {
  const ms = await prisma.pciModelo.findMany({
    orderBy: { versao: "desc" },
    select: { id: true, versao: true, nome: true, formato: true, tamanho: true, atual: true, enviadoEm: true, enviadoPorId: true, observacao: true },
  });
  const nomes = await nomesDeUsuarios(ms.map((m) => m.enviadoPorId));
  return ms.map((m) => ({ id: m.id, versao: m.versao, arquivo: m.nome, formato: m.formato as FormatoModeloPci, tamanho: m.tamanho, atual: m.atual, enviadoEm: m.enviadoEm, autor: m.enviadoPorId ? nomes.get(m.enviadoPorId) ?? null : null, observacao: m.observacao }));
}

export async function modeloAtualPci(): Promise<ModeloPciResumo | null> {
  return (await listarModelosPci()).find((m) => m.atual) ?? null;
}

export async function arquivoDoModeloPci(id: string) {
  return prisma.pciModelo.findUnique({ where: { id }, select: { nome: true, formato: true, versao: true, dados: true } });
}

export async function definirModeloAtualPci(id: string) {
  await prisma.$transaction(async (tx) => {
    const m = await tx.pciModelo.findUnique({ where: { id }, select: { id: true } });
    if (!m) throw new ErroGeradorPci("Modelo não encontrado.");
    await tx.pciModelo.updateMany({ where: { atual: true, id: { not: id } }, data: { atual: false } });
    await tx.pciModelo.update({ where: { id }, data: { atual: true } });
  });
}

/** Nova versão (vira a atual). O mesmo arquivo já enviado só volta a ser o atual. */
export async function gravarModeloPci(nome: string, bytes: Uint8Array, autorId: string, observacao: string | null) {
  if (!bytes.length || bytes.length > LIMITE_MODELO_PCI_BYTES) throw new ErroGeradorPci("Envie um modelo de até 8 MB.");
  let formato: FormatoModeloPci;
  try {
    formato = formatoModeloPci(nome, bytes);
    validarModeloPci(bytes, formato);
  } catch (e) {
    throw new ErroGeradorPci(e instanceof Error ? e.message : "Modelo inválido.");
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  const igual = await prisma.pciModelo.findFirst({ where: { hash }, select: { id: true, versao: true } });
  if (igual) {
    await definirModeloAtualPci(igual.id);
    return { id: igual.id, versao: igual.versao, formato, repetido: true };
  }
  const novo = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE pci_modelos IN SHARE ROW EXCLUSIVE MODE`;
    const max = await tx.pciModelo.aggregate({ _max: { versao: true } });
    await tx.pciModelo.updateMany({ where: { atual: true }, data: { atual: false } });
    return tx.pciModelo.create({
      data: { versao: (max._max.versao ?? 0) + 1, nome, formato, tamanho: bytes.length, hash, dados: new Uint8Array(bytes), atual: true, observacao, enviadoPorId: autorId },
      select: { id: true, versao: true },
    });
  });
  return { id: novo.id, versao: novo.versao, formato, repetido: false };
}

// ─── formulário da obra ──────────────────────────────────────────────────────

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function obraDoGerador(obraId: string) {
  const o = await prisma.obra.findUnique({
    where: { id: obraId },
    select: {
      id: true, nome: true, endereco: true, area: true, vgv: true, custoTerreno: true, financiamentoCef: true, dataInicio: true, dataPrevisaoFim: true,
      clienteNome: true, clienteTel: true, latitude: true, longitude: true,
      leadVinculado: { select: { nome: true, cpf: true, email: true, telefone: true } },
      imovel: { select: { latitude: true, longitude: true } },
      pci: { select: { vinculadaEm: true, versao: { select: { dados: true, parsed: true } } } },
    },
  });
  if (!o) throw new ErroGeradorPci("Obra não encontrada.");
  return o;
}

/** Pré-preenchimento com o que o sistema já sabe da obra (sem inventar). */
export async function preenchimentoAutomaticoPci(obraId: string): Promise<FormularioPci> {
  const o = await obraDoGerador(obraId);
  let pci: FormularioPci | null = null;
  if (o.pci) {
    try { pci = lerFormularioPci(new Uint8Array(o.pci.versao.dados)); } catch { pci = null; }
  }
  const local = cidadeEstadoDoEndereco(o.endereco);
  const id = (o.pci?.versao.parsed as { identificacao?: { latitude?: unknown; longitude?: unknown } } | null)?.identificacao;
  const coordenadas = coordenadasSalvas(o.imovel?.latitude, o.imovel?.longitude)
    ?? coordenadasSalvas(o.latitude, o.longitude)
    ?? (id ? coordenadasDaPci(id.latitude, id.longitude) : null);
  const lead = o.leadVinculado;
  return preencherPciAutomatico({
    obra: {
      titulo: o.nome, endereco: o.endereco, cidade: local?.cidade ?? null, uf: local?.estado ?? null, area: num(o.area),
      valorImovel: num(o.vgv), valorTerreno: num(o.custoTerreno), valorFinanciado: num(o.financiamentoCef),
      inicio: iso(o.dataInicio), termino: iso(o.dataPrevisaoFim),
    },
    cliente: lead
      ? { nome: lead.nome, cpf: lead.cpf, email: lead.email, telefone: lead.telefone, endereco: null, bairro: null }
      : { nome: o.clienteNome || null, cpf: null, email: null, telefone: o.clienteTel || null, endereco: null, bairro: null },
    coordenadas,
    pci,
  });
}

export async function historicoPci(obraId: string) {
  const gs = await prisma.pciGerada.findMany({
    where: { obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { id: true, modeloVersao: true, planilhaNome: true, planilhaFormato: true, pdfNome: true, avisos: true, criadoEm: true, criadoPorId: true },
  });
  const nomes = await nomesDeUsuarios(gs.map((g) => g.criadoPorId));
  return gs.map((g) => ({
    id: g.id, modeloVersao: g.modeloVersao, planilha: g.planilhaNome, formato: g.planilhaFormato, pdf: g.pdfNome,
    avisos: Array.isArray(g.avisos) ? (g.avisos as string[]) : [], geradoEm: g.criadoEm.toISOString(), autor: g.criadoPorId ? nomes.get(g.criadoPorId) ?? null : null,
  }));
}

export async function salvarRascunhoPci(obraId: string, entrada: unknown, autorId: string) {
  await obraDoGerador(obraId);
  const form = normalizarFormularioPci(entrada);
  const dados = form as unknown as Prisma.InputJsonValue;
  await prisma.pciGeradorRascunho.upsert({
    where: { obraId },
    create: { obraId, dados, atualizadoPorId: autorId },
    update: { dados, atualizadoPorId: autorId, atualizadoEm: new Date() },
  });
  return { form, pendencias: pendenciasPci(form) };
}

/** Dados da aba "Gerador de PCI" do Editar Obra. */
export async function carregarGeradorPci(obraId: string) {
  await obraDoGerador(obraId);
  const rascunho = await prisma.pciGeradorRascunho.findUnique({ where: { obraId } });
  const modelo = await modeloAtualPci();
  const formulario = rascunho ? normalizarFormularioPci(rascunho.dados) : await preenchimentoAutomaticoPci(obraId);
  const autor = rascunho?.atualizadoPorId ? (await nomesDeUsuarios([rascunho.atualizadoPorId])).get(rascunho.atualizadoPorId) ?? null : null;
  const engenheiros = (await listarEngenheiros()).map((e) => ({ id: e.id, nome: e.nome, email: e.email, telefone: e.telefone, crea: e.crea, creaUf: e.creaUf, engenheiro: e.engenheiro }));
  return {
    modelo: modelo ? { versao: modelo.versao, arquivo: modelo.arquivo, formato: modelo.formato, enviadoEm: modelo.enviadoEm.toISOString() } : null,
    avisoModelo: !modelo ? "Nenhum modelo de PCI cadastrado. O admin envia o modelo oficial em Integrações › Sub PCI atual." : modelo.formato === "xlsb" ? MENSAGEM_XLSB_SO_LEITURA : null,
    formulario,
    origem: rascunho ? ("rascunho" as const) : ("automatico" as const),
    rascunhoEm: rascunho ? rascunho.atualizadoEm.toISOString() : null,
    rascunhoAutor: autor,
    engenheiros,
    historico: await historicoPci(obraId),
  };
}
export type DadosGeradorPci = Awaited<ReturnType<typeof carregarGeradorPci>>;

export async function gerarPciDaObra(obraId: string, entrada: unknown, autor: { id: string; nome: string | null }) {
  const form = normalizarFormularioPci(entrada);
  const obra = await obraDoGerador(obraId);
  const atual = await modeloAtualPci();
  if (!atual) throw new ErroGeradorPci("Nenhum modelo de PCI cadastrado. Envie o modelo oficial em Integrações › Sub PCI atual.");
  if (atual.formato === "xlsb") throw new ErroGeradorPci(MENSAGEM_XLSB_SO_LEITURA);
  const modelo = await arquivoDoModeloPci(atual.id);
  if (!modelo) throw new ErroGeradorPci("Modelo não encontrado.");
  await salvarRascunhoPci(obraId, form, autor.id);
  let planilha;
  try {
    planilha = gerarPlanilhaPci(new Uint8Array(modelo.dados), modelo.formato as FormatoModeloPci, form);
  } catch (e) {
    throw new ErroGeradorPci(e instanceof Error ? e.message : "Não foi possível preencher o modelo.");
  }
  const agora = new Date();
  const pdf = gerarPdfPci(form, { obraTitulo: obra.nome, modeloVersao: modelo.versao, modeloArquivo: modelo.nome, geradoEm: agora, autor: autor.nome });
  const g = await prisma.pciGerada.create({
    data: {
      obraId, modeloId: atual.id, modeloVersao: modelo.versao, dados: form as unknown as Prisma.InputJsonValue, avisos: planilha.avisos,
      planilhaNome: nomeArquivoPciGerada(form.campos.proponenteNome, obra.nome, modelo.versao, planilha.formato), planilhaFormato: planilha.formato,
      planilha: new Uint8Array(planilha.bytes), pdfNome: nomeArquivoPciGerada(form.campos.proponenteNome, obra.nome, modelo.versao, "pdf"),
      pdf: new Uint8Array(pdf), criadoPorId: autor.id, criadoEm: agora,
    },
    select: { id: true },
  });
  return { id: g.id, avisos: planilha.avisos, pendencias: pendenciasPci(form) };
}

export async function arquivoPciGerada(obraId: string, id: string, tipo: "planilha" | "pdf") {
  const g = await prisma.pciGerada.findFirst({ where: { id, obraId }, select: { planilhaNome: true, planilhaFormato: true, planilha: tipo === "planilha", pdfNome: true, pdf: tipo === "pdf" } });
  if (!g) return null;
  return tipo === "pdf"
    ? { nome: g.pdfNome, formato: "pdf", bytes: new Uint8Array(g.pdf!) }
    : { nome: g.planilhaNome, formato: g.planilhaFormato, bytes: new Uint8Array(g.planilha!) };
}
