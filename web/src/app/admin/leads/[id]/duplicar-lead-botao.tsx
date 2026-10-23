"use client";
// Lote 23/10, etapa 6: "Duplicar lead" no topo do lead.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { duplicarLead } from "@/lib/actions/leads";
import { textoConfirmacaoDuplicar } from "@/lib/crm/lead-duplicar";

export function DuplicarLeadBotao({ leadId, nome }: { leadId: string; nome: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(textoConfirmacaoDuplicar(nome))) return;
          setErro(null);
          startTransition(async () => {
            const r = await duplicarLead(leadId);
            if (r.ok) router.push(`/admin/leads/${r.id}`);
            else setErro(r.erro);
          });
        }}
        className="flex items-center gap-1 border border-[var(--brand-dark)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-dark)] hover:bg-gray-50 disabled:opacity-60"
      >
        <Copy size={12} /> {pending ? "Duplicando…" : "Duplicar lead"}
      </button>
      {erro && <p role="alert" className="mt-1 max-w-56 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}
