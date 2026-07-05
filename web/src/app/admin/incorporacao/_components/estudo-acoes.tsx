"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { excluirEstudo } from "@/lib/actions/incorporacao";

interface Props {
  estudoId: string;
  nome: string;
}

export function EstudoAcoes({ estudoId, nome }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const router = useRouter();

  function handleExcluir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    startTransition(async () => {
      await excluirEstudo(estudoId);
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/admin/incorporacao/${estudoId}/editar`}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        <Pencil size={10} /> Editar
      </Link>
      <button
        type="button"
        onClick={handleExcluir}
        onBlur={() => setConfirmando(false)}
        disabled={pending}
        title={`Excluir o estudo "${nome}"`}
        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 transition-colors disabled:opacity-50 ${
          confirmando
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-red-50 text-red-600 hover:bg-red-100"
        }`}
      >
        {pending ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
        {confirmando ? "Confirmar" : "Excluir"}
      </button>
    </div>
  );
}
