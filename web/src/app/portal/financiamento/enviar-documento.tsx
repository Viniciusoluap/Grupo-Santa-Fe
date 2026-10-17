"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { enviarFormComProgresso } from "@/lib/envio-progresso";

/** Item 15 (18/10): enviar/substituir o documento do checklist, com progresso real. */
export function EnviarDocumento({ itemId, temArquivo }: { itemId: string; temArquivo: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(file?: File) {
    if (entrada.current) entrada.current.value = "";
    if (!file) return;
    // A Vercel recusa corpos acima de 4,5 MB: avisa antes de enviar.
    if (file.size > 4 * 1024 * 1024) {
      setErro("Envie PDF, JPG ou PNG de até 4 MB.");
      return;
    }
    setErro(null);
    setEnviando(true);
    const dados = new FormData();
    dados.set("arquivo", file);
    try {
      await enviarFormComProgresso(`/api/portal/checklist/${itemId}`, dados, { item: "documento" });
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-1">
      <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="Selecionar documento" onChange={(e) => void enviar(e.target.files?.[0])} />
      <button
        type="button"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
        className="inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-3 py-2 text-xs font-bold text-[var(--brand-yellow)] disabled:opacity-60"
      >
        <Upload size={13} /> {enviando ? "Enviando…" : temArquivo ? "Substituir documento" : "Enviar documento"}
      </button>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
    </div>
  );
}
