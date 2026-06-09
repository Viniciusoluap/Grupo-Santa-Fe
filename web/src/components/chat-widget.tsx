"use client";

import { useEffect } from "react";

export function ChatWidget() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- external URL, not resolvable at build time
    import(/* webpackIgnore: true */ "https://agent-factory-chat.hostgator.io/scripts/start-chat.js")
      .then((mod: { default?: unknown }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BubbleChat = (mod.default ?? mod) as any;
        const bubbleChat = new BubbleChat("8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d", "prod");
        bubbleChat.open();
      })
      .catch((err: unknown) => {
        console.error(
          "[ChatWidget] Falha ao carregar o agente de chat. Verifique o console de rede para detalhes.",
          err
        );
      });
  }, []);

  return null;
}
