"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, User } from "lucide-react";

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface Mensagem {
  id: string;
  leadId: string;
  remetente: string;
  texto: string;
  lido: boolean;
  criadoEm: string;
}

interface Props {
  leads: Lead[];
}

export function ChatAdmin({ leads }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const fetchMensagens = useCallback(async (leadId: string, reset = false) => {
    const after = reset ? null : lastTimestampRef.current;
    const url = `/api/chat/${leadId}${after ? `?after=${encodeURIComponent(after)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data: Mensagem[] = await res.json();
    if (data.length > 0) {
      lastTimestampRef.current = data[data.length - 1].criadoEm;
      setMensagens((prev) => reset ? data : [...prev, ...data]);
    }
  }, []);

  useEffect(() => {
    if (!selectedLead) return;
    lastTimestampRef.current = null;
    setMensagens([]);
    fetchMensagens(selectedLead.id, true);

    intervalRef.current = setInterval(() => {
      fetchMensagens(selectedLead.id);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedLead, fetchMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function enviar() {
    if (!selectedLead || !texto.trim() || sending) return;
    setSending(true);
    const textoCopy = texto.trim();
    setTexto("");

    const optimistic: Mensagem = {
      id: `opt-${Date.now()}`,
      leadId: selectedLead.id,
      remetente: "corretor",
      texto: textoCopy,
      lido: false,
      criadoEm: new Date().toISOString(),
    };
    setMensagens((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/${selectedLead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoCopy }),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
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

  return (
    <div className="bg-white border border-gray-100 overflow-hidden flex" style={{ height: 540 }}>
      {/* Lead list */}
      <div className="w-56 border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Clientes</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {leads.length === 0 && (
            <p className="px-4 py-8 text-xs text-gray-400 text-center">Nenhum lead</p>
          )}
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                selectedLead?.id === lead.id ? "bg-[var(--brand-yellow)]/20 border-l-2 border-l-[var(--brand-yellow)]" : ""
              }`}
            >
              <p className="text-xs font-bold text-[var(--brand-dark)] truncate">{lead.nome}</p>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">{lead.telefone ?? lead.email ?? "—"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      {!selectedLead ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <MessageSquare size={32} className="text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium text-sm">Selecione um cliente</p>
          <p className="text-gray-300 text-xs mt-1">para iniciar ou ver o chat</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <User size={14} className="text-gray-400" />
            <div>
              <p className="text-xs font-bold text-[var(--brand-dark)]">{selectedLead.nome}</p>
              <p className="text-[10px] text-gray-400">{selectedLead.email ?? selectedLead.telefone}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {mensagens.length === 0 && (
              <p className="text-xs text-gray-300 text-center py-8">Nenhuma mensagem ainda</p>
            )}
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.remetente === "corretor" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded px-3 py-2 text-xs leading-relaxed ${
                    m.remetente === "corretor"
                      ? "bg-[var(--brand-dark)] text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p>{m.texto}</p>
                  <p className={`text-[9px] mt-1 ${m.remetente === "corretor" ? "text-gray-400" : "text-gray-400"}`}>
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
              placeholder="Digite uma mensagem..."
              className="flex-1 text-xs border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)] transition-colors"
              disabled={sending}
            />
            <button
              onClick={enviar}
              disabled={sending || !texto.trim()}
              className="px-3 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
