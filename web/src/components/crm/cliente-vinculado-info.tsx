import Link from "next/link";
import { UserCheck, ExternalLink } from "lucide-react";
import { formatTelefone } from "@/lib/utils";

interface Props {
  lead: { id: string; nome: string; telefone: string; email: string | null };
  className?: string;
}

/**
 * Dados do cliente de um registro vinculado ao CRM (EPIC-007). Somente leitura:
 * o lead é a fonte única — a correção é feita no lead e propagada para todos os
 * serviços vinculados automaticamente.
 */
export function ClienteVinculadoInfo({ lead, className = "" }: Props) {
  return (
    <div className={`border border-gray-100 bg-gray-50 px-4 py-3 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cliente (vinculado ao CRM)</p>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--brand-dark)]">
            <UserCheck size={14} className="text-[var(--brand-yellow)] shrink-0" /> {lead.nome}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatTelefone(lead.telefone) || "Sem telefone"} · {lead.email || "Sem e-mail"}
          </p>
        </div>
        <Link
          href={`/admin/leads/${lead.id}/editar`}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--brand-dark)] hover:underline"
        >
          <ExternalLink size={11} /> Editar no CRM
        </Link>
      </div>
    </div>
  );
}
