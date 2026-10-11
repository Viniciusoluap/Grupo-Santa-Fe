"use server";
import { auth } from "@/auth";

import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  propagarDadosClienteDoLead,
  resolverResponsavelId,
  sincronizarServicosDoLead,
} from "@/lib/crm/vinculo-lead";

export async function criarLead(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const servicos = formData.getAll("servicos") as string[];
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;

  const senhaRaw = (formData.get("senha") as string) || null;
  const senhaHash = senhaRaw ? await bcrypt.hash(senhaRaw, 10) : null;

  // Responsável = usuário real do sistema; sem escolha explícita, quem cadastrou.
  const responsavelId =
    (await resolverResponsavelId(formData.get("responsavelId") as string)) ??
    (await resolverResponsavelId(session.user?.id));

  const lead = await prisma.lead.create({
    data: {
      nome,
      telefone,
      email: (formData.get("email") as string) || undefined,
      servico: JSON.stringify(servicos.length > 0 ? servicos : ["Outro"]),
      origem: (formData.get("origem") as string) || "site",
      orcamento: formData.get("orcamento")
        ? parseFloat(formData.get("orcamento") as string)
        : null,
      notas: (formData.get("notas") as string) || "",
      corretorId: (formData.get("corretorId") as string) || undefined,
      responsavelId,
      senhaAcesso: senhaHash,
    },
  });

  // Vínculo real (EPIC-007): cada serviço operacional marcado ganha um registro
  // no módulo correspondente, já com os dados do cliente copiados do lead.
  await sincronizarServicosDoLead(lead.id);

  await notificarAdmins("novo_lead", "Novo lead cadastrado", `${nome} — ${JSON.stringify(servicos)}`, "/admin/leads").catch(() => {});
  revalidarModulosVinculados();
  redirect("/admin/leads");
}

function revalidarModulosVinculados() {
  for (const rota of ["/admin/leads", "/admin", "/admin/financiamentos", "/admin/obras", "/admin/projetos", "/admin/regularizacao", "/admin/avaliacoes"]) {
    revalidatePath(rota);
  }
}

// Formulário público de /contato — não autenticado por natureza (visitante do
// site, não usuário do CRM). NÃO adicionar checagem de sessão aqui.
export async function enviarContato(formData: FormData) {
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;
  const email = (formData.get("email") as string) || undefined;
  const servicos = formData.getAll("servicos") as string[];
  const mensagem = (formData.get("mensagem") as string) || "";

  if (!nome || !telefone || servicos.length === 0) return;

  await prisma.lead.create({
    data: {
      nome, telefone, email,
      servico: JSON.stringify(servicos),
      origem: "site",
      notas: mensagem,
    },
  });
  await notificarAdmins("novo_lead", "Novo contato do site", `${nome} — ${servicos.join(", ")}`, "/admin/leads").catch(() => {});

  const { notifyAdminByEmail } = await import("@/lib/email");
  await notifyAdminByEmail({
    titulo: "Nova mensagem recebida pelo site (Contato)",
    linhas: [
      { label: "Nome", valor: nome },
      { label: "Telefone", valor: telefone },
      { label: "Email", valor: email || "" },
      { label: "Serviços", valor: servicos.join(", ") },
      { label: "Mensagem", valor: mensagem },
    ],
  }).catch(() => {});

  revalidatePath("/admin/leads");
  redirect("/contato?enviado=1");
}

export async function editarLead(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const servicos = formData.getAll("servicos") as string[];
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: (formData.get("email") as string) || null,
      servico: JSON.stringify(servicos.length > 0 ? servicos : ["Outro"]),
      origem: (formData.get("origem") as string) || "site",
      orcamento: formData.get("orcamento") ? parseFloat(formData.get("orcamento") as string) : null,
      notas: (formData.get("notas") as string) || "",
      // "Sem corretor" precisa desvincular de verdade (antes `undefined` mantinha o antigo).
      corretorId: (formData.get("corretorId") as string) || null,
      responsavelId: await resolverResponsavelId(formData.get("responsavelId") as string),
    },
    select: { id: true, nome: true, telefone: true, email: true },
  });

  // Lead é a fonte única dos dados do cliente: reflete a edição nos registros
  // vinculados e cria os registros dos serviços recém-marcados.
  await propagarDadosClienteDoLead(lead);
  await sincronizarServicosDoLead(lead.id);

  revalidarModulosVinculados();
  revalidatePath(`/admin/leads/${id}`);
  redirect(`/admin/leads/${id}`);
}

export async function excluirLead(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/admin/leads");
}

export async function alterarStatusLead(leadId: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function adicionarInteracao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const leadId = formData.get("leadId") as string;
  await prisma.interacao.create({
    data: {
      leadId,
      tipo: formData.get("tipo") as string,
      descricao: formData.get("descricao") as string,
      criadoPor: (formData.get("criadoPor") as string) || "Sistema",
    },
  });
  revalidatePath(`/admin/leads/${leadId}`);
}
