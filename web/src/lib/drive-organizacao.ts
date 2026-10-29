import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { ErroDrive } from "@/lib/drive-erro";
import { DOCUMENTOS_CLIENTE } from "@/lib/documentos-cliente-padrao";
import {
  caminhoCliente, caminhoEquipe, caminhoFotosObra, caminhoGeradorPci, caminhoMedicoesObra, caminhoModeloPci, caminhoOrcamentoEstudo,
  caminhoWhatsappCliente, caminhoWhatsappSemCliente, entidadeDaChave, nomeArquivo, nomeDocumentoEquipe, nomeFotoObra, nomeMidiaWhatsapp,
  nomeModeloPci, nomePciGerada, nomePlanilhaOrcamento, TOPOS_ORFAOS, type PastaAlvo, type PrefixoEntidade,
} from "@/lib/drive-estrutura";
import { destinoDocumentoEstudo, numeroCurto } from "@/lib/drive-pastas";
import {
  buscarArquivoNoCaminho, driveRegistroConfigurado, enviarArquivoNoCaminho, enviarParaLixeira, enviarPastaParaLixeira,
  listarSubpastasDoSistema, moverArquivoParaCaminho, type CachePastas,
} from "@/lib/incorporacao/registro-drive";

// Pedido de 29/10 (SPEC-DRIVE-ORGANIZACAO.md; gêmeo da Prospecta): todo arquivo do
// sistema ganha uma cópia organizada no Google Drive, exclusões levam a pasta/arquivo
// para a lixeira do Drive (30 dias, nunca exclusão permanente) e o sincronizador
// "Organizar Drive" reconcilia o que ficou para trás, em lotes e com prazo.
// Logs: só tipo/contagens e a etapa do erro do Google — nunca nomes ou documentos.

// ─── Tipos de arquivo ───────────────────────────────────────────────────────

/** Um arquivo do sistema e onde ele deve ficar no Drive. */
export interface ArquivoSistema {
  /** Linha do banco (o cursor do sincronizador avança por linha). */
  linha: string;
  fileId: string | null;
  caminho: PastaAlvo[];
  nome: string;
  mime: string;
  /** Antes de enviar, procura no destino um arquivo com o mesmo nome (cópias antigas sem ID gravado). */
  adotarPorNome?: boolean;
  bytes: () => Promise<Buffer | null>;
  /** Grava o ID; false quando outro processo já gravou (a cópia nova vai para a lixeira). */
  gravar: (fileId: string) => Promise<boolean>;
  /** Arquivo sumiu do Drive mas os bytes seguem no banco: zera o ID para reenviar. */
  esquecer?: () => Promise<void>;
}

interface Lote { ultimo: string | null; itens: ArquivoSistema[] }
interface OpcoesLote { depoisDe: string | null; lote: number; pendentes: boolean; ids?: string[] }
interface TipoArquivo { tipo: TipoCopia; lote(o: OpcoesLote): Promise<Lote> }

export type TipoCopia = "documentoUsuario" | "pciModelo" | "pciGerada" | "pciVersao" | "arquivo" | "whatsapp" | "documentoRegistro";

const filtroLinha = (campo: string, o: OpcoesLote) => ({
  ...(o.depoisDe ? { [campo]: { gt: o.depoisDe } } : {}),
  ...(o.ids ? { [campo]: { in: o.ids, ...(o.depoisDe ? { gt: o.depoisDe } : {}) } } : {}),
});

const pdf = "application/pdf";
function mimePlanilha(formato: string): string {
  switch (formato.toLowerCase()) {
    case "xlsb": return "application/vnd.ms-excel.sheet.binary.macroEnabled.12";
    case "xlsm": return "application/vnd.ms-excel.sheet.macroEnabled.12";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf": return pdf;
    default: return "application/vnd.ms-excel";
  }
}
const extensao = (nome: string) => /\.([a-z0-9]{1,5})$/i.exec(nome)?.[1] ?? "";
const buf = (b: Uint8Array | null | undefined) => (b ? Buffer.from(b) : null);
const ultimoDe = <T>(linhas: T[], id: (l: T) => string) => (linhas.length ? id(linhas[linhas.length - 1]) : null);
const entidade = (id: string, nome: string | null | undefined) => ({ id, numero: numeroCurto(id), nome: nome ?? null });

const documentoUsuario: TipoArquivo = {
  tipo: "documentoUsuario",
  async lote(o) {
    const linhas = await prisma.documentoUsuario.findMany({
      where: { ...filtroLinha("id", o), driveFileId: o.pendentes ? null : { not: null } },
      orderBy: { id: "asc" }, take: o.lote,
      select: { id: true, categoria: true, nomeOriginal: true, mime: true, enviadoEm: true, driveFileId: true, usuarioId: true, usuario: { select: { nome: true } } },
    });
    return {
      ultimo: ultimoDe(linhas, (l) => l.id),
      itens: linhas.map((d) => ({
        linha: d.id, fileId: d.driveFileId, mime: d.mime,
        caminho: caminhoEquipe(entidade(d.usuarioId, d.usuario.nome), d.categoria),
        nome: nomeDocumentoEquipe(d.categoria, d.enviadoEm, d.nomeOriginal, d.mime),
        bytes: async () => buf((await prisma.documentoUsuario.findUnique({ where: { id: d.id }, select: { conteudo: true } }))?.conteudo),
        gravar: async (fileId) => (await prisma.documentoUsuario.updateMany({ where: { id: d.id, driveFileId: null }, data: { driveFileId: fileId } })).count > 0,
        esquecer: async () => { await prisma.documentoUsuario.updateMany({ where: { id: d.id, driveFileId: d.driveFileId }, data: { driveFileId: null } }); },
      })),
    };
  },
};

const pciModelo: TipoArquivo = {
  tipo: "pciModelo",
  async lote(o) {
    const linhas = await prisma.pciModelo.findMany({
      where: { ...filtroLinha("id", o), driveFileId: o.pendentes ? null : { not: null } },
      orderBy: { id: "asc" }, take: o.lote,
      select: { id: true, versao: true, nome: true, formato: true, enviadoEm: true, driveFileId: true },
    });
    return {
      ultimo: ultimoDe(linhas, (l) => l.id),
      itens: linhas.map((m) => ({
        linha: m.id, fileId: m.driveFileId, mime: mimePlanilha(m.formato), caminho: caminhoModeloPci(),
        nome: nomeModeloPci(m.versao, m.enviadoEm, `modelo.${m.formato}`, mimePlanilha(m.formato)),
        bytes: async () => buf((await prisma.pciModelo.findUnique({ where: { id: m.id }, select: { dados: true } }))?.dados),
        gravar: async (fileId) => (await prisma.pciModelo.updateMany({ where: { id: m.id, driveFileId: null }, data: { driveFileId: fileId } })).count > 0,
        esquecer: async () => { await prisma.pciModelo.updateMany({ where: { id: m.id, driveFileId: m.driveFileId }, data: { driveFileId: null } }); },
      })),
    };
  },
};

const pciGerada: TipoArquivo = {
  tipo: "pciGerada",
  async lote(o) {
    const linhas = await prisma.pciGerada.findMany({
      where: { ...filtroLinha("id", o), ...(o.pendentes ? { OR: [{ planilhaDriveFileId: null }, { pdfDriveFileId: null }] } : { OR: [{ planilhaDriveFileId: { not: null } }, { pdfDriveFileId: { not: null } }] }) },
      orderBy: { id: "asc" }, take: o.lote,
      select: { id: true, obraId: true, planilhaFormato: true, criadoEm: true, planilhaDriveFileId: true, pdfDriveFileId: true, obra: { select: { nome: true } } },
    });
    const itens: ArquivoSistema[] = [];
    for (const g of linhas) {
      const caminho = caminhoGeradorPci(entidade(g.obraId, g.obra.nome));
      for (const parte of ["planilha", "pdf"] as const) {
        const fileId = parte === "planilha" ? g.planilhaDriveFileId : g.pdfDriveFileId;
        if (o.pendentes === Boolean(fileId)) continue;
        const campo = parte === "planilha" ? "planilhaDriveFileId" : "pdfDriveFileId";
        const formato = parte === "planilha" ? g.planilhaFormato : "pdf";
        itens.push({
          linha: g.id, fileId, caminho, mime: mimePlanilha(formato), nome: nomePciGerada(g.criadoEm, formato),
          bytes: async () => {
            const r = await prisma.pciGerada.findUnique({ where: { id: g.id }, select: parte === "planilha" ? { planilha: true } : { pdf: true } });
            return buf(r ? (parte === "planilha" ? (r as { planilha: Uint8Array }).planilha : (r as { pdf: Uint8Array }).pdf) : null);
          },
          gravar: async (id) => (await prisma.pciGerada.updateMany({ where: { id: g.id, [campo]: null }, data: { [campo]: id } })).count > 0,
          esquecer: async () => { await prisma.pciGerada.updateMany({ where: { id: g.id, [campo]: fileId }, data: { [campo]: null } }); },
        });
      }
    }
    return { ultimo: ultimoDe(linhas, (l) => l.id), itens };
  },
};

/** PCI original da obra: fica em Medições CAIXA (onde já era gravada). */
const pciVersao: TipoArquivo = {
  tipo: "pciVersao",
  async lote(o) {
    const linhas = await prisma.obraPciVersao.findMany({
      where: { ...filtroLinha("id", o), driveFileId: o.pendentes ? null : { not: null } },
      orderBy: { id: "asc" }, take: o.lote,
      select: { id: true, obraId: true, nome: true, criadoEm: true, driveFileId: true, obra: { select: { nome: true } } },
    });
    return {
      ultimo: ultimoDe(linhas, (l) => l.id),
      itens: linhas.map((v) => {
        const mime = mimePlanilha(extensao(v.nome));
        return {
          linha: v.id, fileId: v.driveFileId, mime, adotarPorNome: true,
          caminho: caminhoMedicoesObra(entidade(v.obraId, v.obra.nome)),
          nome: nomeArquivo("PCI original", v.criadoEm, v.nome, mime),
          bytes: async () => buf((await prisma.obraPciVersao.findUnique({ where: { id: v.id }, select: { dados: true } }))?.dados),
          gravar: async (fileId) => (await prisma.obraPciVersao.updateMany({ where: { id: v.id, driveFileId: null }, data: { driveFileId: fileId } })).count > 0,
          esquecer: async () => { await prisma.obraPciVersao.updateMany({ where: { id: v.id, driveFileId: v.driveFileId }, data: { driveFileId: null } }); },
        };
      }),
    };
  },
};

const whatsapp: TipoArquivo = {
  tipo: "whatsapp",
  async lote(o) {
    const linhas = await prisma.whatsappMidia.findMany({
      where: { ...filtroLinha("mensagemId", o), driveFileId: o.pendentes ? null : { not: null } },
      orderBy: { mensagemId: "asc" }, take: o.lote,
      select: { mensagemId: true, driveFileId: true, mensagem: { select: { leadId: true, destinatario: true, enviadaEm: true, midiaNome: true, midiaMime: true } } },
    });
    const leadIds = [...new Set(linhas.flatMap((l) => (l.mensagem.leadId ? [l.mensagem.leadId] : [])))];
    const leads = new Map((await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, nome: true } })).map((l) => [l.id, l.nome]));
    return {
      ultimo: ultimoDe(linhas, (l) => l.mensagemId),
      itens: linhas.map((m) => {
        const leadId = m.mensagem.leadId && leads.has(m.mensagem.leadId) ? m.mensagem.leadId : null;
        const mime = (m.mensagem.midiaMime ?? "application/octet-stream").split(";")[0].trim();
        return {
          linha: m.mensagemId, fileId: m.driveFileId, mime,
          caminho: leadId ? caminhoWhatsappCliente(entidade(leadId, leads.get(leadId))) : caminhoWhatsappSemCliente(m.mensagem.destinatario),
          nome: nomeMidiaWhatsapp(m.mensagem.enviadaEm, m.mensagem.midiaNome, mime),
          bytes: async () => buf((await prisma.whatsappMidia.findUnique({ where: { mensagemId: m.mensagemId }, select: { conteudo: true } }))?.conteudo),
          gravar: async (fileId) => (await prisma.whatsappMidia.updateMany({ where: { mensagemId: m.mensagemId, driveFileId: null }, data: { driveFileId: fileId } })).count > 0,
          esquecer: async () => { await prisma.whatsappMidia.updateMany({ where: { mensagemId: m.mensagemId, driveFileId: m.driveFileId }, data: { driveFileId: null } }); },
        };
      }),
    };
  },
};

/** Documentos da Incorporação gravados direto no Drive (só reorganização). */
const documentoRegistro: TipoArquivo = {
  tipo: "documentoRegistro",
  async lote(o) {
    if (o.pendentes) return { ultimo: null, itens: [] };
    const linhas = await prisma.estudoDocumentoRegistro.findMany({
      where: { ...filtroLinha("id", o), driveFileId: { not: null } },
      orderBy: { id: "asc" }, take: o.lote,
      select: { id: true, estudoId: true, itemId: true, nome: true, mime: true, enviadoEm: true, driveFileId: true },
    });
    const itens: ArquivoSistema[] = [];
    for (const d of linhas) {
      const destino = await destinoDocumentoEstudo(d.estudoId, d.itemId);
      itens.push({
        linha: d.id, fileId: d.driveFileId, mime: d.mime, caminho: destino.caminho, nome: nomeArquivo(destino.rotulo, d.enviadoEm, d.nome, d.mime),
        bytes: async () => null, gravar: async () => false,
      });
    }
    return { ultimo: ultimoDe(linhas, (l) => l.id), itens };
  },
};

/** Ordem das fotos dentro da medição e das medições dentro da obra (numeração 01, 02…). */
async function destinoFotoObra(foto: { id: string; obraId: string; medicaoId: string | null; tiradaEm: Date; obra: { nome: string } }, mime: string, memo: Map<string, string[] | { id: string; criadoEm: Date }[]>) {
  const chaveFotos = `f:${foto.obraId}:${foto.medicaoId ?? ""}`;
  let fotos = memo.get(chaveFotos) as string[] | undefined;
  if (!fotos) {
    fotos = (await prisma.obraFoto.findMany({ where: { obraId: foto.obraId, medicaoId: foto.medicaoId }, orderBy: [{ tiradaEm: "asc" }, { id: "asc" }], select: { id: true } })).map((f) => f.id);
    memo.set(chaveFotos, fotos);
  }
  let medicao: { id: string; ordem: number; data: Date } | null = null;
  if (foto.medicaoId) {
    const chaveMed = `m:${foto.obraId}`;
    let medicoes = memo.get(chaveMed) as { id: string; criadoEm: Date }[] | undefined;
    if (!medicoes) {
      medicoes = await prisma.obraProgressoHistorico.findMany({ where: { obraId: foto.obraId }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, criadoEm: true } });
      memo.set(chaveMed, medicoes);
    }
    const i = medicoes.findIndex((m) => m.id === foto.medicaoId);
    if (i >= 0) medicao = { id: foto.medicaoId, ordem: i + 1, data: medicoes[i].criadoEm };
  }
  return {
    caminho: caminhoFotosObra(entidade(foto.obraId, foto.obra.nome), medicao),
    nome: nomeFotoObra(Math.max(1, fotos.indexOf(foto.id) + 1), foto.tiradaEm, mime),
  };
}

/** Rótulo e área de um documento do cliente (mesma regra da rota de envio). */
async function destinoDocumentoCliente(arquivoId: string): Promise<{ leadId: string; area: "atendimento" | "financiamento"; rotulo: string } | null> {
  const docs = await prisma.documentoCliente.findMany({ where: { arquivoId }, select: { leadId: true, tipo: true, copiadoDeId: true } });
  const doc = docs.find((d) => !d.copiadoDeId) ?? docs[0];
  if (doc) return { leadId: doc.leadId, area: "atendimento", rotulo: DOCUMENTOS_CLIENTE.find((d) => d.chave === doc.tipo)?.nome ?? doc.tipo };
  const versao = await prisma.documentoClienteVersao.findUnique({ where: { arquivoId }, select: { leadId: true, tipoChecklist: true, itemId: true } });
  if (!versao) return null;
  if (versao.tipoChecklist === "crm") {
    const item = await prisma.documentoCliente.findUnique({ where: { id: versao.itemId }, select: { tipo: true } });
    const tipo = item?.tipo ?? "Documento";
    return { leadId: versao.leadId, area: "atendimento", rotulo: DOCUMENTOS_CLIENTE.find((d) => d.chave === tipo)?.nome ?? tipo };
  }
  const item = await prisma.checklistItem.findUnique({ where: { id: versao.itemId }, select: { item: true, financiamentoId: true } });
  return { leadId: versao.leadId, area: "financiamento", rotulo: item ? `${item.financiamentoId} — ${item.item}` : "Documento" };
}

/** Tabela genérica `arquivos`: o destino vem de quem usa o arquivo. Sem dono conhecido, fica de fora. */
const arquivo: TipoArquivo = {
  tipo: "arquivo",
  async lote(o) {
    const linhas = await prisma.arquivo.findMany({
      where: { ...filtroLinha("id", o), ...(o.pendentes ? { driveFileId: null, dados: { not: null } } : { driveFileId: { not: null } }) },
      orderBy: { id: "asc" }, take: o.lote,
      select: {
        id: true, nome: true, mime: true, criadoEm: true, driveFileId: true,
        obraFoto: { select: { id: true, obraId: true, medicaoId: true, tiradaEm: true, obra: { select: { nome: true } } } },
        documentoRegistro: { select: { estudoId: true, itemId: true } },
        checklistItem: { select: { item: true, financiamentoId: true, financiamento: { select: { leadId: true } } } },
        orcamentoPlanilha: { select: { estudoId: true, estudo: { select: { nome: true } } } },
      },
    });
    const memo = new Map<string, string[] | { id: string; criadoEm: Date }[]>();
    const nomesLead = new Map<string, string | null>();
    const nomeLead = async (id: string) => {
      if (!nomesLead.has(id)) nomesLead.set(id, (await prisma.lead.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null);
      return nomesLead.get(id) ?? null;
    };
    const itens: ArquivoSistema[] = [];
    for (const a of linhas) {
      let destino: { caminho: PastaAlvo[]; nome: string } | null = null;
      if (a.obraFoto) destino = await destinoFotoObra(a.obraFoto, a.mime, memo);
      else if (a.documentoRegistro) {
        const d = await destinoDocumentoEstudo(a.documentoRegistro.estudoId, a.documentoRegistro.itemId);
        destino = { caminho: d.caminho, nome: nomeArquivo(d.rotulo, a.criadoEm, a.nome, a.mime) };
      } else if (a.orcamentoPlanilha) {
        destino = { caminho: caminhoOrcamentoEstudo(entidade(a.orcamentoPlanilha.estudoId, a.orcamentoPlanilha.estudo.nome)), nome: nomePlanilhaOrcamento(a.criadoEm, a.nome, a.mime) };
      } else if (a.checklistItem?.financiamento.leadId) {
        const leadId = a.checklistItem.financiamento.leadId;
        destino = { caminho: caminhoCliente(entidade(leadId, await nomeLead(leadId)), "financiamento"), nome: nomeArquivo(`${a.checklistItem.financiamentoId} — ${a.checklistItem.item}`, a.criadoEm, a.nome, a.mime) };
      } else {
        const d = await destinoDocumentoCliente(a.id);
        if (d && (await prisma.lead.count({ where: { id: d.leadId } }))) destino = { caminho: caminhoCliente(entidade(d.leadId, await nomeLead(d.leadId)), d.area), nome: nomeArquivo(d.rotulo, a.criadoEm, a.nome, a.mime) };
      }
      if (!destino) continue;
      itens.push({
        linha: a.id, fileId: a.driveFileId, mime: a.mime, ...destino,
        bytes: async () => buf((await prisma.arquivo.findUnique({ where: { id: a.id }, select: { dados: true } }))?.dados),
        gravar: async (fileId) => (await prisma.arquivo.updateMany({ where: { id: a.id, driveFileId: null }, data: { driveFileId: fileId } })).count > 0,
        // Só esquece quando o banco ainda tem os bytes (contratos só no Drive ficam como estão).
        esquecer: async () => { await prisma.arquivo.updateMany({ where: { id: a.id, driveFileId: a.driveFileId, dados: { not: null } }, data: { driveFileId: null } }); },
      });
    }
    return { ultimo: ultimoDe(linhas, (l) => l.id), itens };
  },
};

const TIPOS: Record<TipoCopia, TipoArquivo> = { documentoUsuario, pciModelo, pciGerada, pciVersao, arquivo, whatsapp, documentoRegistro };
/** Ordem do sincronizador (envio e reorganização). */
const ORDEM: TipoCopia[] = ["documentoUsuario", "pciModelo", "pciGerada", "pciVersao", "arquivo", "whatsapp", "documentoRegistro"];

// ─── Operações em um arquivo ─────────────────────────────────────────────────

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "erro desconhecido");
const arquivoSumiu = (e: unknown) => e instanceof ErroDrive && e.status === 404 && e.etapa === "leitura";

type Resultado = "enviado" | "movido" | "ok" | "ignorado";

async function enviarItem(item: ArquivoSistema, cache: CachePastas): Promise<Resultado> {
  const bytes = await item.bytes();
  if (!bytes) return "ignorado";
  if (item.adotarPorNome) {
    // Só adota a cópia antiga com o mesmo conteúdo (MD5 dos bytes do banco).
    const md5 = createHash("md5").update(bytes).digest("hex");
    const existente = await buscarArquivoNoCaminho(item.caminho, item.nome, cache, md5);
    if (existente && !(await driveFileEmUso(existente))) {
      await item.gravar(existente);
      return "enviado";
    }
  }
  const fileId = await enviarArquivoNoCaminho(item.caminho, item.nome, item.mime, bytes, cache);
  if (!(await item.gravar(fileId))) await enviarParaLixeira(fileId).catch(() => undefined);
  return "enviado";
}

async function moverItem(item: ArquivoSistema, cache: CachePastas): Promise<Resultado> {
  if (!item.fileId) return "ok";
  try {
    return (await moverArquivoParaCaminho(item.fileId, item.caminho, item.nome, cache)) ? "movido" : "ok";
  } catch (e) {
    if (!arquivoSumiu(e)) throw e;
    await item.esquecer?.();
    return "ignorado";
  }
}

/**
 * Cópia no Drive logo depois de gravar no sistema. Nunca lança: sem Drive ou com
 * recusa do Google o arquivo fica pendente e o sincronizador tenta depois.
 */
export async function copiarParaDrive(tipo: TipoCopia, id: string): Promise<"ok" | "pendente" | "indisponivel"> {
  try {
    if (!(await driveRegistroConfigurado())) return "indisponivel";
    const { itens } = await TIPOS[tipo].lote({ depoisDe: null, lote: 1, pendentes: true, ids: [id] });
    const cache: CachePastas = new Map();
    for (const item of itens) await enviarItem(item, cache);
    return "ok";
  } catch (e) {
    console.error(`[drive] cópia de ${tipo} pendente:`, mensagem(e));
    return "pendente";
  }
}

/**
 * Planilha importada no Orçamento do estudo: o original fica no JSON do orçamento;
 * ao salvar, uma cópia (uma por arquivo diferente) vai para `arquivos` e para
 * Incorporação/<Estudo (nº)>/Orçamento. Nunca lança.
 */
export async function copiarPlanilhaOrcamento(estudoId: string, dadosJson: string, enviadoPorId: string | null): Promise<void> {
  try {
    const imp = (JSON.parse(dadosJson) as { importacaoExcel?: { nome?: unknown; originalBase64?: unknown } }).importacaoExcel;
    if (!imp || typeof imp.originalBase64 !== "string" || !imp.originalBase64) return;
    const bytes = Buffer.from(imp.originalBase64, "base64");
    if (!bytes.length) return;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const nome = (typeof imp.nome === "string" && imp.nome.trim() ? imp.nome.trim() : "orcamento.xlsx").replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 200);
    let arquivoId = (await prisma.estudoOrcamentoPlanilha.findUnique({ where: { estudoId_sha256: { estudoId, sha256 } }, select: { arquivoId: true } }))?.arquivoId;
    if (!arquivoId) {
      const dados = new Uint8Array(new ArrayBuffer(bytes.byteLength));
      dados.set(bytes);
      arquivoId = await prisma.$transaction(async (tx) => {
        const a = await tx.arquivo.create({ data: { nome, mime: mimePlanilha(extensao(nome)), tamanho: bytes.length, dados }, select: { id: true } });
        await tx.estudoOrcamentoPlanilha.create({ data: { estudoId, arquivoId: a.id, sha256, enviadoPorId } });
        return a.id;
      }).catch(async () => (await prisma.estudoOrcamentoPlanilha.findUnique({ where: { estudoId_sha256: { estudoId, sha256 } }, select: { arquivoId: true } }))?.arquivoId);
    }
    if (arquivoId) await copiarParaDrive("arquivo", arquivoId);
  } catch (e) {
    console.error("[drive] planilha do orçamento não copiada:", mensagem(e));
  }
}

/** Leva arquivos que continuam em uso ao lugar certo (ex.: antes de a pasta de um lead ir para a lixeira). */
export async function reorganizarItens(tipo: TipoCopia, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  try {
    if (!(await driveRegistroConfigurado())) return true;
    const cache: CachePastas = new Map();
    for (let i = 0; i < ids.length; i += 50) {
      const { itens } = await TIPOS[tipo].lote({ depoisDe: null, lote: 50, pendentes: false, ids: ids.slice(i, i + 50) });
      for (const item of itens) await moverItem(item, cache);
    }
    return true;
  } catch (e) {
    console.error(`[drive] reorganização de ${tipo} falhou:`, mensagem(e));
    return false;
  }
}

/** Algum registro do sistema ainda aponta para este arquivo do Drive? */
export async function driveFileEmUso(fileId: string): Promise<boolean> {
  const contagens = await Promise.all([
    prisma.arquivo.count({ where: { driveFileId: fileId } }),
    prisma.estudoDocumentoRegistro.count({ where: { driveFileId: fileId } }),
    prisma.imovelFoto.count({ where: { driveFileId: fileId } }),
    prisma.projetoDocumento.count({ where: { driveFileId: fileId } }),
    prisma.documentoUsuario.count({ where: { driveFileId: fileId } }),
    prisma.pciModelo.count({ where: { driveFileId: fileId } }),
    prisma.pciGerada.count({ where: { OR: [{ planilhaDriveFileId: fileId }, { pdfDriveFileId: fileId }] } }),
    prisma.obraPciVersao.count({ where: { driveFileId: fileId } }),
    prisma.whatsappMidia.count({ where: { driveFileId: fileId } }),
  ]);
  return contagens.some((n) => n > 0);
}

/**
 * Arquivos excluídos no sistema → lixeira do Drive, salvo se outro registro ainda
 * usa o mesmo arquivo. Chamado DEPOIS da exclusão no banco; nunca lança (o que
 * falhar fica para o sincronizador). Devolve false se algo não foi para a lixeira.
 */
export async function lixeiraDeArquivosSemUso(fileIds: (string | null | undefined)[]): Promise<boolean> {
  let ok = true;
  for (const fileId of new Set(fileIds.filter((f): f is string => Boolean(f)))) {
    try {
      if (await driveFileEmUso(fileId)) continue;
      if (await driveRegistroConfigurado()) await enviarParaLixeira(fileId);
    } catch (e) {
      if (arquivoSumiu(e) || (e instanceof ErroDrive && e.status === 404)) continue;
      ok = false;
      console.error("[drive] arquivo não foi para a lixeira:", mensagem(e));
    }
  }
  return ok;
}

/** Pasta inteira da entidade excluída → lixeira do Drive. Nunca lança. */
export async function lixeiraDaPasta(chave: string): Promise<boolean> {
  try {
    await enviarPastaParaLixeira(chave);
    return true;
  } catch (e) {
    console.error("[drive] pasta não foi para a lixeira (o sincronizador tenta de novo):", mensagem(e));
    return false;
  }
}

// ─── Sincronizador "Organizar Drive" ─────────────────────────────────────────

type Fase = "enviar" | "mover" | "orfaos";
interface Estado { fase: Fase; tipo: number; depoisDe: string | null; pageToken: string | null }

export interface RelatorioDrive {
  iniciadoEm: string;
  terminadoEm: string;
  /** Arquivos que estavam só no banco e foram copiados para o Drive. */
  enviados: number;
  /** Arquivos levados para a pasta/nome certos. */
  movidos: number;
  /** Pastas de registros que não existem mais, enviadas para a lixeira. */
  pastasOrfas: number;
  /** Arquivos que sumiram do Drive (o banco reenvia no próximo ciclo quando ainda tem os bytes). */
  ignorados: number;
  falhas: number;
  /** true quando a volta completa terminou; false = continua na próxima execução. */
  cicloConcluido: boolean;
  fase: Fase;
  aviso: string | null;
}

const GRUPO = "drive";
const CHAVE_ESTADO = "drive.organizacao.estado";
const CHAVE_RELATORIO = "drive.organizacao.relatorio";
const CHAVE_TRAVA = "drive.organizacao.trava";
const ESTADO_INICIAL: Estado = { fase: "enviar", tipo: 0, depoisDe: null, pageToken: null };
/** Proteção contra banco errado/vazio: muitas órfãs de uma vez não são apagadas. */
const LIMITE_ORFAS_POR_PAGINA = 25;

async function lerJson<T>(chave: string): Promise<T | null> {
  const l = await prisma.configuracao.findUnique({ where: { chave }, select: { valor: true } });
  if (!l) return null;
  try { return JSON.parse(l.valor) as T; } catch { return null; }
}

async function gravarJson(chave: string, valor: unknown) {
  const texto = JSON.stringify(valor);
  await prisma.configuracao.upsert({ where: { chave }, create: { chave, valor: texto, grupo: GRUPO }, update: { valor: texto } });
}

const marca = (ms: number) => String(ms).padStart(15, "0");

/** Trava simples no banco: só uma organização por vez (cron e botão). */
async function travar(ate: number): Promise<boolean> {
  await prisma.configuracao.upsert({ where: { chave: CHAVE_TRAVA }, create: { chave: CHAVE_TRAVA, valor: "0", grupo: GRUPO }, update: {} });
  const r = await prisma.configuracao.updateMany({ where: { chave: CHAVE_TRAVA, valor: { lt: marca(Date.now()) } }, data: { valor: marca(ate) } });
  return r.count === 1;
}

async function destravar() {
  await prisma.configuracao.updateMany({ where: { chave: CHAVE_TRAVA }, data: { valor: "0" } });
}

/** Quais registros ainda existem no banco (lead arquivado continua existindo). */
async function existentes(prefixo: PrefixoEntidade, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const sel = { select: { id: true } } as const;
  switch (prefixo) {
    case "cliente": {
      // Projetos sem lead usam "cliente:projeto-<id>" (Portfólio de projetos).
      const projetos = ids.filter((i) => i.startsWith("projeto-")).map((i) => i.slice("projeto-".length));
      const leads = ids.filter((i) => !i.startsWith("projeto-"));
      const [l, p] = await Promise.all([
        prisma.lead.findMany({ where: { id: { in: leads } }, ...sel }),
        prisma.projeto.findMany({ where: { id: { in: projetos } }, ...sel }),
      ]);
      return new Set([...l.map((x) => x.id), ...p.map((x) => `projeto-${x.id}`)]);
    }
    case "obra": return new Set((await prisma.obra.findMany({ where: { id: { in: ids } }, ...sel })).map((x) => x.id));
    case "incorporacao": return new Set((await prisma.estudoIncorporacao.findMany({ where: { id: { in: ids } }, ...sel })).map((x) => x.id));
    case "imovel": return new Set((await prisma.imovel.findMany({ where: { id: { in: ids } }, ...sel })).map((x) => x.id));
    case "equipe": return new Set((await prisma.usuario.findMany({ where: { id: { in: ids } }, ...sel })).map((x) => x.id));
  }
}

export interface OpcoesSincronizacao {
  /** Tempo máximo desta execução (a Vercel corta a função; o resto fica para a próxima). */
  prazoMs?: number;
  /** Linhas do banco por consulta. */
  lote?: number;
}

/**
 * Reconciliação idempotente e retomável: (a) envia ao Drive o que está só no
 * banco; (b) move/renomeia para o caminho certo; (c) manda para a lixeira as
 * pastas de registros apagados. Para no prazo e continua de onde parou.
 */
export async function sincronizarDrive(opcoes: OpcoesSincronizacao = {}): Promise<RelatorioDrive> {
  const inicio = Date.now();
  const prazo = inicio + (opcoes.prazoMs ?? 45_000);
  const lote = Math.max(1, opcoes.lote ?? 25);
  const relatorio: RelatorioDrive = {
    iniciadoEm: new Date(inicio).toISOString(), terminadoEm: "", enviados: 0, movidos: 0, pastasOrfas: 0, ignorados: 0, falhas: 0,
    cicloConcluido: false, fase: "enviar", aviso: null,
  };
  const fim = async (salvar: boolean) => {
    relatorio.terminadoEm = new Date().toISOString();
    if (salvar) await gravarJson(CHAVE_RELATORIO, relatorio);
    return relatorio;
  };
  if (!(await driveRegistroConfigurado())) {
    relatorio.aviso = "Google Drive não conectado: nada a organizar.";
    return fim(true);
  }
  if (!(await travar(prazo + 60_000))) {
    relatorio.aviso = "Já existe uma organização do Drive em andamento. Tente de novo em alguns minutos.";
    return fim(false);
  }
  const estado: Estado = { ...ESTADO_INICIAL, ...(await lerJson<Estado>(CHAVE_ESTADO)) };
  const cache: CachePastas = new Map();
  const expirou = () => Date.now() >= prazo;
  try {
    // Fotos de imóveis pendentes têm o próprio fluxo (numeração pela ordem do anúncio).
    if (estado.fase === "enviar" && estado.tipo === 0 && !estado.depoisDe) {
      const pendentes = await prisma.imovelFoto.count({ where: { driveFileId: null, dados: { not: null } } });
      if (pendentes) {
        const { enviarFotosPendentesAoDrive } = await import("@/lib/imovel-fotos");
        const r = await enviarFotosPendentesAoDrive();
        relatorio.enviados += r.enviadas;
        relatorio.falhas += r.falhas;
      }
    }
    while (!expirou()) {
      relatorio.fase = estado.fase;
      if (estado.fase === "enviar" || estado.fase === "mover") {
        if (estado.tipo >= ORDEM.length) {
          Object.assign(estado, { fase: estado.fase === "enviar" ? "mover" : "orfaos", tipo: 0, depoisDe: null, pageToken: null });
          continue;
        }
        const { ultimo, itens } = await TIPOS[ORDEM[estado.tipo]].lote({ depoisDe: estado.depoisDe, lote, pendentes: estado.fase === "enviar" });
        if (ultimo === null) { estado.tipo += 1; estado.depoisDe = null; continue; }
        let linhaCompleta = estado.depoisDe;
        let interrompido = false;
        for (let i = 0; i < itens.length; i++) {
          if (expirou()) { interrompido = true; break; }
          const item = itens[i];
          try {
            const r = estado.fase === "enviar" ? await enviarItem(item, cache) : await moverItem(item, cache);
            if (r === "enviado") relatorio.enviados += 1;
            else if (r === "movido") relatorio.movidos += 1;
            else if (r === "ignorado") relatorio.ignorados += 1;
          } catch (e) {
            relatorio.falhas += 1;
            console.error(`[drive] organizar (${estado.fase}/${ORDEM[estado.tipo]}):`, mensagem(e));
          }
          if (itens[i + 1]?.linha !== item.linha) linhaCompleta = item.linha;
        }
        // Linhas sem item (sem destino conhecido) contam como processadas.
        estado.depoisDe = interrompido ? linhaCompleta : ultimo;
        if (interrompido) break;
        continue;
      }
      // (c) Pastas órfãs.
      if (estado.tipo >= TOPOS_ORFAOS.length) {
        relatorio.cicloConcluido = true;
        Object.assign(estado, ESTADO_INICIAL);
        break;
      }
      const topo = TOPOS_ORFAOS[estado.tipo];
      const pagina = await listarSubpastasDoSistema(topo.chave, estado.pageToken);
      const daEntidade = pagina.pastas.flatMap((p) => {
        const ent = entidadeDaChave(p.chave);
        return ent && ent.prefixo === topo.prefixo ? [{ pasta: p.id, id: ent.id }] : [];
      });
      const vivos = await existentes(topo.prefixo, [...new Set(daEntidade.map((d) => d.id))]);
      const orfas = daEntidade.filter((d) => !vivos.has(d.id));
      if (orfas.length > LIMITE_ORFAS_POR_PAGINA && orfas.length * 2 > daEntidade.length) {
        relatorio.aviso = `${orfas.length} pastas em "${topo.chave}" sem registro no banco de uma vez: nada foi apagado por segurança. Confira a conexão do banco e do Drive.`;
        relatorio.falhas += 1;
      } else {
        let interrompido = false;
        for (const o of orfas) {
          if (expirou()) { interrompido = true; break; }
          try {
            await enviarParaLixeira(o.pasta);
            relatorio.pastasOrfas += 1;
          } catch (e) {
            relatorio.falhas += 1;
            console.error(`[drive] pasta órfã (${topo.prefixo}) não foi para a lixeira:`, mensagem(e));
          }
        }
        // Interrompido: relista a mesma página (as já enviadas à lixeira não voltam).
        if (interrompido) break;
      }
      estado.pageToken = pagina.proxima;
      if (!pagina.proxima) { estado.tipo += 1; estado.pageToken = null; }
    }
  } catch (e) {
    relatorio.falhas += 1;
    relatorio.aviso = "A organização parou por um erro do Google Drive e continua na próxima execução.";
    console.error("[drive] organizar:", mensagem(e));
  } finally {
    await gravarJson(CHAVE_ESTADO, estado).catch(() => undefined);
    await destravar().catch(() => undefined);
  }
  return fim(true);
}

/** Último relatório (cartão do Google Drive em Configurações). */
export async function ultimoRelatorioDrive(): Promise<RelatorioDrive | null> {
  return lerJson<RelatorioDrive>(CHAVE_RELATORIO);
}
