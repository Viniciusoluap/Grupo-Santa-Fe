"use client";

import { useState } from "react";
import { obterVersaoEstudo } from "@/lib/actions/incorporacao";

export function VersoesEstudo({ estudoId, versoes }: {
  estudoId: string;
  versoes: { numero: number; criadoEm: string }[];
}) {
  const [erro, setErro] = useState("");
  async function baixar(numero: number) {
    setErro("");
    try {
      const registro = await obterVersaoEstudo(estudoId, numero);
      const url = URL.createObjectURL(new Blob([JSON.stringify(registro, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `estudo-${estudoId}-versao-${numero}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível obter a versão."); }
  }
  return (
    <section className="bg-white border border-gray-100 p-5 space-y-2">
      <h2 className="font-bold text-[var(--brand-dark)]">Histórico de versões</h2>
      <p className="text-xs text-gray-500">Cada alteração salva um retrato imutável. O histórico anterior à ativação deste recurso não pode ser reconstruído.</p>
      {erro && <p role="alert" className="text-red-700 text-xs">{erro}</p>}
      {versoes.map((v) => (
        <div key={v.numero} className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2 text-sm">
          <span>Versão {v.numero} · {new Date(v.criadoEm).toLocaleString("pt-BR")}</span>
          <button type="button" onClick={() => baixar(v.numero)} className="text-blue-700 underline">Baixar snapshot</button>
        </div>
      ))}
    </section>
  );
}
