"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { useSession } from "next-auth/react";

interface Mensagem {
  id: string;
  leadId: string;
  remetente: string;
  texto: string;
  lido: boolean;
  criadoEm: string;
}

export default function PortalChatPage() {
  const { data: session } = useSession();
  const leadId = (session?.user as { leadId?: string })?.leadId;

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const fetchMensagens = useCallback(async (reset = false) => {
    if (!leadId) return;
    const after = reset ? null : lastTimestampRef.current;
    const url = `/api/chat/${leadId}${after ? `?after=${encodeURIComponent(after)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data: Mensagem[] = await res.json();
    if (data.length > 0) {
      lastTimestampRef.current = data[data.length - 1].criadoEm;
      setMensagens((prev) => reset ? data : [...prev, ...data]);
    }
    setLoaded(true);
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    fetchMensagens(true);
    intervalRef.current = setInterval(() => fetchMensagens(), 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [leadId, fetchMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function enviar() {
    if (!leadId || !texto.trim() || sending) return;
    setSending(true);
    const textoCopy = texto.trim();
    setTexto("");

    const optimistic: Mensagem = {
      id: `opt-${Date.now()}`,
      leadId,
      remetente: "cliente",
      texto: textoCopy,
      lido: false,
      criadoEm: new Date().toISOString(),
    };
    setMensagens((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoCopy }),
      });
      if (!res.ok) throw new Error("Falha");
      const criada: Mensagem = await res.json();
      lastTimestampRef.current = criada.criadoEm;
      setMensagens((prev) => prev.map((m) => (m.id === optimistic.id ? criada : m)));
    } catch {
      setMensagens((prev) => prev.filter((m) => m.id !== optimistic.id));
      setTexto(textoCopy);
    } finally {
      setSending(false);
    }
  }

  if (!leadId && loaded) {
    return (
      <div className="bg-white border border-gray-100 p-12 text-center">
        <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Chat não disponível</p>
        <p className="text-gray-400 text-sm mt-1">
          Seu perfil ainda não está vinculado a um processo. Entre em contato pelo WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Chat</h1>
        <p className="text-gray-400 text-sm mt-0.5">Fale diretamente com seu corretor</p>
      </div>

      <div className="bg-white border border-gray-100 overflow-hidden flex flex-col" style={{ height: 480 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!loaded && (
            <p className="text-xs text-gray-300 text-center py-8">Carregando...</p>
          )}
          {loaded && mensagens.length === 0 && (
            <p className="text-xs text-gray-300 text-center py-8">
              Nenhuma mensagem ainda. Envie sua primeira mensagem!
            </p>
          )}
          {mensagens.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.remetente === "cliente" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded px-3 py-2 text-sm leading-relaxed ${
                  m.remetente === "cliente"
                    ? "bg-[var(--brand-dark)] text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {m.remetente !== "cliente" && (
                  <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Corretor</p>
                )}
                <p>{m.texto}</p>
                <p className="text-[10px] mt-1 text-gray-400">
                  {new Date(m.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Escreva sua mensagem..."
            className="flex-1 text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)] transition-colors"
            disabled={sending || !leadId}
          />
          <button
            onClick={enviar}
            disabled={sending || !texto.trim() || !leadId}
            className="px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
