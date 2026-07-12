"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { executarAgregacao } from "@/lib/actions/agregador-xml";

export function AgregarImoveisBtn() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await executarAgregacao();
      setResult(res);
      setTimeout(() => setResult(null), 6000);
    });
  }

  return (
    <div className="flex items-center gap-2 relative">
      {result && (
        <span className={`text-xs font-medium max-w-md ${result.ok ? "text-green-600" : "text-yellow-600"}`}>
          {result.msg}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Download size={14} className={isPending ? "animate-bounce" : ""} />
        {isPending ? "Importando…" : "Agregar Imóveis"}
      </button>
    </div>
  );
}
