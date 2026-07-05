import Link from "next/link";
import { Mountain, Plus, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { EstudoAcoes } from "./_components/estudo-acoes";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho:  { label: "Rascunho",  cls: "bg-gray-100 text-gray-500" },
  em_estudo: { label: "Em estudo", cls: "bg-blue-50 text-blue-700" },
  concluido: { label: "Concluído", cls: "bg-green-50 text-green-700" },
};

function hectares(m2: number): string {
  return `${(m2 / 10_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

export default async function IncorporacaoPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const estudos = await prisma.estudoIncorporacao.findMany({
    orderBy: { atualizadoEm: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Mountain size={22} className="text-[var(--brand-dark)]" />
          <div>
            <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Incorporação</h1>
            <p className="text-gray-400 text-sm mt-0.5">Estudos de viabilidade, massa, topografia 3D e urbanístico</p>
          </div>
        </div>
        <Link
          href="/admin/incorporacao/novo"
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Novo estudo
        </Link>
      </div>

      {estudos.length === 0 ? (
        <div className="bg-white border border-gray-100 p-12 text-center">
          <Mountain size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum estudo de incorporação ainda</p>
          <p className="text-gray-400 text-sm mt-1">
            Crie um estudo, envie o KML do terreno e gere a viabilidade completa.
          </p>
          <Link
            href="/admin/incorporacao/novo"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-dark)] underline"
          >
            <Plus size={14} /> Criar primeiro estudo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {estudos.map((e) => {
            const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.rascunho;
            let vgv = 0;
            if (e.viabilidadeJson) {
              try { vgv = JSON.parse(e.viabilidadeJson)?.resultado?.vgv ?? 0; } catch {}
            }
            return (
              <div
                key={e.id}
                className="bg-white border border-gray-100 p-4 hover:border-[var(--brand-yellow)] transition-colors flex flex-col"
              >
                <Link href={`/admin/incorporacao/${e.id}`} className="block">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-bold text-[var(--brand-dark)] truncate">{e.nome}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                    <MapPin size={12} /> {e.municipio}/{e.estado}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Área</p>
                      <p className="font-black text-[var(--brand-dark)]">{e.areaM2 > 0 ? hectares(e.areaM2) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">VGV</p>
                      <p className="font-black text-[var(--brand-dark)]">{vgv > 0 ? formatCurrency(vgv) : "—"}</p>
                    </div>
                  </div>
                </Link>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-50">
                  <EstudoAcoes estudoId={e.id} nome={e.nome} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
