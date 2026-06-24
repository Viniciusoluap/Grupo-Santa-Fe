"use client";
import { useTransition } from "react";
import { excluirAvaliacao } from "@/lib/actions/avaliacoes";

export function ExcluirAvaliacaoBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirAvaliacao(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-bold text-red-500 hover:underline disabled:opacity-40 ml-3"
    >
      {isPending ? "..." : "Excluir"}
    </button>
  );
}
