"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Trash2 } from "lucide-react";
import type { ErroAcao } from "@/lib/acao-resultado";

type Acao = (id: string) => Promise<unknown | ErroAcao>;

function falhou(resultado: unknown): string | null {
  return resultado && typeof resultado === "object" && "erroAcao" in resultado ? String((resultado as ErroAcao).erroAcao) : null;
}

/**
 * Item 03 — duas ações separadas:
 * Cancelar mantém o registro e o histórico; Excluir remove definitivamente
 * (o servidor recusa e explica quando há guarda financeira/jurídica).
 */
export function AcoesExcluirCancelar({ id, rotulo, cancelado, cancelar, excluir, compacto = false }: {
  id: string;
  /** Só ícones (tabelas); o texto fica no title/aria-label. */
  compacto?: boolean;
  rotulo: string;
  cancelado: boolean;
  cancelar?: Acao;
  excluir: Acao;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  function executar(acao: Acao, pergunta: string) {
    if (!window.confirm(pergunta)) return;
    startTransition(async () => {
      const erro = falhou(await acao(id));
      if (erro) window.alert(erro);
      router.refresh();
    });
  }

  const estiloCancelar = compacto ? "p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
    : "text-xs border border-amber-200 hover:bg-amber-50 text-amber-600 font-bold px-3 py-2 flex items-center gap-1";
  const estiloExcluir = compacto ? "p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
    : "text-xs border border-red-200 hover:bg-red-50 text-red-500 hover:text-red-600 font-bold px-3 py-2 flex items-center gap-1";

  return (
    <>
      {cancelar && !cancelado && (
        <button type="button" disabled={pendente} title="Cancelar (mantém o histórico)" aria-label={`Cancelar ${rotulo}`}
          onClick={() => executar(cancelar, `Cancelar "${rotulo}"? O registro continua no sistema com a situação Cancelado.`)}
          className={`${estiloCancelar} transition-colors disabled:opacity-40`}>
          <Ban size={compacto ? 14 : 12} />{!compacto && " Cancelar"}
        </button>
      )}
      <button type="button" disabled={pendente} title="Excluir definitivamente" aria-label={`Excluir ${rotulo}`}
        onClick={() => executar(excluir, `Excluir "${rotulo}" definitivamente? O registro será removido do sistema e esta ação não pode ser desfeita. Os dados do cliente no CRM são preservados.`)}
        className={`${estiloExcluir} transition-colors disabled:opacity-40`}>
        <Trash2 size={compacto ? 14 : 12} />{!compacto && " Excluir"}
      </button>
    </>
  );
}
