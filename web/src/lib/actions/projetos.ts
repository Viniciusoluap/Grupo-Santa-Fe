"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { exigirConfiguracaoParaStatus, textoObrigatorio, tiposObrigatorios } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro, type TransacaoCRM } from "@/lib/crm/vinculo-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { projectChecklist } from "@/lib/projeto-documentos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistirDiaPrazoProjeto } from "@/lib/projetos-prazo";
import { emailPedidoRevisao, mensagemPedidoSalvo, validarPedidoRevisao, type SituacaoCanal } from "@/lib/projeto-revisao";
import { sendEmail } from "@/lib/email";

export async function alterarStatusProjeto(id: string, status: string) {
  await exigirModuloAcao("projetos");
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ['tipo', 'engenheiro'], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarChecklistProjeto(id: string, checklist: string) {
  await exigirModuloAcao("projetos");
  const items = JSON.parse(checklist) as { id?: string; texto?: string; feito?: boolean; type?: string }[];
  if (!Array.isArray(items) || items.length > 100 || items.some(c => typeof c.texto !== "string" || !c.texto.trim() || c.texto.length > 500 || typeof c.feito !== "boolean" || typeof c.id !== "string" || c.id.length > 100)) throw new Error("Checklist inválido.");
  await prisma.projeto.update({ where: { id }, data: { checklist: JSON.stringify(items) } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarArquivosProjeto(_id: string, _arquivos: string) {
  await exigirModuloAcao("projetos");
  throw new Error("Use o envio de arquivo editável ou PDF em cada item do checklist.");
}

export async function alterarStatusProjetoFromDetail(id: string, status: string) {
  await exigirModuloAcao("projetos");
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ["tipo", "engenheiro"], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

/** Exclusão definitiva (item 03 + pedido A6): some das listas, pesquisas e totais, junto com os lançamentos. */
export async function excluirProjeto(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("projetos", { somenteEquipe: true });
    const r = await excluirServicoDefinitivo("projeto", id);
    revalidatePath("/admin/projetos");
    revalidatePath("/admin/leads");
    return r;
  });
}

async function editarProjetoImpl(formData: FormData) {
  await exigirModuloAcao("projetos");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.projeto.findUnique({ where: { id }, select: { leadId: true, status: true, engenheiro: true, checklist: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    const tiposJson = tiposObrigatorios(formData, PROJETO_TIPO_CONFIG);
    const tipos = JSON.parse(tiposJson) as string[];
    let anteriores: {id?: string; texto: string; feito: boolean; type?: string}[] = [];
    try { anteriores = JSON.parse(atual.checklist || "[]"); } catch { /* legado vazio */ }
    const checklist = projectChecklist(tipos, anteriores.map(c => ({id:c.id,type:c.type,text:c.texto,done:c.feito})), Object.fromEntries(Object.entries(PROJETO_TIPO_CONFIG).map(([k,v]) => [k,v.label]))).map(c => ({id:c.id,type:c.type,texto:c.text,feito:c.done}));
    const solicitado = String(formData.get("status") || atual.status);
    if (!(solicitado in PROJETO_STATUS_CONFIG)) throw new Error("Status inválido.");
    await tx.projeto.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: tiposJson,
        checklist: JSON.stringify(checklist),
        status: solicitado === "aguardando_configuracao" ? "solicitado" : solicitado,
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        ...(await engenheiroDoFormulario(tx, formData, atual.engenheiro)),
        descricao: (formData.get("descricao") as string) || "",
        prazoEntrega: (formData.get("prazoEntrega") as string) ? persistirDiaPrazoProjeto(formData.get("prazoEntrega") as string) : null,
      },
    });
  });
  revalidatePath("/admin/projetos");
  redirect(`/admin/projetos/${id}`);
}

/** Item 07: devolve a mensagem de validação ao formulário (os dados digitados ficam na tela). */
export async function editarProjeto(formData: FormData) {
  return capturarErroAcao(() => editarProjetoImpl(formData));
}

/**
 * Item 07: engenheiro responsável = colaborador (ou admin) ativo, por ID; o nome
 * exibido vem do cadastro. Texto livre só permanece em registro anterior sem vínculo.
 */
async function engenheiroDoFormulario(tx: TransacaoCRM, formData: FormData, anterior: string | null) {
  const engenheiroId = String(formData.get("engenheiroId") ?? "").trim();
  const registro = String(formData.get("engenheiroRegistro") ?? "").trim().slice(0, 60) || null;
  if (engenheiroId) {
    const u = await tx.usuario.findUnique({ where: { id: engenheiroId }, select: { id: true, nome: true, papel: true, ativo: true } });
    if (!u || !u.ativo || !["colaborador", "admin"].includes(u.papel)) throw new Error("Escolha um colaborador ativo como engenheiro responsável.");
    return { engenheiroId: u.id, engenheiro: u.nome, engenheiroRegistro: registro };
  }
  const legado = String(formData.get("engenheiro") ?? "").trim();
  if (anterior && legado && legado === anterior.trim()) return { engenheiroId: null, engenheiro: legado, engenheiroRegistro: registro };
  throw new Error("Escolha o engenheiro responsável entre os colaboradores cadastrados.");
}

/**
 * Lote 23/10, etapa 2C: salva o pedido de revisão (autor, data, estado) e avisa o
 * colaborador vinculado por notificação interna e e-mail. Cada canal registra a
 * situação real — nunca "enviado" sem destinatário ou com falha no envio.
 */
export async function solicitarRevisaoProjeto(projetoId: string, textoBruto: string) {
  return capturarErroAcao(async () => {
    const usuario = await exigirModuloAcao("projetos", { somenteEquipe: true });
    const texto = validarPedidoRevisao(textoBruto);
    const projeto = await prisma.projeto.findUnique({ where: { id: projetoId }, select: { id: true, nome: true, status: true, clienteNome: true, engenheiroUsuario: { select: { id: true, nome: true, email: true, ativo: true } } } });
    if (!projeto) throw new Error("Projeto não encontrado.");
    const destinatario = projeto.engenheiroUsuario?.ativo ? projeto.engenheiroUsuario : null;
    const autor = usuario.nome || `Usuário ${usuario.id}`;
    const pedido = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projetos WHERE id = ${projetoId} FOR UPDATE`;
      const jaPendente = await tx.projetoRevisao.findFirst({ where: { projetoId, status: "pendente" }, select: { id: true } });
      const criado = await tx.projetoRevisao.create({
        data: { projetoId, solicitadoPorId: usuario.id, solicitadoPorNome: autor, texto, status: "pendente", statusAnteriorProjeto: jaPendente ? null : projeto.status, colaboradorId: destinatario?.id ?? null, situacaoNotificacao: "sem_destinatario", situacaoEmail: "sem_destinatario" },
      });
      await tx.projeto.update({ where: { id: projetoId }, data: { status: "revisao" } });
      return criado;
    });
    const link = `/admin/projetos/${projetoId}`;
    let notificacao: SituacaoCanal = "sem_destinatario";
    let email: SituacaoCanal = "sem_destinatario";
    if (destinatario) {
      try {
        await prisma.notificacao.create({ data: { usuarioId: destinatario.id, tipo: "projeto_revisao", titulo: `Revisão solicitada — ${projeto.nome}`, mensagem: `${autor}: ${texto.slice(0, 400)}`, link } });
        notificacao = "enviado";
      } catch (e) {
        console.error("[solicitarRevisaoProjeto] notificação", e);
        notificacao = "falhou";
      }
      const para = destinatario.email?.trim();
      if (para) {
        const origem = process.env.SITE_URL || "https://www.gruposantafee.com.br";
        const msg = emailPedidoRevisao({ projeto: projeto.nome, cliente: projeto.clienteNome, autor, texto, link: `${origem}${link}` });
        email = (await sendEmail({ to: para, subject: msg.subject, html: msg.html }).catch(() => false)) ? "enviado" : "falhou";
      }
    }
    await prisma.projetoRevisao.update({ where: { id: pedido.id }, data: { situacaoNotificacao: notificacao, situacaoEmail: email } });
    revalidatePath("/admin/projetos");
    revalidatePath(link);
    return { id: pedido.id, notificacao, email, mensagem: mensagemPedidoSalvo(notificacao, email) };
  });
}
