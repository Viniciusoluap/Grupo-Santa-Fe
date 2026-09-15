"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Mutacoes de comissao sao admin-only: um corretor pode ver as proprias
// comissoes (leitura, ja escopada em page.tsx), mas nunca deveria poder
// criar/editar/excluir/aprovar o proprio pagamento - isso seria autoaprovacao.
// Antes, qualquer usuario autenticado (checagem era so `if (!session)`)
// conseguia alterar o valor, reatribuir para outro corretorId, ou marcar
// qualquer comissao (inclusive de outro corretor) como paga.
export async function criarComissao(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const vencimentoStr = formData.get("vencimento") as string;
  const pagamentoStr = formData.get("pagamentoEm") as string;
  const beneficiario = (formData.get("beneficiario") as string) || "corretor";
  const corretorId = (formData.get("corretorId") as string) || null;

  await prisma.comissao.create({
    data: {
      beneficiario,
      tipoNegocio: (formData.get("tipoNegocio") as string) || "venda_imovel",
      corretorId: beneficiario === "corretor" ? corretorId : null,
      imovel: formData.get("imovel") as string,
      valor: parseFloat(formData.get("valor") as string),
      percentual: parseFloat((formData.get("percentual") as string) || "6"),
      status: (formData.get("status") as string) || "pendente",
      vencimento: new Date(vencimentoStr),
      pagamentoEm: pagamentoStr ? new Date(pagamentoStr) : null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/comissoes");
  redirect("/admin/comissoes");
}

export async function editarComissao(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const vencimentoStr = formData.get("vencimento") as string;
  const pagamentoStr = formData.get("pagamentoEm") as string;
  const beneficiario = (formData.get("beneficiario") as string) || "corretor";
  const corretorId = (formData.get("corretorId") as string) || null;

  await prisma.comissao.update({
    where: { id },
    data: {
      beneficiario,
      tipoNegocio: (formData.get("tipoNegocio") as string) || "venda_imovel",
      corretorId: beneficiario === "corretor" ? corretorId : null,
      imovel: formData.get("imovel") as string,
      valor: parseFloat(formData.get("valor") as string),
      percentual: parseFloat((formData.get("percentual") as string) || "6"),
      status: (formData.get("status") as string) || "pendente",
      vencimento: new Date(vencimentoStr),
      pagamentoEm: pagamentoStr ? new Date(pagamentoStr) : null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/comissoes");
  redirect("/admin/comissoes");
}

export async function excluirComissao(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.comissao.delete({ where: { id } });
  revalidatePath("/admin/comissoes");
}

export async function alterarStatusComissao(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.comissao.update({
    where: { id },
    data: {
      status,
      pagamentoEm: status === "paga" ? new Date() : null,
    },
  });
  revalidatePath("/admin/comissoes");
}
