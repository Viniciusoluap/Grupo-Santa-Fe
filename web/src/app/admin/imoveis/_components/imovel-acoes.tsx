"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { excluirImovel } from "@/lib/actions/imoveis";

interface Props {
  id: string;
  titulo: string;
}

export function ImovelAcoes({ id, titulo }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    if (!confirm(`Excluir o imóvel "${titulo}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(() => excluirImovel(id));
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Link
        href={`/imoveis/${id}`}
        target="_blank"
        title="Ver no site"
        className="p-1.5 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-100 transition-colors"
      >
        <Eye size={14} />
      </Link>
      <Link
        href={`/admin/imoveis/${id}/editar`}
        title="Editar"
        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      >
        <Pencil size={14} />
      </Link>
      <button
        onClick={handleExcluir}
        disabled={isPending}
        title="Excluir"
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
