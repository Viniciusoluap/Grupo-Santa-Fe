import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ClienteVinculadoInfo } from "@/components/crm/cliente-vinculado-info";
import { OBRA_STATUS_SELECIONAVEIS, isObraStatusSelecionavel, obraStatusLabel, tipoProjetoObra } from "@/lib/types/obra";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { carregarProgressoObra } from "@/lib/obras/progresso-dados";
import { EditarObraClient } from "./_components/editar-obra-client";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarObraPage({ params }: PageProps) {
  const session = await auth();
  requirePageRole(session, "admin");

  const { id } = await params;
  const o = await prisma.obra.findUnique({
    where: { id },
    include: {
      leadVinculado: { select: { id: true, nome: true, telefone: true, email: true, corretor: { select: { nome: true } } } },
      servicoLead: { select: { servico: true } },
    },
  });
  if (!o) notFound();
  const [resumo, empreiteiros, progresso, fotos] = await Promise.all([
    carregarResumoObra(id),
    prisma.usuario.findMany({ where: { papel: "empreiteiro", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    carregarProgressoObra(id),
    prisma.obraFoto.findMany({
      where: { obraId: id },
      orderBy: [{ tiradaEm: "desc" }, { criadoEm: "desc" }],
      select: { id: true, legenda: true, tiradaEm: true, incluirNoRelatorio: true },
    }),
  ]);
  if (!resumo || !progresso) notFound();
  const tipoProjeto = tipoProjetoObra(o);
  const corretorNome = o.leadVinculado?.corretor?.nome?.trim() || null;
  const campoSomenteLeitura = "w-full border border-gray-100 px-3 py-2.5 text-sm bg-gray-100 text-gray-600 cursor-not-allowed";

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/obras/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Obra
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Obra</h1>
      </div>

      <EditarObraClient
        resumo={resumo}
        empreiteiros={empreiteiros}
        clienteNome={o.leadVinculado?.nome ?? o.clienteNome}
        corretor={corretorNome}
        escritorioCef={o.escritorioCef}
        datas={{ inicio: resumo.valores.dataInicio ?? "", termino: resumo.valores.dataTerminoPrevista ?? "" }}
        cancelarHref={`/admin/obras/${id}`}
        progresso={progresso}
        fotos={fotos.map((f) => ({ id: f.id, url: `/api/obras/fotos/${f.id}`, legenda: f.legenda, tiradaEm: f.tiradaEm.toISOString(), incluirNoRelatorio: f.incluirNoRelatorio }))}
      >
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome da Obra *</label>
              <input name="nome" type="text" required defaultValue={o.nome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Projeto</label>
              <input type="text" readOnly aria-readonly="true" value={`${tipoProjeto.icon} ${tipoProjeto.label}`} className={campoSomenteLeitura} />
              <p className="text-[11px] text-gray-400 mt-1">
                {tipoProjeto.origem === "crm"
                  ? "Definido pelo serviço vinculado no CRM. Para alterar, edite o lead."
                  : "Obra sem serviço do CRM vinculado: valor antigo preservado. Vincule pelo CRM para regularizar."}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Classificação</label>
              <select name="status" defaultValue={o.status}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {OBRA_STATUS_SELECIONAVEIS.map((valor) => (
                  <option key={valor} value={valor}>{obraStatusLabel(valor)}</option>
                ))}
                {!isObraStatusSelecionavel(o.status) && (
                  <option value={o.status}>{obraStatusLabel(o.status)} (classificação antiga — mantida até ser trocada)</option>
                )}
              </select>
            </div>
            {o.leadVinculado ? (
              <ClienteVinculadoInfo lead={o.leadVinculado} className="sm:col-span-2" />
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente</label>
                <input type="text" readOnly aria-readonly="true" value={o.clienteNome} className={campoSomenteLeitura} />
                <input type="hidden" name="clienteNome" value={o.clienteNome} />
                <input type="hidden" name="clienteTel" value={o.clienteTel ?? ""} />
                <p className="text-[11px] text-gray-400 mt-1">Obra sem lead vinculado: dados antigos preservados. Vincule pelo CRM para regularizar.</p>
              </div>
            )}
            {corretorNome && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Corretor</label>
                <input type="text" readOnly aria-readonly="true" value={corretorNome} className={campoSomenteLeitura} />
                <p className="text-[11px] text-gray-400 mt-1">Corretor vinculado ao lead no CRM.</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
              <input name="endereco" type="text" required defaultValue={o.endereco ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área (m²) *</label>
              <input name="area" type="number" step="0.01" required defaultValue={o.area ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Engenheiro Responsável *</label>
              <input name="engenheiroResp" type="text" required defaultValue={o.engenheiroResp ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
              <textarea name="descricao" rows={3} defaultValue={o.descricao}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
            </div>
          </div>
      </EditarObraClient>
    </div>
  );
}
