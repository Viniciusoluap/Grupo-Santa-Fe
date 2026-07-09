import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/auth";
import { ServiceBoard, type BoardLead } from "./_components/service-board";

type SessionUser = { role?: UserRole; corretorId?: string };

function parseServicos(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string" && s.trim() !== "");
    if (typeof v === "string" && v.trim()) return [v];
  } catch {
    if (raw && raw.trim()) return [raw];
  }
  return [];
}

export default async function AdminDashboard() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role ?? "corretor";
  const isCorretor = role === "corretor";
  const corretorId = user?.corretorId;
  const corretorFilter = isCorretor && corretorId ? { corretorId } : {};

  const now = new Date();

  const leadsDb = await prisma.lead.findMany({
    where: corretorFilter,
    orderBy: { atualizadoEm: "desc" },
    select: {
      id: true,
      nome: true,
      telefone: true,
      servico: true,
      status: true,
      orcamento: true,
      criadoEm: true,
      corretor: { select: { nome: true } },
      visitas: {
        where: { status: "agendada", agendadaPara: { gte: now } },
        orderBy: { agendadaPara: "asc" },
        take: 1,
        select: { agendadaPara: true },
      },
    },
  });

  const leads: BoardLead[] = leadsDb.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    servicos: parseServicos(l.servico),
    status: l.status,
    orcamento: l.orcamento,
    corretorNome: l.corretor?.nome ?? null,
    criadoEm: l.criadoEm.toISOString(),
    proximaVisita: l.visitas[0]?.agendadaPara.toISOString() ?? null,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <LayoutGrid size={22} className="text-[var(--brand-dark)]" />
          <div>
            <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Quadro de serviços</h1>
            <p className="text-gray-400 text-sm mt-0.5">Clientes organizados por serviço, com valores e status</p>
          </div>
        </div>
        <Link
          href="/admin/leads"
          className="text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] transition-colors"
        >
          Ver funil de leads
        </Link>
      </div>

      <ServiceBoard leads={leads} />
    </div>
  );
}
