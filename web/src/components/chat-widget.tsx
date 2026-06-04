"use client";

import { useEffect } from "react";

export function ChatWidget() {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.innerHTML = `
      import BubbleChat from 'https://agent-factory-chat.hostgator.io/scripts/start-chat.js';
      const hashId = '8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d';
      const bubbleChat = new BubbleChat(hashId, 'prod');
      bubbleChat.open();
    `;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return null;
}
