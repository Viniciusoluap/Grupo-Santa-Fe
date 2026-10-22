"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { auth } from "@/auth";

import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clienteParaRegistro } from "@/lib/crm/vinculo-lead";

// Avaliações, assim como Financiamentos (Lote 3) e Obras/Projetos/
// Regularização, só nascem vinculadas a um lead do CRM — ver
// @/lib/crm/vinculo-lead.ts (sincronizarServicosDoLead/criarRegistro,
// EPIC-007), usado por @/lib/actions/leads.ts (criarLead/editarLead) quando
// o serviço "Avaliação" é marcado no lead. Criação avulsa foi removida da
// UI (sem botão "Nova Avaliação") e é bloqueada aqui também, como segunda
// linha de defesa.
export async function criarAvaliacao(_formData: FormData): Promise<never> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  throw new Error(
    "Criação avulsa de avaliação não é permitida. Marque o serviço \"Avaliação\" no lead no CRM para criar o processo automaticamente."
  );
}

export async function atualizarStatusAvaliacao(formData: FormData) {
  await exigirModuloAcao("avaliacao");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const data: Record<string, unknown> = { status };

  if (status === "entregue") data.dataEntrega = new Date();
  if (formData.get("valorEstimado")) data.valorEstimado = parseFloat(formData.get("valorEstimado") as string);

  const avaliacao = await prisma.avaliacao.update({ where: { id }, data });

  // Ao marcar como entregue, cria cobrança automática no BPO Financeiro
  if (status === "entregue" && avaliacao.valorServico) {
    const now = new Date();
    const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await prisma.bpoLancamento.create({
      data: {
        clienteNomeLivre: avaliacao.clienteNome,
        tipo: "honorario",
        descricao: `Laudo de Avaliação Imobiliária — ${avaliacao.numero} · ${avaliacao.clienteNome}`,
        valor: avaliacao.valorServico,
        vencimento: now,
        competencia,
        centroCustos: "Avaliação Imobiliária",
        pago: false,
      },
    });
    revalidatePath("/admin/bpo");
  }

  revalidatePath(`/admin/avaliacoes/${id}`);
  revalidatePath("/admin/avaliacoes");
}

export async function editarAvaliacao(formData: FormData) {
  await exigirModuloAcao("avaliacao");
  const id = formData.get("id") as string;
  const atual = await prisma.avaliacao.findUnique({ where: { id }, select: { leadId: true } });
  // Registro vinculado não volta a ser avulso; trocar de lead recopia os dados.
  const leadId = (formData.get("leadId") as string) || atual?.leadId || null;
  const cliente = await clienteParaRegistro(leadId, formData);
  await prisma.avaliacao.update({
    where: { id },
    data: {
      tipo: formData.get("tipo") as string,
      finalidade: formData.get("finalidade") as string,
      ...cliente,
      clienteCpf: (formData.get("clienteCpf") as string) || null,
      endereco: formData.get("endereco") as string,
      bairro: formData.get("bairro") as string,
      cidade: (formData.get("cidade") as string) || "Canaã dos Carajás",
      estado: (formData.get("estado") as string) || "PA",
      areaConstruida: formData.get("areaConstruida") ? parseFloat(formData.get("areaConstruida") as string) : null,
      areaTerreno: formData.get("areaTerreno") ? parseFloat(formData.get("areaTerreno") as string) : null,
      quartos: formData.get("quartos") ? parseInt(formData.get("quartos") as string) : null,
      banheiros: formData.get("banheiros") ? parseInt(formData.get("banheiros") as string) : null,
      vagas: formData.get("vagas") ? parseInt(formData.get("vagas") as string) : null,
      metodologia: (formData.get("metodologia") as string) || "comparativo",
      avaliador: formData.get("avaliador") as string,
      dataVistoria: formData.get("dataVistoria") ? new Date(formData.get("dataVistoria") as string) : null,
      prazoEntrega: formData.get("prazoEntrega") ? new Date(formData.get("prazoEntrega") as string) : null,
      observacoes: (formData.get("observacoes") as string) || "",
      leadId,
      valorServico: formData.get("valorServico") ? parseFloat(formData.get("valorServico") as string) : null,
    },
  });

  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/admin/avaliacoes/${id}`);
  redirect(`/admin/avaliacoes/${id}`);
}

/** Exclusão definitiva (item 03): remove também o vínculo de serviço do CRM que só existia para ela. */
export async function excluirAvaliacao(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("avaliacao", { somenteEquipe: true });
    const r = await excluirServicoDefinitivo("avaliacao", id);
    revalidatePath("/admin/avaliacoes");
    revalidatePath("/admin/leads");
    return r;
  });
}

export async function salvarChecklistAvaliacao(id: string, dados: string) {
  await exigirModuloAcao("avaliacao");
  await prisma.avaliacao.update({
    where: { id },
    data: { caracteristicas: dados },
  });
  // revalidatePath omitido intencionalmente: a resposta com fotos em base64
  // estoura o limite de tamanho do SSR do Vercel ao tentar re-renderizar a página.
  // O componente cliente já exibe "Salvo!" sem precisar de reload.
}

export async function salvarDocumentosAvaliacao(id: string, documentos: string) {
  await exigirModuloAcao("avaliacao");
  await prisma.avaliacao.update({ where: { id }, data: { documentos } });
  // revalidatePath omitido intencionalmente: a página de avaliação contém fotos
  // em base64 no checklist; re-render via server action envia esses dados no
  // response HTML e estoura o limite de memória do iOS Safari.
}

export async function salvarSugestaoAvaliacao(id: string, sugestaoJson: string) {
  await exigirModuloAcao("avaliacao");
  await prisma.avaliacao.update({ where: { id }, data: { sugestaoJson } });
  // revalidatePath omitido intencionalmente: mesma razão das fotos base64.
}

/** Aplicar IA/comparáveis funciona mesmo quando o valor já existe, sem depender de formulário aberto. */
export async function aplicarValorEstimadoAvaliacao(id: string, valor: number, sugestaoJson?: string) {
  await exigirModuloAcao("avaliacao");
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor estimado válido.");
  if (sugestaoJson) {
    if (sugestaoJson.length > 100000) throw new Error("Sugestão muito extensa.");
    JSON.parse(sugestaoJson);
  }
  await prisma.avaliacao.update({ where: { id }, data: { valorEstimado: valor, ...(sugestaoJson ? { sugestaoJson } : {}) } });
  // Não reenviar fotos base64 do checklist por re-render de server action.
  return { valorEstimado: valor };
}
