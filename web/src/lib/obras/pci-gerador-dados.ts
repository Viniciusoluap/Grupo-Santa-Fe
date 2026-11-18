// Lote 2, correção 03 (AD-06): Gerador de PCI — banco de dados (modelos versionados,
// rascunho, PCIs geradas). Chamar só depois de conferir o acesso (actions/rotas).
// Gêmeo de Prospecta/server/pci-gerador.ts. O envio de PCI da obra (./pci.ts) não muda.
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  LIMITE_MODELO_PCI_BYTES,
  MENSAGEM_SAIDA_XLS_PCI,
  formatoModeloPci,
  nomeArquivoPciGerada,
  avisosEmpresaNoModeloPci,
  compararPreenchimentoPci,
  conferirProcedenciaPci,
  dadosPessoaisNoModeloPci,
  errosPci,
  extrairModeloPreenchimentoPci,
  faltasPerfilEngenheiroPci,
  formularioPciVazio,
  normalizarFormularioPci,
  pendenciasPci,
  preencherPciAutomatico,
  registrarConfirmacoesPci,
  resumoModeloPreenchimentoPci,
  sugestoesAutomaticasPci,
  validarNomeModeloPreenchimentoPci,
  type EngenheiroDaObraPci,
  type FontesPreenchimentoPci,
  type FormatoModeloPci,
  type FormularioPci,
} from "@/lib/pci-gerador";
import { gerarPdfPci, gerarPlanilhaPci, lerFormularioPci, validarModeloPci } from "@/lib/caixa/pci-gerador";
import { compararEstruturasPci, lerEstruturaModeloPci, xlsCompativelCom, type EstruturaModeloPci, type RelatorioCompatibilidadePci } from "@/lib/caixa/pci-modelo-estrutura";
import { cidadeEstadoDoEndereco, coordenadasDaPci, coordenadasSalvas } from "@/lib/obra-localizacao";
import { dadosEngenheiroParaPci, listarEngenheiros } from "@/lib/engenheiros";
import { podeAcessarModulo, podeAdministrarSeguranca, type UsuarioAcesso } from "@/lib/perfis-acesso";

/** Gerador: admin ou colaborador com Obras (empreiteiro e corretor, não). Mesma regra do Prospecta. */
export const podeUsarGeradorPci = (u: UsuarioAcesso) => (u.perfil === "admin" || u.perfil === "colaborador") && podeAcessarModulo(u, "obras");
/** Modelos oficiais (Sub PCI atual, em Integrações): só admin ativo. */
export const podeGerenciarModelosPci = (u: Pick<UsuarioAcesso, "perfil" | "ativo">) => podeAdministrarSeguranca(u);

export class ErroGeradorPci extends Error {}

export type ModeloPciResumo = {
  id: string; versao: number; arquivo: string; formato: FormatoModeloPci; tamanho: number; atual: boolean;
  enviadoEm: Date; autor: string | null; observacao: string | null;
  /** Lote 03, correção 10: versão com mudança crítica aguardando confirmação do admin. */
  aguardandoConfirmacao: boolean;
  relatorio: RelatorioCompatibilidadePci | null;
  /** Lote 03, correção 09b: quantas PCIs geradas usam esta versão. */
  pcisGeradas: number;
};

async function nomesDeUsuarios(ids: (string | null)[]): Promise<Map<string, string>> {
  const validos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!validos.length) return new Map();
  const us = await prisma.usuario.findMany({ where: { id: { in: validos } }, select: { id: true, nome: true } });
  return new Map(us.map((u) => [u.id, u.nome]));
}

/** Versões não excluídas (a exclusão é lógica: o arquivo fica para as PCIs já geradas). */
export async function listarModelosPci(): Promise<ModeloPciResumo[]> {
  const ms = await prisma.pciModelo.findMany({
    where: { excluidoEm: null },
    orderBy: { versao: "desc" },
    select: { id: true, versao: true, nome: true, formato: true, tamanho: true, atual: true, enviadoEm: true, enviadoPorId: true, observacao: true, aguardandoConfirmacao: true, relatorioCompatibilidade: true, _count: { select: { geradas: true } } },
  });
  const nomes = await nomesDeUsuarios(ms.map((m) => m.enviadoPorId));
  return ms.map((m) => ({
    id: m.id, versao: m.versao, arquivo: m.nome, formato: m.formato as FormatoModeloPci, tamanho: m.tamanho, atual: m.atual, enviadoEm: m.enviadoEm,
    autor: m.enviadoPorId ? nomes.get(m.enviadoPorId) ?? null : null, observacao: m.observacao,
    aguardandoConfirmacao: m.aguardandoConfirmacao, relatorio: (m.relatorioCompatibilidade as unknown as RelatorioCompatibilidadePci | null) ?? null, pcisGeradas: m._count.geradas,
  }));
}

export async function modeloAtualPci(): Promise<ModeloPciResumo | null> {
  return (await listarModelosPci()).find((m) => m.atual) ?? null;
}

/** Arquivo de uma versão — inclusive excluída (o download da versão usada por uma PCI gerada continua). */
export async function arquivoDoModeloPci(id: string) {
  return prisma.pciModelo.findUnique({ where: { id }, select: { nome: true, formato: true, versao: true, dados: true } });
}

async function auditarModeloPci(modeloId: string, acao: "enviar" | "tornar_atual" | "confirmar_critica" | "excluir", usuarioId: string | null, detalhes: Record<string, unknown>) {
  await prisma.pciModeloAuditoria.create({ data: { modeloId, acao, usuarioId, detalhes: detalhes as Prisma.InputJsonValue } });
}

export const MENSAGEM_CONFIRMAR_CRITICA_PCI = "Esta versão tem mudanças críticas em relação ao mapeamento (veja o relatório de compatibilidade). Confirme explicitamente para usá-la como atual.";

/**
 * Torna a versão a atual. Versão excluída não pode; versão com mudança crítica
 * só com `confirmarCritica` (Lote 03, correção 10).
 */
export async function definirModeloAtualPci(id: string, opcoes: { usuarioId?: string | null; confirmarCritica?: boolean } = {}) {
  const acao = await prisma.$transaction(async (tx) => {
    const m = await tx.pciModelo.findUnique({ where: { id }, select: { id: true, versao: true, excluidoEm: true, aguardandoConfirmacao: true } });
    if (!m || m.excluidoEm) throw new ErroGeradorPci("Modelo não encontrado.");
    if (m.aguardandoConfirmacao && !opcoes.confirmarCritica) throw new ErroGeradorPci(MENSAGEM_CONFIRMAR_CRITICA_PCI);
    await tx.pciModelo.updateMany({ where: { atual: true, id: { not: id } }, data: { atual: false } });
    await tx.pciModelo.update({
      where: { id },
      data: { atual: true, aguardandoConfirmacao: false, ...(m.aguardandoConfirmacao ? { confirmadoPorId: opcoes.usuarioId ?? null, confirmadoEm: new Date() } : {}) },
    });
    return { critica: m.aguardandoConfirmacao, versao: m.versao };
  });
  await auditarModeloPci(id, acao.critica ? "confirmar_critica" : "tornar_atual", opcoes.usuarioId ?? null, { versao: acao.versao });
}

/** Estrutura de uma versão gravada (para comparar e escolher a base .xls). */
async function estruturaDoModelo(id: string): Promise<{ versao: number; formato: FormatoModeloPci; estrutura: EstruturaModeloPci } | null> {
  const m = await arquivoDoModeloPci(id);
  if (!m) return null;
  try { return { versao: m.versao, formato: m.formato as FormatoModeloPci, estrutura: lerEstruturaModeloPci(new Uint8Array(m.dados), m.formato as FormatoModeloPci) }; }
  catch { return null; }
}

/**
 * Lote 03, correção 10: base .xls para a saída. Modelo .xls → ele mesmo. Modelo
 * .xlsm/.xlsb → a versão .xls (não excluída) mais recente com a mesma estrutura.
 */
async function baseXlsCompativel(referencia: EstruturaModeloPci, ignorarId: string | null) {
  const xls = await prisma.pciModelo.findMany({ where: { formato: "xls", excluidoEm: null }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
  for (const c of xls) {
    if (c.id === ignorarId) continue;
    const e = await estruturaDoModelo(c.id);
    if (e && xlsCompativelCom(e.estrutura, referencia)) return c;
  }
  return null;
}

/**
 * Revisão do PR #180 (P2, paridade): o que a tela do gerador precisa saber para liberar o botão — com
 * modelo .xlsm/.xlsb atual, a geração só é possível se existir a versão .xls compatível (mesma regra de
 * modeloParaGerarPci). Sem modelo: indisponível.
 */
export async function disponibilidadeGeracaoPci(atual: ModeloPciResumo | null): Promise<{ baseCompativelDisponivel: boolean; baseXlsVersao: number | null; avisoModelo: string | null }> {
  if (!atual) return { baseCompativelDisponivel: false, baseXlsVersao: null, avisoModelo: "Nenhum modelo de PCI cadastrado. O admin envia o modelo oficial em Integrações › PCI da CAIXA." };
  if (atual.formato === "xls") return { baseCompativelDisponivel: true, baseXlsVersao: atual.versao, avisoModelo: null };
  const ref = await estruturaDoModelo(atual.id);
  const base = ref ? await baseXlsCompativel(ref.estrutura, atual.id) : null;
  return base
    ? { baseCompativelDisponivel: true, baseXlsVersao: base.versao, avisoModelo: `Modelo atual em .${atual.formato}: a PCI é gerada em .xls a partir da versão v${base.versao}, de mesma estrutura.` }
    : { baseCompativelDisponivel: false, baseXlsVersao: null, avisoModelo: `Modelo atual em .${atual.formato}: não há versão .xls compatível — a geração fica bloqueada até o admin enviar a versão .xls do modelo oficial em Integrações › PCI da CAIXA.` };
}

export async function modeloParaGerarPci(atual: ModeloPciResumo) {
  if (atual.formato === "xls") {
    const m = await arquivoDoModeloPci(atual.id);
    return m ? { id: atual.id, ...m, aviso: null as string | null } : null;
  }
  const ref = await estruturaDoModelo(atual.id);
  const base = ref ? await baseXlsCompativel(ref.estrutura, atual.id) : null;
  if (!base) throw new ErroGeradorPci(MENSAGEM_SAIDA_XLS_PCI);
  const m = await arquivoDoModeloPci(base.id);
  return m ? { id: base.id, ...m, aviso: `Modelo atual v${atual.versao} (.${atual.formato}): planilha gerada em .xls a partir da versão v${base.versao}, de mesma estrutura.` } : null;
}

/**
 * Grava uma nova versão. Lê a estrutura, compara com a versão atual e guarda o
 * relatório. Sem mudança crítica, vira a atual; com mudança crítica, fica
 * aguardando a confirmação explícita do admin (Lote 03, correção 10).
 * Mesmo arquivo já enviado (não excluído) só volta a ser o atual.
 */
export async function gravarModeloPci(nome: string, bytes: Uint8Array, autorId: string, observacao: string | null) {
  if (!bytes.length || bytes.length > LIMITE_MODELO_PCI_BYTES) throw new ErroGeradorPci("Envie um modelo de até 8 MB.");
  let formato: FormatoModeloPci;
  let estrutura: EstruturaModeloPci;
  try {
    formato = formatoModeloPci(nome, bytes);
    validarModeloPci(bytes, formato);
    estrutura = lerEstruturaModeloPci(bytes, formato);
  } catch (e) {
    throw new ErroGeradorPci(e instanceof Error ? e.message : "Modelo inválido.");
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  const igual = await prisma.pciModelo.findFirst({ where: { hash, excluidoEm: null }, select: { id: true, versao: true, aguardandoConfirmacao: true, relatorioCompatibilidade: true } });
  if (igual) {
    if (!igual.aguardandoConfirmacao) await definirModeloAtualPci(igual.id, { usuarioId: autorId });
    return { id: igual.id, versao: igual.versao, formato, repetido: true, aguardandoConfirmacao: igual.aguardandoConfirmacao, relatorio: (igual.relatorioCompatibilidade as unknown as RelatorioCompatibilidadePci | null) ?? null };
  }
  const atual = await modeloAtualPci();
  const anterior = atual ? await estruturaDoModelo(atual.id) : null;
  const relatorio = compararEstruturasPci(anterior ? { versao: anterior.versao, estrutura: anterior.estrutura } : null, estrutura);
  if (formato !== "xls") {
    const base = await baseXlsCompativel(estrutura, null);
    if (!base) relatorio.avisos.push("Não há versão .xls compatível com este modelo: a geração de PCI ficará bloqueada até o envio da versão .xls.");
    else relatorio.avisos.push(`A PCI será gerada em .xls a partir da versão v${base.versao} (.xls compatível).`);
  }
  const vira = !relatorio.critico;
  const novo = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE pci_modelos IN SHARE ROW EXCLUSIVE MODE`;
    const max = await tx.pciModelo.aggregate({ _max: { versao: true } });
    if (vira) await tx.pciModelo.updateMany({ where: { atual: true }, data: { atual: false } });
    return tx.pciModelo.create({
      data: {
        versao: (max._max.versao ?? 0) + 1, nome, formato, tamanho: bytes.length, hash, dados: new Uint8Array(bytes), atual: vira, observacao, enviadoPorId: autorId,
        relatorioCompatibilidade: relatorio as unknown as Prisma.InputJsonValue, aguardandoConfirmacao: !vira,
      },
      select: { id: true, versao: true },
    });
  });
  await auditarModeloPci(novo.id, "enviar", autorId, { versao: novo.versao, arquivo: nome, formato, critico: relatorio.critico });
  // Pedido de 29/10: cópia em Modelos/PCI CAIXA (sem Drive fica pendente para o "Organizar Drive").
  const { copiarParaDrive } = await import("@/lib/drive-organizacao");
  await copiarParaDrive("pciModelo", novo.id);
  return { id: novo.id, versao: novo.versao, formato, repetido: false, aguardandoConfirmacao: !vira, relatorio };
}

/** Prévia da exclusão: nome/versão e quantas PCIs geradas usam a versão. */
export async function previaExclusaoModeloPci(id: string) {
  const m = await prisma.pciModelo.findUnique({ where: { id }, select: { id: true, versao: true, nome: true, atual: true, excluidoEm: true, _count: { select: { geradas: true } } } });
  if (!m || m.excluidoEm) throw new ErroGeradorPci("Modelo não encontrado.");
  return { id: m.id, versao: m.versao, arquivo: m.nome, atual: m.atual, pcisGeradas: m._count.geradas };
}

/**
 * Lote 03, correção 09b: exclusão LÓGICA de uma versão (excluidoEm/excluidoPorId). A
 * versão atual não pode ser excluída. O arquivo é preservado: as PCIs geradas
 * continuam vinculadas e o download da versão usada segue funcionando.
 */
export async function excluirModeloPci(id: string, usuarioId: string) {
  const previa = await previaExclusaoModeloPci(id);
  if (previa.atual) throw new ErroGeradorPci("A versão atual não pode ser excluída. Torne outra versão atual antes.");
  const r = await prisma.pciModelo.updateMany({ where: { id, excluidoEm: null, atual: false }, data: { excluidoEm: new Date(), excluidoPorId: usuarioId } });
  if (!r.count) throw new ErroGeradorPci("A versão mudou durante a exclusão. Atualize a lista e tente de novo.");
  await auditarModeloPci(id, "excluir", usuarioId, { versao: previa.versao, arquivo: previa.arquivo, pcisGeradas: previa.pcisGeradas });
  return previa;
}

// ─── formulário da obra ──────────────────────────────────────────────────────

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function obraDoGerador(obraId: string) {
  const o = await prisma.obra.findUnique({
    where: { id: obraId },
    select: {
      id: true, nome: true, endereco: true, area: true, vgv: true, custoTerreno: true, financiamentoCef: true, dataInicio: true, dataPrevisaoFim: true,
      clienteNome: true, clienteTel: true, latitude: true, longitude: true, leadId: true, servicoLeadId: true,
      leadVinculado: { select: { nome: true, cpf: true, email: true, telefone: true, endereco: true, bairro: true } },
      imovel: { select: { latitude: true, longitude: true } },
      pci: { select: { vinculadaEm: true, versao: { select: { dados: true, parsed: true } } } },
    },
  });
  if (!o) throw new ErroGeradorPci("Obra não encontrada.");
  return o;
}

// ─── Paridade 17/11 (Prospecta EPIC-024 S-09): CPF do engenheiro e "Dados automáticos" com a fonte ──────────

const ID_TEXTO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Decisão de acesso ao CPF do engenheiro (mesma da Prospecta, portão de QA): quem usa o gerador (admin ou
 * colaborador com Obras) lê o CPF SÓ de quem a própria lista de engenheiros do gerador oferece
 * (`listarEngenheiros`, mesmo filtro). Outro usuário → recusa. Cada leitura vira um log estruturado só com ids.
 */
async function engenheiroOferecido(usuarioId: string) {
  return (await listarEngenheiros()).some((e) => e.id === usuarioId);
}

function registrarLeituraCpf(evento: { usuarioId: string | null; obraId: string; engenheiroId: string; origem: string; comCpf: boolean }) {
  console.info(JSON.stringify({ evento: "pci.cpf_engenheiro_lido", ...evento, em: new Date().toISOString() }));
}

const NAO_OFERECIDO = "Este usuário não está na lista de engenheiros do Gerador de PCI.";

/** Engenheiro para a PCI (com CPF), só depois da checagem do módulo Obras (action). */
export async function engenheiroDaPci(engenheiroId: string, contexto: { usuarioId: string | null; obraId: string }) {
  await obraDoGerador(contexto.obraId);
  if (!ID_TEXTO.test(engenheiroId) || !(await engenheiroOferecido(engenheiroId))) throw new ErroGeradorPci(NAO_OFERECIDO);
  const e = await dadosEngenheiroParaPci(engenheiroId);
  if (!e) throw new ErroGeradorPci(NAO_OFERECIDO);
  registrarLeituraCpf({ ...contexto, engenheiroId: e.id, origem: "selecao", comCpf: !!e.cpf });
  const avisos: string[] = [];
  const nome = e.nome ?? "Este usuário";
  if (!e.temPerfil) avisos.push(`${nome} não tem perfil de Engenheiro: CPF e CREA não estão cadastrados. Complete em Configurações › Usuários.`);
  else if (!e.perfilAtivo) avisos.push(`O perfil de Engenheiro de ${nome} está desativado: CPF, CREA e telefone do perfil não foram usados. Reative em Configurações › Usuários.`);
  else {
    const faltas = faltasPerfilEngenheiroPci(e);
    if (faltas.length) avisos.push(`O perfil de Engenheiro de ${nome} está sem ${faltas.join(", ")}: esses campos ficaram em branco. Complete em Configurações › Usuários.`);
  }
  return { id: e.id, nome: e.nome, email: e.email, telefone: e.telefone, crea: e.crea, creaUf: e.creaUf, cpf: e.cpf, perfilAtivo: e.perfilAtivo, temPerfil: e.temPerfil, avisos };
}

type EscolhaEngenheiro = { id: string; fonte: string; escolhido: boolean } | { id: null; motivo: string };
type IdsEngenheiros = { rtp?: string | null; rte?: string | null };

/**
 * Engenheiros da obra para RTP/RTE, só por vínculos que existem: (1) o escolhido no formulário aberto, (2) o do
 * rascunho salvo, (3) o da última PCI gerada desta obra; para o RTP, também (4) o engenheiro do projeto (Projetos,
 * não cancelado) ligado ao MESMO serviço do CRM da obra — só se for um só. Só engenheiros que a lista do gerador
 * oferece; cada CPF lido é registrado.
 */
async function engenheirosDaObra(obraId: string, servicoLeadId: string | null, ids: IdsEngenheiros, usuarioId: string | null, origemLeitura: string) {
  const [rascunhoLinha, geradaLinha] = await Promise.all([
    prisma.pciGeradorRascunho.findUnique({ where: { obraId }, select: { dados: true } }),
    prisma.pciGerada.findFirst({ where: { obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { dados: true } }),
  ]);
  const rascunho = (rascunhoLinha?.dados ?? null) as Partial<FormularioPci> | null;
  const gerada = (geradaLinha?.dados ?? null) as Partial<FormularioPci> | null;
  let projeto: EscolhaEngenheiro = { id: null, motivo: "A obra não tem serviço do CRM ligado a um projeto com engenheiro." };
  if (servicoLeadId) {
    const ps = await prisma.projeto.findMany({ where: { servicoLeadId, engenheiroId: { not: null }, NOT: { status: "cancelado" } }, select: { nome: true, engenheiroId: true } });
    const distintos = Array.from(new Set(ps.map((x) => x.engenheiroId!)));
    if (distintos.length === 1) projeto = { id: distintos[0], fonte: `Engenheiro do projeto "${ps[0].nome}" (mesmo serviço do CRM)`, escolhido: false };
    else if (distintos.length > 1) projeto = { id: null, motivo: "Os projetos do mesmo serviço do CRM têm engenheiros diferentes: escolha o engenheiro abaixo." };
  }
  const idValido = (v: unknown) => (typeof v === "string" && ID_TEXTO.test(v) ? v : null);
  const escolher = (papel: "rtp" | "rte"): EscolhaEngenheiro => {
    const chave = papel === "rtp" ? "rtpEngenheiroId" : "rteEngenheiroId";
    const noForm = idValido(ids[papel]);
    if (noForm) return { id: noForm, fonte: "Engenheiro escolhido nesta obra", escolhido: true };
    const noRascunho = idValido(rascunho?.[chave]);
    if (noRascunho) return { id: noRascunho, fonte: "Engenheiro escolhido no rascunho desta obra", escolhido: true };
    const naGerada = idValido(gerada?.[chave]);
    if (naGerada) return { id: naGerada, fonte: "Engenheiro da última PCI gerada desta obra", escolhido: true };
    if (papel === "rtp") return projeto;
    return { id: null, motivo: "Nenhum engenheiro de execução escolhido nesta obra. Escolha abaixo (pode ser o mesmo do RTP)." };
  };
  const oferecidos = new Set((await listarEngenheiros()).map((e) => e.id));
  const resultado: { rtp: EngenheiroDaObraPci | null; rte: EngenheiroDaObraPci | null; motivos: { rtp?: string; rte?: string } } = { rtp: null, rte: null, motivos: {} };
  for (const papel of ["rtp", "rte"] as const) {
    const e = escolher(papel);
    if (e.id === null) { resultado.motivos[papel] = e.motivo; continue; }
    const dados = oferecidos.has(e.id) ? await dadosEngenheiroParaPci(e.id) : null;
    if (!dados) { resultado.motivos[papel] = "O engenheiro indicado não está na lista de engenheiros do gerador (inativo ou sem acesso)."; continue; }
    registrarLeituraCpf({ usuarioId, obraId, engenheiroId: dados.id, origem: origemLeitura, comCpf: !!dados.cpf });
    resultado[papel] = { id: e.id, fonte: e.fonte, escolhido: e.escolhido, dados: { nome: dados.nome, email: dados.email, telefone: dados.telefone, crea: dados.crea, creaUf: dados.creaUf, cpf: dados.cpf, perfilAtivo: dados.perfilAtivo, temPerfil: dados.temPerfil } };
  }
  return resultado;
}

/**
 * Fontes de "Dados automáticos" com a origem de cada valor e o motivo do que falta. A falha ao ler a PCI
 * vinculada deixa de ser engolida: vira motivo na tela.
 * Santa Fé (diferença mantida): sem lead do CRM, o proponente continua vindo do nome/telefone do cadastro da obra
 * (regra anterior do Santa Fé), com o rótulo "Cadastro da obra (cliente sem lead do CRM)".
 */
export async function fontesAutomaticasPci(obraId: string, ids: IdsEngenheiros = {}, usuarioId: string | null = null, origemLeitura = "dados_automaticos"): Promise<FontesPreenchimentoPci> {
  const o = await obraDoGerador(obraId);
  const motivos: NonNullable<FontesPreenchimentoPci["motivos"]> = {};
  let pci: FormularioPci | null = null;
  if (!o.pci) motivos.pci = "A obra não tem PCI vinculada.";
  else {
    try { pci = lerFormularioPci(new Uint8Array(o.pci.versao.dados)); }
    catch (e) { motivos.pci = `A PCI vinculada não pôde ser lida (${e instanceof Error ? e.message : "arquivo inválido"}).`; }
  }
  const local = cidadeEstadoDoEndereco(o.endereco);
  const idPci = (o.pci?.versao.parsed as { identificacao?: { latitude?: unknown; longitude?: unknown } } | null)?.identificacao;
  const coordenadas = coordenadasSalvas(o.imovel?.latitude, o.imovel?.longitude)
    ?? coordenadasSalvas(o.latitude, o.longitude)
    ?? (idPci ? coordenadasDaPci(idPci.latitude, idPci.longitude) : null);
  if (!coordenadas) motivos.coordenadas = "A obra não tem localização exata no Mapa operacional.";
  const lead = o.leadVinculado;
  const cliente = lead
    ? { nome: lead.nome, cpf: lead.cpf, email: lead.email, telefone: lead.telefone, endereco: lead.endereco, bairro: lead.bairro }
    : o.clienteNome || o.clienteTel ? { nome: o.clienteNome || null, cpf: null, email: null, telefone: o.clienteTel || null, endereco: null, bairro: null } : null;
  if (!cliente) motivos.cliente = "A obra não tem cliente do CRM vinculado.";
  const eng = await engenheirosDaObra(obraId, o.servicoLeadId, ids, usuarioId, origemLeitura);
  return {
    obra: {
      titulo: o.nome, endereco: o.endereco, cidade: local?.cidade ?? null, uf: local?.estado ?? null, area: num(o.area),
      valorImovel: num(o.vgv), valorTerreno: num(o.custoTerreno), valorFinanciado: num(o.financiamentoCef),
      inicio: iso(o.dataInicio), termino: iso(o.dataPrevisaoFim),
    },
    cliente,
    coordenadas,
    pci,
    rtp: eng.rtp,
    rte: eng.rte,
    rotulos: { cliente: lead ? "Cliente do CRM (lead vinculado à obra)" : "Cadastro da obra (cliente sem lead do CRM)", pci: "PCI vinculada à obra" },
    motivos: { ...motivos, ...eng.motivos },
  };
}

/** Pré-preenchimento com o que o sistema já sabe da obra (sem inventar). */
export async function preenchimentoAutomaticoPci(obraId: string, usuarioId: string | null = null): Promise<FormularioPci> {
  return preencherPciAutomatico(await fontesAutomaticasPci(obraId, {}, usuarioId));
}

/** Abertura sem rascunho: o formulário e o relatório (fontes, escolhas de pessoa, o que faltou). */
async function aberturaAutomaticaPci(obraId: string, usuarioId: string | null) {
  const s = sugestoesAutomaticasPci(await fontesAutomaticasPci(obraId, {}, usuarioId));
  const { formulario, ...relatorio } = compararPreenchimentoPci(formularioPciVazio(), s.sugestoes, s.ausencias);
  return { formulario, relatorio };
}

/** "Dados automáticos": sugestões com fonte e o que não foi encontrado (a tela compara e pede confirmação). */
export async function sugestoesAutomaticasDaObraPci(obraId: string, ids: IdsEngenheiros, usuarioId: string | null = null) {
  return sugestoesAutomaticasPci(await fontesAutomaticasPci(obraId, ids, usuarioId));
}

// ─── modelos de preenchimento (paridade 17/11, Prospecta EPIC-024 S-09) ─────────────────────────────────────

type LinhaModeloPreenchimento = {
  id: string; nome: string; versao: number; anteriorId: string | null; dados: unknown; observacao: string | null;
  obraOrigemId: string | null; criadoPorId: string | null; criadoEm: Date; excluidoEm: Date | null; substituido: boolean;
};

/** Resumo para a tela. O nome da obra de origem costuma ter o nome do cliente: só o admin vê. */
async function resumosModelo(ls: LinhaModeloPreenchimento[], admin: boolean) {
  const autores = await nomesDeUsuarios(ls.map((l) => l.criadoPorId));
  const obraIds = admin ? Array.from(new Set(ls.map((l) => l.obraOrigemId).filter((x): x is string => !!x))) : [];
  const obras = new Map((obraIds.length ? await prisma.obra.findMany({ where: { id: { in: obraIds } }, select: { id: true, nome: true } }) : []).map((o) => [o.id, o.nome]));
  return ls.map((l) => ({
    id: l.id, nome: l.nome, versao: l.versao, anteriorId: l.anteriorId, observacao: l.observacao,
    obraOrigemId: admin ? l.obraOrigemId : null, obraOrigem: admin && l.obraOrigemId ? obras.get(l.obraOrigemId) ?? null : null,
    autor: l.criadoPorId ? autores.get(l.criadoPorId) ?? null : null, criadoEm: l.criadoEm.toISOString(),
    resumo: resumoModeloPreenchimentoPci(extrairModeloPreenchimentoPci(l.dados)),
  }));
}

/** Última versão de cada modelo não excluído. */
export async function listarModelosPreenchimentoPci(admin = false) {
  const ls = await prisma.pciModeloPreenchimento.findMany({ where: { excluidoEm: null, sucessor: { is: null } }, orderBy: { id: "asc" } });
  ls.sort((a, b) => a.nome.toLocaleLowerCase("pt-BR").localeCompare(b.nome.toLocaleLowerCase("pt-BR"), "pt-BR") || a.id.localeCompare(b.id));
  return resumosModelo(ls, admin);
}

/** Cadeia de versões a partir de `id` para trás (inclusive excluídas), mais nova primeiro. */
async function cadeiaModelo(id: string): Promise<LinhaModeloPreenchimento[]> {
  const cadeia: LinhaModeloPreenchimento[] = [];
  let atual: string | null = id;
  const vistos = new Set<string>();
  while (atual && !vistos.has(atual) && cadeia.length < 500) {
    vistos.add(atual);
    const l: LinhaModeloPreenchimento | null = await prisma.pciModeloPreenchimento.findUnique({ where: { id: atual } });
    if (!l) break;
    cadeia.push(l);
    atual = l.anteriorId;
  }
  return cadeia;
}

const MENSAGEM_VERSAO_CONCORRENTE_PCI = "Outra pessoa salvou uma versão deste modelo agora. Atualize a lista e tente de novo.";

/** Violação de unicidade do Postgres (P2002 do Prisma ou 23505): qual restrição, ou null. */
function violacaoUnicaPci(e: unknown): string | null {
  const o = e as { code?: unknown; meta?: { target?: unknown; constraint?: unknown }; message?: unknown } | null;
  if (!o || typeof o !== "object") return null;
  const texto = `${String(o.message ?? "")} ${JSON.stringify(o.meta ?? {})}`;
  if (o.code !== "P2002" && o.code !== "23505" && !/duplicate key|unique constraint/i.test(texto)) return null;
  if (/nome_atual_uidx|lower\(|"nome"|\bnome\b/.test(texto)) return "nome";
  if (/anteriorId/.test(texto)) return "anterior";
  return "desconhecida";
}

/**
 * Salva os dados técnicos da obra como modelo (ou nova versão de um modelo). O servidor tira os dados
 * pessoais/específicos (lista de permissão) — não confia no que vem do navegador — e RECUSA texto livre com CPF,
 * CNPJ, e-mail ou telefone (a pessoa vê o campo e corrige; nada some em silêncio).
 */
export async function salvarModeloPreenchimentoPci(entrada: { obraId: string; nome: unknown; formulario: unknown; observacao?: string | null; novaVersaoDe?: string | null }, autorId: string) {
  await obraDoGerador(entrada.obraId);
  let nome: string;
  try { nome = validarNomeModeloPreenchimentoPci(entrada.nome); } catch (e) { throw new ErroGeradorPci(e instanceof Error ? e.message : "Nome inválido."); }
  const dados = extrairModeloPreenchimentoPci(normalizarFormularioPci(entrada.formulario));
  if (!Object.keys(dados.campos).length && !dados.custos.some((x) => x !== null) && !dados.cronograma.some((x) => x !== null))
    throw new ErroGeradorPci("Não há dados técnicos para guardar no modelo (memorial, sistema construtivo, custos ou cronograma).");
  const observacao = typeof entrada.observacao === "string" && entrada.observacao.trim() ? entrada.observacao.trim().slice(0, 500) : null;
  const pessoais = dadosPessoaisNoModeloPci({ nome, observacao, dados });
  if (pessoais.length) {
    // O trecho (meio mascarado) ajuda a achar o dado num memorial longo.
    throw new ErroGeradorPci(`O modelo não pode levar dados pessoais. Tire antes de salvar: ${pessoais.map((p) => `${p.campo} (${p.tipos.join(", ")}: ${p.trechos.map((t) => `"${t}"`).join(", ")})`).join("; ")}.`);
  }
  const avisos = avisosEmpresaNoModeloPci({ nome, observacao, dados });
  let versao = 1;
  let anterior: string | null = null;
  if (entrada.novaVersaoDe) {
    const base = typeof entrada.novaVersaoDe === "string" && ID_TEXTO.test(entrada.novaVersaoDe)
      ? await prisma.pciModeloPreenchimento.findUnique({ where: { id: entrada.novaVersaoDe }, include: { sucessor: { select: { id: true } } } })
      : null;
    if (!base || base.excluidoEm) throw new ErroGeradorPci("Modelo não encontrado.");
    if (base.sucessor) throw new ErroGeradorPci("Este modelo já tem uma versão mais nova. Atualize a lista e salve sobre a última versão.");
    versao = base.versao + 1;
    anterior = base.id;
  }
  // Nome único entre os modelos — também na nova versão (não pode tomar o nome de OUTRO modelo).
  const repetido = (await prisma.pciModeloPreenchimento.findMany({ where: { excluidoEm: null, sucessor: { is: null } }, select: { id: true, nome: true } }))
    .find((m) => m.id !== anterior && m.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (repetido) throw new ErroGeradorPci(`Já existe o modelo "${repetido.nome}". ${anterior ? "Escolha outro nome para esta versão." : "Salve como nova versão dele ou escolha outro nome."}`);
  try {
    const id = await prisma.$transaction(async (tx) => {
      // Nova versão: marca a anterior como substituída na MESMA transação (o índice único parcial do nome vale só
      // para a versão atual); se outra pessoa já salvou a sucessora, nada é gravado.
      if (anterior) {
        const marcada = await tx.pciModeloPreenchimento.updateMany({ where: { id: anterior, substituido: false, excluidoEm: null }, data: { substituido: true } });
        if (!marcada.count) throw new ErroGeradorPci(MENSAGEM_VERSAO_CONCORRENTE_PCI);
      }
      const novo = await tx.pciModeloPreenchimento.create({
        data: { nome, versao, anteriorId: anterior, dados: dados as unknown as Prisma.InputJsonValue, observacao, obraOrigemId: entrada.obraId, criadoPorId: autorId },
        select: { id: true },
      });
      return novo.id;
    });
    return { id, nome, versao, avisos };
  } catch (e) {
    if (e instanceof ErroGeradorPci) throw e;
    const violacao = violacaoUnicaPci(e);
    if (violacao === "nome") throw new ErroGeradorPci(`Já existe o modelo "${nome}" (outra pessoa acabou de salvar com este nome). Atualize a lista e salve como nova versão dele ou escolha outro nome.`);
    if (violacao) throw new ErroGeradorPci(MENSAGEM_VERSAO_CONCORRENTE_PCI);
    throw e;
  }
}

/** Dados técnicos de uma versão (inclusive anterior), para aplicar em outra obra. */
export async function obterModeloPreenchimentoPci(id: string, admin = false) {
  const l = ID_TEXTO.test(id) ? await prisma.pciModeloPreenchimento.findUnique({ where: { id } }) : null;
  if (!l || l.excluidoEm) throw new ErroGeradorPci("Modelo não encontrado.");
  return { ...(await resumosModelo([l], admin))[0], dados: extrairModeloPreenchimentoPci(l.dados) };
}

/** Versões de um modelo (da indicada para trás), mais nova primeiro. */
export async function historicoModeloPreenchimentoPci(id: string, admin = false) {
  if (!ID_TEXTO.test(id)) throw new ErroGeradorPci("Modelo não encontrado.");
  return resumosModelo((await cadeiaModelo(id)).filter((l) => !l.excluidoEm), admin);
}

/**
 * Exclusão LÓGICA do modelo (todas as versões). Só o admin ou o AUTOR ORIGINAL (quem salvou a versão 1) — quem
 * só acrescentou uma versão não apaga o modelo de outra pessoa.
 */
export async function excluirModeloPreenchimentoPci(id: string, usuario: { id: string; admin: boolean }) {
  const l = ID_TEXTO.test(id) ? await prisma.pciModeloPreenchimento.findUnique({ where: { id }, include: { sucessor: { select: { id: true } } } }) : null;
  if (!l || l.excluidoEm) throw new ErroGeradorPci("Modelo não encontrado.");
  if (l.sucessor) throw new ErroGeradorPci("Exclua pela última versão do modelo (atualize a lista).");
  const cadeia = await cadeiaModelo(id);
  const original = cadeia[cadeia.length - 1];
  if (!usuario.admin && original?.criadoPorId !== usuario.id) throw new ErroGeradorPci("Só o administrador ou quem criou o modelo pode excluí-lo.");
  const ativas = cadeia.filter((v) => !v.excluidoEm);
  await prisma.pciModeloPreenchimento.updateMany({ where: { id: { in: ativas.map((v) => v.id) }, excluidoEm: null }, data: { excluidoEm: new Date(), excluidoPorId: usuario.id } });
  return { nome: l.nome, versoes: ativas.length };
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

/** Rascunho gravado (normalizado), para comparar confirmações já registradas. */
async function rascunhoGravado(obraId: string): Promise<FormularioPci | null> {
  const r = await prisma.pciGeradorRascunho.findUnique({ where: { obraId }, select: { dados: true } });
  return r ? normalizarFormularioPci(r.dados) : null;
}

/**
 * Paridade 17/11 (Prospecta S-09, portão 2, L3): a procedência que veio do navegador é conferida com as fontes de
 * hoje (as mesmas de "Dados automáticos") — só quando o formulário cita alguma fonte conferível.
 */
async function conferirProcedenciaNoServidor(obraId: string, form: FormularioPci, usuarioId: string): Promise<FormularioPci> {
  const citaFonte = Object.values(form.procedencia ?? {}).some((o) => o.split("+").some((x) => /^(engenheiro:[A-Za-z0-9_-]{1,64}|crm|pci)$/.test(x)));
  if (!citaFonte) return form;
  const s = sugestoesAutomaticasPci(await fontesAutomaticasPci(obraId, { rtp: form.rtpEngenheiroId, rte: form.rteEngenheiroId }, usuarioId, "conferencia_geracao"));
  const r = conferirProcedenciaPci(form, s.sugestoes);
  if (r.rebaixadas.length) console.info(JSON.stringify({ evento: "pci.procedencia_rebaixada", usuarioId, obraId, campos: r.rebaixadas, em: new Date().toISOString() }));
  return r.formulario;
}

/** Paridade 17/11 (Prospecta S-09, portão 2, L4): quem confirmou e quando (servidor) + log estruturado só com ids. */
async function registrarConfirmacoes(obraId: string, form: FormularioPci, usuarioId: string): Promise<FormularioPci> {
  const agora = new Date();
  const r = registrarConfirmacoesPci(form, await rascunhoGravado(obraId), usuarioId, agora);
  for (const pessoa of r.novas) console.info(JSON.stringify({ evento: "pci.pessoa_confirmada", usuarioId, obraId, pessoa, em: agora.toISOString() }));
  return r.formulario;
}

async function gravarRascunhoPci(obraId: string, form: FormularioPci, autorId: string) {
  const dados = form as unknown as Prisma.InputJsonValue;
  await prisma.pciGeradorRascunho.upsert({
    where: { obraId },
    create: { obraId, dados, atualizadoPorId: autorId },
    update: { dados, atualizadoPorId: autorId, atualizadoEm: new Date() },
  });
}

export async function salvarRascunhoPci(obraId: string, entrada: unknown, autorId: string) {
  await obraDoGerador(obraId);
  let form = normalizarFormularioPci(entrada);
  // Lote 03, correções 06/07: valores inválidos (fora da lista, fora de 0–100, acumulado diminuindo) não são salvos.
  const erros = errosPci(form, { paraGerar: false });
  if (erros.length) throw new ErroGeradorPci(`Corrija antes de salvar: ${erros.join(" ")}`);
  form = await registrarConfirmacoes(obraId, form, autorId);
  await gravarRascunhoPci(obraId, form, autorId);
  return { form, pendencias: pendenciasPci(form) };
}

/** Dados da aba "Gerador de PCI" do Editar Obra. */
export async function carregarGeradorPci(obraId: string, usuarioId: string | null = null) {
  await obraDoGerador(obraId);
  const rascunho = await prisma.pciGeradorRascunho.findUnique({ where: { obraId } });
  const modelo = await modeloAtualPci();
  // Paridade 17/11 (S-09): sem rascunho, a abertura mostra o mesmo relatório do botão (fontes, escolhas de pessoa).
  const abertura = rascunho ? null : await aberturaAutomaticaPci(obraId, usuarioId);
  const formulario = rascunho ? normalizarFormularioPci(rascunho.dados) : abertura!.formulario;
  const autor = rascunho?.atualizadoPorId ? (await nomesDeUsuarios([rascunho.atualizadoPorId])).get(rascunho.atualizadoPorId) ?? null : null;
  const engenheiros = (await listarEngenheiros()).map((e) => ({ id: e.id, nome: e.nome, email: e.email, telefone: e.telefone, crea: e.crea, creaUf: e.creaUf, engenheiro: e.engenheiro }));
  return {
    modelo: modelo ? { versao: modelo.versao, arquivo: modelo.arquivo, formato: modelo.formato, enviadoEm: modelo.enviadoEm.toISOString() } : null,
    ...(await disponibilidadeGeracaoPci(modelo)),
    formulario,
    preenchimento: abertura?.relatorio ?? null,
    origem: rascunho ? ("rascunho" as const) : ("automatico" as const),
    rascunhoEm: rascunho ? rascunho.atualizadoEm.toISOString() : null,
    rascunhoAutor: autor,
    engenheiros,
    historico: await historicoPci(obraId),
  };
}
export type DadosGeradorPci = Awaited<ReturnType<typeof carregarGeradorPci>>;

export async function gerarPciDaObra(obraId: string, entrada: unknown, autor: { id: string; nome: string | null }) {
  const obra = await obraDoGerador(obraId);
  // Paridade 17/11 (S-09): a procedência do navegador é conferida; nome e CPF de fontes diferentes bloqueiam (errosPci).
  let form = await conferirProcedenciaNoServidor(obraId, normalizarFormularioPci(entrada), autor.id);
  // Lote 03, correções 06/07: valores inválidos, cronograma incompleto ou fora da lista bloqueiam.
  const erros = errosPci(form, { paraGerar: true });
  if (erros.length) throw new ErroGeradorPci(`Corrija antes de gerar: ${erros.join(" ")}`);
  const atual = await modeloAtualPci();
  if (!atual) throw new ErroGeradorPci("Nenhum modelo de PCI cadastrado. Envie o modelo oficial em Integrações › PCI da CAIXA.");
  const modelo = await modeloParaGerarPci(atual);
  if (!modelo) throw new ErroGeradorPci("Modelo não encontrado.");
  form = await registrarConfirmacoes(obraId, form, autor.id);
  await gravarRascunhoPci(obraId, form, autor.id);
  let planilha;
  try {
    planilha = gerarPlanilhaPci(new Uint8Array(modelo.dados), modelo.formato as FormatoModeloPci, form);
    if (modelo.aviso) planilha.avisos.unshift(modelo.aviso);
  } catch (e) {
    throw new ErroGeradorPci(e instanceof Error ? e.message : "Não foi possível preencher o modelo.");
  }
  const agora = new Date();
  const pdf = gerarPdfPci(form, { obraTitulo: obra.nome, modeloVersao: modelo.versao, modeloArquivo: modelo.nome, geradoEm: agora, autor: autor.nome });
  const g = await prisma.pciGerada.create({
    data: {
      obraId, modeloId: modelo.id, modeloVersao: modelo.versao, dados: form as unknown as Prisma.InputJsonValue, avisos: planilha.avisos,
      planilhaNome: nomeArquivoPciGerada(form.campos.proponenteNome, obra.nome, modelo.versao, planilha.formato), planilhaFormato: planilha.formato,
      planilha: new Uint8Array(planilha.bytes), pdfNome: nomeArquivoPciGerada(form.campos.proponenteNome, obra.nome, modelo.versao, "pdf"),
      pdf: new Uint8Array(pdf), criadoPorId: autor.id, criadoEm: agora,
    },
    select: { id: true },
  });
  // Pedido de 29/10: planilha e PDF também em Obras/<Obra>/Gerador de PCI.
  const { copiarParaDrive } = await import("@/lib/drive-organizacao");
  await copiarParaDrive("pciGerada", g.id);
  return { id: g.id, avisos: planilha.avisos, pendencias: pendenciasPci(form) };
}

export async function arquivoPciGerada(obraId: string, id: string, tipo: "planilha" | "pdf") {
  const g = await prisma.pciGerada.findFirst({ where: { id, obraId }, select: { planilhaNome: true, planilhaFormato: true, planilha: tipo === "planilha", pdfNome: true, pdf: tipo === "pdf" } });
  if (!g) return null;
  return tipo === "pdf"
    ? { nome: g.pdfNome, formato: "pdf", bytes: new Uint8Array(g.pdf!) }
    : { nome: g.planilhaNome, formato: g.planilhaFormato, bytes: new Uint8Array(g.planilha!) };
}
