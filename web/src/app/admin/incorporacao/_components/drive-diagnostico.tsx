"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { testarGoogleDrive } from "@/lib/actions/documentos-registro";
import { exigirResultado } from "@/lib/acao-resultado";

type Resultado = Awaited<ReturnType<typeof import("@/lib/incorporacao/registro-drive").diagnosticarDrive>>;

/** Teste real do Google Drive (admin): mostra cada etapa e o motivo exato da falha. */
export function DriveDiagnostico() {
  const [pendente, setPendente] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function testar() {
    setPendente(true); setErro(null);
    try { setResultado(exigirResultado(await testarGoogleDrive())); }
    catch (error) { setErro(error instanceof Error ? error.message : "Falha no teste."); }
    finally { setPendente(false); }
  }

  return (
    <div className="mt-2 space-y-2 text-xs">
      <button type="button" onClick={testar} disabled={pendente}
        className="inline-flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {pendente && <Loader2 size={12} className="animate-spin" />}
        {pendente ? "Testando Google Drive…" : "Testar Google Drive"}
      </button>
      {resultado && (
        <div role="status" className={`border p-3 ${resultado.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <p>{resultado.ok ? "Google Drive funcionando: os próximos arquivos serão gravados no Drive."
            : "Google Drive indisponível. Os arquivos continuam sendo guardados com segurança no banco do sistema."}</p>
          {resultado.etapas.length > 0 && <ul className="mt-1 list-disc pl-4">{resultado.etapas.map((e) => <li key={e.etapa}>{e.etapa}: ok</li>)}</ul>}
          {resultado.explicacao && <p className="mt-1">{resultado.explicacao}</p>}
          {resultado.driveCompartilhado === false && !resultado.ok && <p className="mt-1">A pasta configurada está no &quot;Meu Drive&quot; (fora de um Drive compartilhado).</p>}
        </div>
      )}
      {erro && <p className="text-red-700" role="alert">{erro}</p>}
    </div>
  );
}
