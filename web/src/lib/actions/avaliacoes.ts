"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

function gerarNumero() {
  const now = new Date();
  return `AVL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function criarAvaliacao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.avaliacao.create({
    data: {
      numero: gerarNumero(),
      tipo: formData.get("tipo") as string,
      finalidade: formData.get("finalidade") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteCpf: (formData.get("clienteCpf") as string) || null,
      clienteTel: formData.get("clienteTel") as string,
      clienteEmail: (formData.get("clienteEmail") as string) || null,
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
      valorServico: formData.get("valorServico") ? parseFloat(formData.get("valorServico") as string) : null,
    },
  });

  revalidatePath("/admin/avaliacoes");
  redirect("/admin/avaliacoes");
}

export async function atualizarStatusAvaliacao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
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
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  await prisma.avaliacao.update({
    where: { id },
    data: {
      tipo: formData.get("tipo") as string,
      finalidade: formData.get("finalidade") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteCpf: (formData.get("clienteCpf") as string) || null,
      clienteTel: formData.get("clienteTel") as string,
      clienteEmail: (formData.get("clienteEmail") as string) || null,
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
      leadId: (formData.get("leadId") as string) || null,
      valorServico: formData.get("valorServico") ? parseFloat(formData.get("valorServico") as string) : null,
    },
  });

  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/admin/avaliacoes/${id}`);
  redirect(`/admin/avaliacoes/${id}`);
}

export async function excluirAvaliacao(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.avaliacao.delete({ where: { id } });
  revalidatePath("/admin/avaliacoes");
}

export async function salvarChecklistAvaliacao(id: string, dados: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.avaliacao.update({
    where: { id },
    data: { caracteristicas: dados },
  });
  // revalidatePath omitido intencionalmente: a resposta com fotos em base64
  // estoura o limite de tamanho do SSR do Vercel ao tentar re-renderizar a página.
  // O componente cliente já exibe "Salvo!" sem precisar de reload.
}

export async function salvarDocumentosAvaliacao(id: string, documentos: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.avaliacao.update({ where: { id }, data: { documentos } });
  // revalidatePath omitido intencionalmente: a página de avaliação contém fotos
  // em base64 no checklist; re-render via server action envia esses dados no
  // response HTML e estoura o limite de memória do iOS Safari.
}

export async function salvarSugestaoAvaliacao(id: string, sugestaoJson: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.avaliacao.update({ where: { id }, data: { sugestaoJson } });
  // revalidatePath omitido intencionalmente: mesma razão das fotos base64.
}
