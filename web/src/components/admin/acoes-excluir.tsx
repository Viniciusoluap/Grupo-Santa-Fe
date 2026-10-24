"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ErroAcao } from "@/lib/acao-resultado";

type Acao = (id: string) => Promise<unknown | ErroAcao>;

function falhou(resultado: unknown): string | null {
  return resultado && typeof resultado === "object" && "erroAcao" in resultado ? String((resultado as ErroAcao).erroAcao) : null;
}

/**
 * Item 03 + pedido A6 — excluir é excluir (mesmo comportamento da Prospecta):
 * remove o registro definitivamente, junto com os lançamentos dele. Não existe
 * mais "Cancelar".
 */
export function AcoesExcluir({ id, rotulo, excluir, compacto = false }: {
  id: string;
  /** Só ícone (tabelas); o texto fica no title/aria-label. */
  compacto?: boolean;
  rotulo: string;
  excluir: Acao;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  function executar() {
    if (!window.confirm(`Excluir "${rotulo}" definitivamente? O registro e os lançamentos dele serão removidos do sistema e esta ação não pode ser desfeita. Os dados do cliente no CRM são preservados.`)) return;
    startTransition(async () => {
      const erro = falhou(await excluir(id));
      if (erro) window.alert(erro);
      router.refresh();
    });
  }

  const estilo = compacto ? "p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
    : "text-xs border border-red-200 hover:bg-red-50 text-red-500 hover:text-red-600 font-bold px-3 py-2 flex items-center gap-1";

  return (
    <button type="button" disabled={pendente} title="Excluir definitivamente" aria-label={`Excluir ${rotulo}`}
      onClick={executar} className={`${estilo} transition-colors disabled:opacity-40`}>
      <Trash2 size={compacto ? 14 : 12} />{!compacto && " Excluir"}
    </button>
  );
}
