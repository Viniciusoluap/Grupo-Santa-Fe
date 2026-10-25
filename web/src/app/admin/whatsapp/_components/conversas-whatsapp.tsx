"use client";

// Pedido de 25/10: Conversas do WhatsApp — ver respostas dos clientes e continuar a conversa pelo sistema.
// Gêmeo de Prospecta/client/src/components/whatsapp/ConversasWhatsApp.tsx (visual do Santa Fé).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Send, UserPlus, MessageCircle } from "lucide-react";
import {
  ativarAvisosWhatsapp, conversasWhatsapp, criarLeadDaConversaWhatsapp, mensagensConversaWhatsapp, responderWhatsapp,
  type ConversaWhatsapp, type MensagemConversa,
} from "@/lib/actions/whatsapp";

const hora = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatar = (n: string) => {
  const d = n.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : n;
};
const mesmaConversa = (a: string, b: string) => a.replace(/\D/g, "").slice(-8) === b.replace(/\D/g, "").slice(-8);
const STATUS: Record<string, string> = { enviada: "enviada", entregue: "entregue", lida: "lida", falhou: "falhou" };

export function ConversasWhatsApp({ numeroInicial, onAviso }: {
  numeroInicial?: string | null;
  onAviso: (msg: string, tipo: "success" | "error") => void;
}) {
  const [numero, setNumero] = useState<string | null>(numeroInicial ?? null);
  const [conversas, setConversas] = useState<ConversaWhatsapp[]>([]);
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([]);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [pendente, iniciar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);

  // Ao abrir a aba, garante que a Evolution avise o sistema das mensagens recebidas.
  useEffect(() => {
    ativarAvisosWhatsapp().then((r) => { if (r.erro) onAviso(r.erro, "error"); }).catch(() => undefined);
  }, [onAviso]);

  const carregarConversas = useCallback(async () => {
    const r = await conversasWhatsapp().catch(() => null);
    if (r && !r.erro) setConversas(r.conversas);
  }, []);
  const carregarMensagens = useCallback(async () => {
    if (!numero) return;
    const r = await mensagensConversaWhatsapp(numero).catch(() => null);
    if (r && !r.erro) setMensagens(r.mensagens);
  }, [numero]);

  useEffect(() => {
    const primeira = setTimeout(carregarConversas, 0);
    const t = setInterval(carregarConversas, 5000);
    return () => { clearTimeout(primeira); clearInterval(t); };
  }, [carregarConversas]);
  useEffect(() => {
    if (!numero) return;
    const primeira = setTimeout(carregarMensagens, 0);
    const t = setInterval(carregarMensagens, 4000);
    return () => { clearTimeout(primeira); clearInterval(t); };
  }, [numero, carregarMensagens]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);

  const termo = busca.trim().toLowerCase();
  const digitos = busca.replace(/\D/g, "");
  const lista = conversas.filter((c) => !termo || (c.nome ?? "").toLowerCase().includes(termo) || (digitos && c.numero.includes(digitos)));
  const atual = numero ? conversas.find((c) => mesmaConversa(c.numero, numero)) : undefined;

  function abrir(n: string) { setMensagens([]); setNumero(n); }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!numero || !texto.trim()) return;
    iniciar(async () => {
      const r = await responderWhatsapp(numero, texto);
      if (r.erro) onAviso(r.erro, "error"); else setTexto("");
      await Promise.all([carregarMensagens(), carregarConversas()]);
    });
  }

  function criarLead() {
    if (!numero) return;
    iniciar(async () => {
      const r = await criarLeadDaConversaWhatsapp(numero, atual?.nome ?? undefined);
      if (r.erro) return onAviso(r.erro, "error");
      onAviso("Lead criado no CRM.", "success");
      await carregarConversas();
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-[520px]">
      <div className="bg-white border border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-100">
          <input type="text" placeholder="Buscar conversa..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
        </div>
        <div className="flex-1 overflow-y-auto max-h-[560px]">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-700">Nenhuma conversa ainda. As mensagens recebidas aparecem aqui sozinhas.</p>}
          {lista.map((c) => (
            <button key={c.numero} type="button" onClick={() => abrir(c.numero)}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 ${numero && mesmaConversa(c.numero, numero) ? "bg-[var(--brand-yellow)]/10" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-[var(--brand-dark)] truncate">{c.nome ?? formatar(c.numero)}</p>
                {c.naoLidas > 0 && <span className="bg-green-600 px-2 text-xs font-bold text-white">{c.naoLidas}</span>}
              </div>
              <p className="text-xs text-gray-700 truncate">{c.ultima}</p>
              <p className="text-[11px] text-gray-600">{hora(c.quando)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 flex flex-col">
        {!numero ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-gray-700 p-6">
            <MessageCircle size={28} className="text-gray-300" /> Escolha uma conversa à esquerda.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-[var(--brand-dark)]">{atual?.nome ?? formatar(numero)}</p>
                <p className="text-xs text-gray-700">{formatar(numero)}</p>
              </div>
              {atual && !atual.leadId && (
                <button type="button" onClick={criarLead} disabled={pendente}
                  className="flex items-center gap-1 border border-[var(--brand-yellow)] text-[var(--brand-dark)] hover:bg-[var(--brand-yellow)]/10 font-bold text-xs uppercase px-3 py-1.5 disabled:opacity-40">
                  <UserPlus size={12} /> Criar lead
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[460px] p-3 space-y-2 bg-[#ECE5DD]">
              {mensagens.length === 0 && <p className="text-xs text-gray-700 text-center py-4">Nenhuma mensagem com este contato ainda.</p>}
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "saida" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm whitespace-pre-wrap text-gray-900 shadow-sm ${m.direcao === "saida" ? "bg-[#DCF8C6]" : "bg-white"}`}>
                    {m.mensagem}
                    <div className="text-[10px] text-gray-600 mt-1 text-right">
                      {hora(m.quando)}{m.direcao === "saida" ? ` • ${STATUS[m.status] ?? m.status}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={fim} />
            </div>
            <form className="p-3 border-t border-gray-100 flex gap-2" onSubmit={enviar}>
              <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma resposta..."
                className="flex-1 border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
              <button type="submit" disabled={pendente || !texto.trim()} aria-label="Enviar resposta"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold text-xs uppercase px-4 py-2">
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
