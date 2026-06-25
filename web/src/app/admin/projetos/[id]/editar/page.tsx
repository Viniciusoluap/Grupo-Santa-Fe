import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { editarProjeto } from "@/lib/actions/projetos";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarProjetoPage({ params }: PageProps) {
  const { id } = await params;
  const p = await prisma.projeto.findUnique({ where: { id } });
  if (!p) notFound();

  let tiposSelecionados: string[] = [];
  try { tiposSelecionados = JSON.parse(p.tipo) as string[]; } catch { tiposSelecionados = [p.tipo]; }

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
        <form action={editarProjeto} className="space-y-5">
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Projeto *</label>
              <input name="nome" type="text" required defaultValue={p.nome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select name="status" defaultValue={p.status}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {Object.entries(PROJETO_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo de Entrega</label>
              <input name="prazoEntrega" type="date" defaultValue={prazoValue}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
              <input name="clienteNome" type="text" required defaultValue={p.clienteNome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone do Cliente</label>
              <PhoneInput name="clienteTel" defaultValue={p.clienteTel ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Engenheiro Responsável *</label>
              <input name="engenheiro" type="text" required defaultValue={p.engenheiro}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Projeto *</label>
              <CurrencyInput name="valorProjeto" required defaultValue={p.valorProjeto}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipos de Projeto</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROJETO_TIPO_CONFIG).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="tipos" value={k}
                    defaultChecked={tiposSelecionados.includes(k)}
                    className="accent-[var(--brand-yellow)]" />
                  <span className="text-xs text-gray-600">{v.icon} {v.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
            <textarea name="descricao" rows={3} defaultValue={p.descricao}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Salvando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Salvar Alterações
            </SubmitButton>
            <Link href={`/admin/projetos/${id}`}
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
