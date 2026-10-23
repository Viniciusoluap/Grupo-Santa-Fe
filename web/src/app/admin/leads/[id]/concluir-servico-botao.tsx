"use client";
// Lote 23/10, etapa 4: "Concluir" no card "Serviços do Cliente" conclui o registro do módulo.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { concluirServicoDoLead } from "@/lib/actions/conclusao-servico";
import { exigirResultado } from "@/lib/acao-resultado";

export function ConcluirServicoBotao({ leadId, modulo, registroId, titulo }: { leadId: string; modulo: string; registroId: string; titulo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Concluir "${titulo}"? O registro do módulo também será marcado como concluído.`)) return;
          startTransition(async () => {
            try {
              const r = exigirResultado(await concluirServicoDoLead(leadId, modulo, registroId));
              setAviso(r.mensagem);
              router.refresh();
            } catch (e) {
              setAviso(e instanceof Error ? e.message : "Não foi possível concluir.");
            }
          });
        }}
        className="flex items-center gap-1 border border-green-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-green-800 hover:bg-green-50 disabled:opacity-60"
      >
        {pending ? "Concluindo…" : "Concluir"}
      </button>
      {aviso && <p role="status" className="mt-1 max-w-48 text-[11px] text-gray-600">{aviso}</p>}
    </div>
  );
}
