"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";
import { conexoesWhatsappIntegracoes } from "@/lib/actions/whatsapp";
import { ConexaoQrCode } from "../../whatsapp/_components/conexao-qr-code";

type Dados = Awaited<ReturnType<typeof conexoesWhatsappIntegracoes>>;

export function ConexaoWhatsappIntegracoes() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "success" | "error" } | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const carregar = useCallback(() => conexoesWhatsappIntegracoes().then(setDados).catch(() => setAviso({ texto: "Não foi possível ler as conexões.", tipo: "error" })), []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function remover() {
    setRemovendo(true);
    try {
      const r = await fetch("/api/whatsapp/desconectar", { method: "POST" });
      if (!r.ok) throw new Error();
      setAviso({ texto: "Conexão da empresa removida.", tipo: "success" });
      await carregar();
    } catch { setAviso({ texto: "Não foi possível remover a conexão.", tipo: "error" }); }
    finally { setRemovendo(false); }
  }

  const conectada = dados?.empresa?.status === "conectado";
  return <div className="space-y-4 border-t border-gray-200 pt-4">
    <p className="text-xs font-black uppercase tracking-wide text-[var(--brand-dark)]">Conexão da empresa</p>
    {conectada ? <div className="space-y-3">
      <div className="flex items-center gap-2 bg-green-50 p-3 text-sm font-bold text-green-700"><CheckCircle2 size={17} /> Conectado {dados?.empresa?.numero ? `· ${dados.empresa.numero}` : ""}</div>
      <button type="button" disabled={removendo} onClick={remover} className="inline-flex items-center gap-2 border border-red-200 px-3 py-2 text-xs font-bold uppercase text-red-600 disabled:opacity-50"><WifiOff size={13} /> {removendo ? "Removendo..." : "Remover conexão"}</button>
    </div> : <ConexaoQrCode podeConfigurarServidor onConectado={() => { setAviso({ texto: "WhatsApp conectado.", tipo: "success" }); void carregar(); }} onAviso={(texto, tipo) => setAviso({ texto, tipo })} />}
    {aviso && <p className={`text-xs ${aviso.tipo === "success" ? "text-emerald-700" : "text-red-700"}`}>{aviso.texto}</p>}
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Conexões dos corretores ({dados?.corretores.length ?? 0})</p>
      <div className="mt-2 divide-y divide-gray-100 border border-gray-100">{dados?.corretores.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>{c.nome}{c.numero ? ` · ${c.numero}` : ""}</span><span className={c.status === "conectado" ? "text-emerald-700" : "text-gray-500"}>{c.status === "conectado" ? "Conectado" : "Desconectado"}</span></div>)}</div>
    </div>
  </div>;
}
