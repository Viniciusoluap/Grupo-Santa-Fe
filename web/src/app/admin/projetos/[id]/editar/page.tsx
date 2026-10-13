import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ClienteVinculadoInfo } from "@/components/crm/cliente-vinculado-info";
import { EditarProjetoForm } from "./_components/editar-projeto-form";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarProjetoPage({ params }: PageProps) {
  const session = await auth();
  requirePageRole(session, "admin");

  const { id } = await params;
  const p = await prisma.projeto.findUnique({ where: { id } , include: { leadVinculado: { select: { id: true, nome: true, telefone: true, email: true } } } });
  if (!p) notFound();

  let tiposSelecionados: string[] = [];
  try { tiposSelecionados = JSON.parse(p.tipo ?? "[]") as string[]; } catch { tiposSelecionados = p.tipo ? [p.tipo] : []; }

  // Item 07: colaboradores (e admins) ativos que podem ser engenheiro responsável.
  const engenheiros = await prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["colaborador", "admin"] } },
    select: { id: true, nome: true, papel: true }, orderBy: { nome: "asc" },
  });

  const prazoValue = p.prazoEntrega ? new Date(p.prazoEntrega).toISOString().split("T")[0] : "";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/projetos/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Projeto
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Projeto</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <EditarProjetoForm
          projeto={{ id: p.id, nome: p.nome, status: p.status, clienteNome: p.clienteNome, clienteTel: p.clienteTel, engenheiro: p.engenheiro, engenheiroId: p.engenheiroId, engenheiroRegistro: p.engenheiroRegistro, valorProjeto: p.valorProjeto, descricao: p.descricao }}
          tiposSelecionados={tiposSelecionados}
          prazo={prazoValue}
          engenheiros={engenheiros}
          cliente={p.leadVinculado ? <ClienteVinculadoInfo lead={p.leadVinculado} className="sm:col-span-2" /> : null}
        />
      </div>
    </div>
  );
}
