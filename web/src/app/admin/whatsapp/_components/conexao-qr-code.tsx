"use client";

// Pedido de 25/10: conectar o WhatsApp escaneando um QR code (Evolution API no Railway).
// Gêmeo de Prospecta/client/src/components/whatsapp/ConexaoQrCode.tsx.
import { useEffect, useState, useTransition } from "react";
import { QrCode, RefreshCw, Server } from "lucide-react";
import {
  conectarWhatsappQr, salvarServidorEvolution, statusServidorEvolution, statusWhatsappQr,
} from "@/lib/actions/whatsapp";

const campo = "w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white";
const rotulo = "block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1";

export function ConexaoQrCode({ podeConfigurarServidor, onConectado, onAviso }: {
  podeConfigurarServidor: boolean;
  onConectado: (numero: string | null) => void;
  onAviso: (msg: string, tipo: "success" | "error") => void;
}) {
  const [servidor, setServidor] = useState<{ configurado: boolean; url: string | null } | null>(null);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [editar, setEditar] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => { statusServidorEvolution().then(setServidor).catch(() => setServidor({ configurado: false, url: null })); }, []);

  // Enquanto o QR está na tela, pergunta o estado a cada 3 s; conectou → fecha o QR.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const s = await statusWhatsappQr().catch(() => null);
      if (s?.status === "conectado") { setQr(null); onAviso("WhatsApp conectado!", "success"); onConectado(s.numero); }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, onConectado, onAviso]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await salvarServidorEvolution(url, apiKey);
      if (r.erro) return onAviso(r.erro, "error");
      onAviso("Servidor da Evolution conectado.", "success");
      setApiKey(""); setEditar(false);
      setServidor(await statusServidorEvolution());
    });
  }

  function gerar() {
    iniciar(async () => {
      const r = await conectarWhatsappQr();
      if (r.erro) return onAviso(r.erro, "error");
      if (r.status === "conectado") { onAviso("WhatsApp já está conectado.", "success"); onConectado(null); return; }
      if (!r.qrCode) onAviso("A Evolution ainda não gerou o QR. Clique em Gerar novamente em alguns segundos.", "error");
      setQr(r.qrCode);
    });
  }

  const configurado = servidor?.configurado;
  const src = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;

  return (
    <div className="space-y-4">
      <div className="border border-green-200 bg-green-50 p-4 text-xs text-green-900 space-y-1">
        <p className="font-bold">Conectar pelo QR code (como no WhatsApp Web)</p>
        <p>Abra o WhatsApp no celular › Dispositivos conectados › Conectar dispositivo, e aponte para o QR abaixo.</p>
        <p>Conexão não oficial: use com moderação (envios em massa podem levar a bloqueio do número).</p>
      </div>

      {servidor && (!configurado || editar) && podeConfigurarServidor && (
        <form onSubmit={salvar} className="space-y-3">
          <p className="text-sm text-gray-800 font-bold flex items-center gap-2"><Server size={14} /> Servidor da Evolution (Railway)</p>
          <div><label className={rotulo}>Endereço do servidor</label><input value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://evolution-xxxx.up.railway.app" required className={campo} /></div>
          <div><label className={rotulo}>Chave de acesso (AUTHENTICATION_API_KEY)</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" className={campo} /></div>
          <button type="submit" disabled={pendente} className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-5 py-3 disabled:opacity-50">
            {pendente ? "Testando..." : "Salvar e testar servidor"}
          </button>
        </form>
      )}
      {servidor && !configurado && !podeConfigurarServidor && <p className="text-sm text-amber-800">A equipe ainda não configurou o servidor do WhatsApp.</p>}

      {configurado && !editar && (
        <div className="space-y-3">
          {src ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR em base64 gerado na hora */}
              <img src={src} alt="QR code para conectar o WhatsApp" className="w-64 h-64 border border-gray-200 p-2 bg-white" />
              <p className="text-xs text-gray-700">Aguardando a leitura… o QR expira em cerca de 1 minuto.</p>
              <button type="button" onClick={gerar} disabled={pendente} className="flex items-center gap-2 border border-gray-300 text-gray-800 font-bold text-xs uppercase px-4 py-2 disabled:opacity-50">
                <RefreshCw size={12} /> Gerar novo QR
              </button>
            </div>
          ) : (
            <button type="button" onClick={gerar} disabled={pendente} className="flex items-center gap-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-5 py-3 disabled:opacity-50">
              <QrCode size={14} /> {pendente ? "Gerando..." : "Gerar QR code"}
            </button>
          )}
          {podeConfigurarServidor && (
            <button type="button" onClick={() => setEditar(true)} className="block text-xs text-gray-700 underline">
              Trocar servidor da Evolution{servidor?.url ? ` (${servidor.url})` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
