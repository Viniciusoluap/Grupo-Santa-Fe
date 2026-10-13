"use server";
import { exigirModuloAcao, exigirAdminAtivo } from "@/lib/auth/modulos";

import { prisma } from "@/lib/db";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Negócio vinculado é obrigatório (EPIC-008): o formulário só permite escolher
// imóvel/financiamento/obra pré-cadastrados (ou descrever um "Extra").
function lerNegocioEValor(formData: FormData) {
  const imovel = ((formData.get("imovel") as string) || "").trim();
  if (!imovel) throw new Error("Selecione o imóvel/negócio vinculado à comissão.");
  const valor = parseFloat(formData.get("valor") as string);
  if (!Number.isFinite(valor) || valor < 0) throw new Error("Informe um valor de comissão válido.");
  // ID real do negócio escolhido: é ele (não o rótulo, que pode se repetir)
  // que a edição usa para reencontrar o registro e recalcular a comissão.
  const tipoNegocio = (formData.get("tipoNegocio") as string) || "";
  const negocioId = tipoNegocio === "extra" ? null : ((formData.get("negocioId") as string) || "").trim() || null;
  return { imovel, negocioId, valor };
}

// Mutacoes de comissao sao admin-only: um corretor pode ver as proprias
// comissoes (leitura, ja escopada em page.tsx), mas nunca deveria poder
// criar/editar/excluir/aprovar o proprio pagamento - isso seria autoaprovacao.
// Antes, qualquer usuario autenticado (checagem era so `if (!session)`)
// conseguia alterar o valor, reatribuir para outro corretorId, ou marcar
// qualquer comissao (inclusive de outro corretor) como paga.
export async function criarComissao(formData: FormData) {
  await exigirModuloAcao("comissoes", { somenteEquipe: true });
  const vencimentoStr = formData.get("vencimento") as string;
  const pagamentoStr = formData.get("pagamentoEm") as string;
  const beneficiario = (formData.get("beneficiario") as string) || "corretor";
  const corretorId = (formData.get("corretorId") as string) || null;

  await prisma.comissao.create({
    data: {
      beneficiario,
      tipoNegocio: (formData.get("tipoNegocio") as string) || "venda_imovel",
      corretorId: beneficiario === "corretor" ? corretorId : null,
      ...lerNegocioEValor(formData),
      percentual: parseFloat((formData.get("percentual") as string) || "5"),
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
  await exigirModuloAcao("comissoes", { somenteEquipe: true });
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
      ...lerNegocioEValor(formData),
      percentual: parseFloat((formData.get("percentual") as string) || "5"),
      status: (formData.get("status") as string) || "pendente",
      vencimento: new Date(vencimentoStr),
      pagamentoEm: pagamentoStr ? new Date(pagamentoStr) : null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/comissoes");
  redirect("/admin/comissoes");
}

/** Exclusão definitiva (item 03); comissão paga é registro contábil: cancele/estorne. */
export async function excluirComissao(id: string) {
  return capturarErroAcao(async () => {
    await exigirAdminAtivo();
    const r = await excluirServicoDefinitivo("comissao", id);
    revalidatePath("/admin/comissoes");
    return r;
  });
}

export async function alterarStatusComissao(id: string, status: string) {
  await exigirModuloAcao("comissoes", { somenteEquipe: true });
  await prisma.comissao.update({
    where: { id },
    data: {
      status,
      pagamentoEm: status === "paga" ? new Date() : null,
    },
  });
  revalidatePath("/admin/comissoes");
}
