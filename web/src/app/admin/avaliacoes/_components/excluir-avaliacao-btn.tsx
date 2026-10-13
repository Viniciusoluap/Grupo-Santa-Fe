"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirAvaliacao } from "@/lib/actions/avaliacoes";

export function ExcluirAvaliacaoBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const resultado = await excluirAvaliacao(id);
      if (resultado && "erroAcao" in resultado) window.alert(resultado.erroAcao);
      router.refresh();
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
