"use server";
import { exigirModuloAcao, exigirAdminAtivo } from "@/lib/auth/modulos";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { exigirConfiguracaoParaStatus, textoObrigatorio, numeroObrigatorio, tiposObrigatorios } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro, type TransacaoCRM } from "@/lib/crm/vinculo-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function alterarStatusProjeto(id: string, status: string) {
  await exigirModuloAcao("projetos");
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ['tipo', 'engenheiro', 'valorProjeto'], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarChecklistProjeto(id: string, checklist: string) {
  await exigirModuloAcao("projetos");
  await prisma.projeto.update({ where: { id }, data: { checklist } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarArquivosProjeto(id: string, arquivos: string) {
  await exigirModuloAcao("projetos");
  await prisma.projeto.update({ where: { id }, data: { arquivos } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function alterarStatusProjetoFromDetail(id: string, status: string) {
  await exigirModuloAcao("projetos");
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ["tipo", "engenheiro", "valorProjeto"], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

/** Exclusão definitiva (item 03 + pedido A6): some das listas, pesquisas e totais, junto com os lançamentos. */
export async function excluirProjeto(id: string) {
  return capturarErroAcao(async () => {
    await exigirAdminAtivo();
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
    const atual = await tx.projeto.findUnique({ where: { id }, select: { leadId: true, status: true, engenheiro: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.projeto.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: tiposObrigatorios(formData, PROJETO_TIPO_CONFIG),
        status: atual.status === "aguardando_configuracao" ? "solicitado" : atual.status,
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        ...(await engenheiroDoFormulario(tx, formData, atual.engenheiro)),
        valorProjeto: numeroObrigatorio(formData, "valorProjeto"),
        descricao: (formData.get("descricao") as string) || "",
        prazoEntrega: (formData.get("prazoEntrega") as string) ? new Date(formData.get("prazoEntrega") as string) : null,
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
