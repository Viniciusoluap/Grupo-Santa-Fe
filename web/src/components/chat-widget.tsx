"use client";

import { useEffect } from "react";

export function ChatWidget() {
  useEffect(() => {
    if (document.getElementById("hostgator-chat-widget-loader")) return;

    const loader = document.createElement("script");
    loader.id = "hostgator-chat-widget-loader";
    loader.type = "module";
    loader.text = `
      import BubbleChat from 'https://agent-factory-chat.hostgator.io/scripts/start-chat.js';
      const hashId = '8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d';
      const bubbleChat = new BubbleChat(hashId, 'prod');
      bubbleChat.open();
    `.trim();
    loader.onerror = () =>
      console.error(
        "[ChatWidget] Falha ao carregar o agente de chat (agent-factory-chat.hostgator.io). " +
          "Verifique no painel do HostGator se este domínio está autorizado para o hashId configurado."
      );
    document.body.appendChild(loader);

    return () => {
      loader.remove();
    };
  }, []);

  return null;
}
