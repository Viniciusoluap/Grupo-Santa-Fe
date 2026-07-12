"use server";
import { auth } from "@/auth";

import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export async function criarLead(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const servicos = formData.getAll("servicos") as string[];
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;

  const senhaRaw = (formData.get("senha") as string) || null;
  const senhaHash = senhaRaw ? await bcrypt.hash(senhaRaw, 10) : null;

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
      senhaAcesso: senhaHash,
    },
  });

  // Auto-criar processos para cada serviço selecionado
  await criarProcessosDoLead(lead.id, nome, telefone, servicos);

  await notificarAdmins("novo_lead", "Novo lead cadastrado", `${nome} — ${JSON.stringify(servicos)}`, "/admin/leads").catch(() => {});
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

async function criarProcessosDoLead(leadId: string, nome: string, telefone: string, servicos: string[]) {
  const tarefas: Promise<unknown>[] = [];

  for (const servico of servicos) {
    if (servico === "Financiamento MCMV" || servico === "Financiamento Convencional") {
      tarefas.push(
        prisma.financiamento.create({
          data: {
            clienteNome: nome,
            clienteTel: telefone,
            imovel: "A definir",
            tipo: servico === "Financiamento MCMV" ? "MCMV" : "Convencional",
            banco: "A definir",
            valorImovel: 0,
            valorFinanciado: 0,
            entrada: 0,
            taxa: 0,
            prazo: 0,
            leadId,
          },
        })
      );
    }

    if (servico === "Obra e reforma") {
      tarefas.push(
        prisma.obra.create({
          data: {
            nome: `Obra — ${nome}`,
            tipo: "reforma",
            clienteNome: nome,
            clienteTel: telefone,
            endereco: "A definir",
            area: 0,
            valorTotal: 0,
            engenheiroResp: "A definir",
            leadId,
          },
        })
      );
    }

    if (servico === "Projeto de engenharia") {
      tarefas.push(
        prisma.projeto.create({
          data: {
            nome: `Projeto — ${nome}`,
            tipo: "projeto_completo",
            clienteNome: nome,
            clienteTel: telefone,
            engenheiro: "A definir",
            valorProjeto: 0,
            leadId,
          },
        })
      );
    }

    if (servico === "Regularização imobiliária") {
      tarefas.push(
        prisma.regularizacao.create({
          data: {
            nome: `Regularização — ${nome}`,
            tipo: "regularizacao_escritura",
            clienteNome: nome,
            clienteTel: telefone,
            endereco: "A definir",
            responsavel: "A definir",
            valorServico: 0,
            leadId,
          },
        })
      );
    }

    if (servico === "Avaliação de imóvel") {
      const numero = `AVL-${Date.now()}`;
      tarefas.push(
        prisma.avaliacao.create({
          data: {
            numero,
            tipo: "mercado",
            finalidade: "compra_venda",
            clienteNome: nome,
            clienteTel: telefone,
            endereco: "A definir",
            bairro: "A definir",
            avaliador: "A definir",
          },
        })
      );
    }
  }

  await Promise.allSettled(tarefas);
}

export async function enviarContato(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
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
  revalidatePath("/admin/leads");
  redirect("/contato?enviado=1");
}

export async function editarLead(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const servicos = formData.getAll("servicos") as string[];
  await prisma.lead.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: (formData.get("email") as string) || undefined,
      servico: JSON.stringify(servicos.length > 0 ? servicos : ["Outro"]),
      origem: (formData.get("origem") as string) || "site",
      orcamento: formData.get("orcamento") ? parseFloat(formData.get("orcamento") as string) : null,
      notas: (formData.get("notas") as string) || "",
      corretorId: (formData.get("corretorId") as string) || undefined,
    },
  });
  revalidatePath("/admin/leads");
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
