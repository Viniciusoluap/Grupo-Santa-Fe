"use client";

import { useEffect, useState } from "react";

export default function TesteChatPage() {
  const [status, setStatus] = useState("Carregando agente...");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    import(/* webpackIgnore: true */ "https://agent-factory-chat.hostgator.io/scripts/start-chat.js")
      .then((mod: { default?: unknown }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BubbleChat = (mod.default ?? mod) as any;
        const bubbleChat = new BubbleChat("8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d", "prod");
        bubbleChat.open();
        setStatus("✅ Agente carregado — o botão de chat deve aparecer no canto inferior direito.");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`❌ Falha ao carregar o agente: ${msg}`);
        console.error("[teste-chat] Erro ao carregar BubbleChat:", err);
      });
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Diagnóstico — Agente de Chat</h1>
      <p style={{ padding: "12px 16px", background: "#f5f5f5", borderRadius: 6, fontSize: 15 }}>
        {status}
      </p>
      <p style={{ color: "#888", fontSize: 13, marginTop: 16 }}>
        Domínio: <strong>{typeof window !== "undefined" ? window.location.origin : ""}</strong>
        <br />
        Abra o DevTools (F12 → Console) para detalhes de rede.
      </p>
    </div>
  );
}
