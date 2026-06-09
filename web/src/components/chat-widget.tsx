"use client";

import { useEffect } from "react";

export function ChatWidget() {
  useEffect(() => {
    if (document.getElementById("bubble-chat-init")) return;
    const s = document.createElement("script");
    s.id = "bubble-chat-init";
    s.type = "module";
    s.textContent =
      "import BubbleChat from 'https://agent-factory-chat.hostgator.io/scripts/start-chat.js';" +
      "try{new BubbleChat('8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d','prod').open();}catch(e){console.error('[ChatWidget]',e);}";
    document.head.appendChild(s);
  }, []);

  return null;
}
