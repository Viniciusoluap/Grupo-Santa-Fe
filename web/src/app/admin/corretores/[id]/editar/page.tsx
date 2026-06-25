import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { editarCorretor } from "@/lib/actions/corretores";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";

const specialties = [
  "Compra e Venda",
  "Financiamento MCMV",
  "Financiamento Convencional",
  "Locação",
  "Lotes",
  "Alto Padrão",
  "Regularização Imobiliária",
  "Projetos de Engenharia",
];

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarCorretorPage({ params }: PageProps) {
  const { id } = await params;
  const c = await prisma.corretor.findUnique({ where: { id } });
  if (!c) notFound();

  let especialidades: string[] = [];
  try { especialidades = JSON.parse(c.especialidades) as string[]; } catch { /* ignore */ }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/corretores" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Corretores
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Corretor</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={editarCorretor} className="space-y-5">
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo *</label>
              <input type="text" name="nome" required defaultValue={c.nome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CRECI *</label>
              <input type="text" name="creci" required defaultValue={c.creci}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone / WhatsApp *</label>
              <PhoneInput name="telefone" required defaultValue={c.telefone ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail *</label>
              <input type="email" name="email" required defaultValue={c.email}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select name="ativo"
                defaultValue={c.ativo ? "true" : "false"}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="especialidades[]" value={s}
                    defaultChecked={especialidades.includes(s)}
                    className="accent-[var(--brand-yellow)]" />
                  <span className="text-xs text-gray-600">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Salvando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Salvar Alterações
            </SubmitButton>
            <Link href="/admin/corretores"
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
