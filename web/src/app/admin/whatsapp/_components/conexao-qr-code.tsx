"use client";

// Pedido de 25/10: conectar o WhatsApp escaneando um QR code (Evolution API no Railway).
// Gêmeo de Prospecta/client/src/components/whatsapp/ConexaoQrCode.tsx.
// LOTE B (25/10): endereço e chave do servidor ficam só em Configurações › Integrações.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { QrCode, RefreshCw, Server } from "lucide-react";
import { conectarWhatsappQr, statusServidorEvolution, statusWhatsappQr } from "@/lib/actions/whatsapp";

export function ConexaoQrCode({ podeConfigurarServidor, onConectado, onAviso }: {
  podeConfigurarServidor: boolean;
  onConectado: (numero: string | null) => void;
  onAviso: (msg: string, tipo: "success" | "error") => void;
}) {
  const [servidor, setServidor] = useState<{ configurado: boolean; url: string | null } | null>(null);
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

      {servidor && !configurado && (
        <p className="text-sm text-amber-800 flex flex-wrap items-center gap-2">
          <Server size={14} /> Servidor do WhatsApp não configurado.
          {podeConfigurarServidor
            ? <Link href="/admin/integracoes" className="underline font-bold">Configurar em Integrações</Link>
            : " Peça ao administrador para configurar em Integrações."}
        </p>
      )}

      {configurado && (
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
          <p className="text-xs text-gray-700">
            Servidor configurado em{" "}
            {podeConfigurarServidor ? <Link href="/admin/integracoes" className="underline font-bold">Integrações</Link> : "Integrações"}
            {servidor?.url ? ` (${servidor.url})` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
