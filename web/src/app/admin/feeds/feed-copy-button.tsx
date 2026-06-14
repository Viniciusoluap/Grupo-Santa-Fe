"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function FeedCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 hover:border-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copiado!" : "Copiar URL"}
    </button>
  );
}
