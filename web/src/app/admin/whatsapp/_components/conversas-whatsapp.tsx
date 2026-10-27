"use client";

// Pedido de 25/10: Conversas do WhatsApp — ver respostas dos clientes e continuar a conversa pelo sistema.
// Gêmeo de Prospecta/client/src/components/whatsapp/ConversasWhatsApp.tsx (visual do Santa Fé).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Download, RefreshCw, Send, Trash2, UserPlus, MessageCircle, ArrowLeft, X } from "lucide-react";
import {
  ativarAvisosWhatsapp, baixarMidiaWhatsappDeNovo, conversasWhatsapp, criarLeadDaConversaWhatsapp, excluirConversaWhatsapp,
  mensagensConversaWhatsapp, responderWhatsapp, type ConversaWhatsapp, type MensagemConversa, type MidiaConversa,
} from "@/lib/actions/whatsapp";

const hora = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatar = (n: string) => {
  const d = n.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : n;
};
const mesmaConversa = (a: string, b: string) => a.replace(/\D/g, "").slice(-8) === b.replace(/\D/g, "").slice(-8);
const STATUS: Record<string, string> = { enviada: "enviada", entregue: "entregue", lida: "lida", falhou: "falhou" };

function MidiaMensagem({ id, midia, onAtualizar, onAviso }: { id: string; midia: MidiaConversa; onAtualizar: () => Promise<void>; onAviso: (m: string, t: "success" | "error") => void }) {
  const [grande, setGrande] = useState(false);
  const [baixando, setBaixando] = useState(false);
  if (!midia.baixada) {
    const grandeDemais = (midia.tamanho ?? 0) > 10 * 1024 * 1024;
    return <div className="mb-1 text-xs text-gray-700">{grandeDemais ? "Arquivo maior que 10 MB (veja no celular)." : (
      <button type="button" disabled={baixando} className="inline-flex items-center gap-1 underline" onClick={async () => {
        setBaixando(true); const r = await baixarMidiaWhatsappDeNovo(id); setBaixando(false);
        if (r.erro) onAviso(r.erro, "error"); else { onAviso("Arquivo baixado.", "success"); await onAtualizar(); }
      }}><RefreshCw size={12} /> {baixando ? "Baixando..." : "Tentar baixar de novo"}</button>
    )}</div>;
  }
  const url = `/api/whatsapp/midia/${id}`;
  if (midia.mime === "application/pdf" || midia.nome?.toLowerCase().endsWith(".pdf")) return <>
    <button type="button" onClick={() => setGrande(true)} className="mb-1 inline-flex items-center gap-1 text-xs underline"><Download size={12} /> Abrir PDF</button>
    {grande && <div role="dialog" aria-modal="true" aria-label="Visualizador de PDF" className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 sm:p-6">
      <div className="flex items-center justify-between bg-white px-3 py-2"><button type="button" onClick={() => setGrande(false)} className="inline-flex items-center gap-2 font-bold text-sm"><ArrowLeft size={16} /> Voltar à conversa</button><button type="button" aria-label="Fechar PDF" onClick={() => setGrande(false)}><X size={18} /></button></div>
      <iframe src={url} title={midia.nome ?? "Documento PDF"} className="min-h-0 flex-1 bg-white" />
    </div>}
  </>;
  if (midia.tipo === "imagem" || midia.tipo === "figurinha") return <>
    <button type="button" onClick={() => setGrande(true)} className="mb-1 block"><img src={url} alt={midia.nome ?? "Imagem recebida"} loading="lazy" className="max-h-48 max-w-full object-contain" /></button>
    {grande && <div role="dialog" aria-label="Imagem ampliada" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setGrande(false)}><img src={url} alt={midia.nome ?? "Imagem recebida"} className="max-h-full max-w-full object-contain" /></div>}
  </>;
  if (midia.tipo === "audio") return <audio controls preload="none" src={url} className="mb-1 max-w-full" />;
  if (midia.tipo === "video") return <video controls preload="metadata" src={url} className="mb-1 max-h-64 max-w-full" />;
  return <>
    <button type="button" onClick={() => setGrande(true)} className="mb-1 inline-flex items-center gap-1 text-xs underline"><Download size={12} />{midia.nome ?? "Abrir documento"}</button>
    {grande && <div role="dialog" aria-modal="true" aria-label="Documento recebido" className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 sm:p-6"><div className="flex items-center justify-between bg-white p-3"><button type="button" onClick={() => setGrande(false)} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Voltar à conversa</button><button type="button" aria-label="Fechar documento" onClick={() => setGrande(false)}><X size={18}/></button></div><div className="bg-white p-5 text-gray-900"><p>Este tipo de arquivo deve ser aberto no aplicativo compatível.</p><a href={url} target="_blank" rel="noopener noreferrer" download={midia.nome ?? undefined} className="mt-3 inline-block underline">Baixar ou abrir arquivo em outra aba</a></div></div>}
  </>;
}

const legenda = (texto: string, midia: MidiaConversa | null) => midia?.baixada ? texto.replace(/^\[(imagem|áudio|vídeo|documento|figurinha)\]\s*/, "") : texto;

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

  function excluir(n: string, nome: string | null) {
    if (!window.confirm(`Excluir a conversa com ${nome ?? formatar(n)}? As mensagens saem do sistema, mas continuam no celular.`)) return;
    iniciar(async () => {
      const r = await excluirConversaWhatsapp(n);
      if (r.erro) return onAviso(r.erro, "error");
      if (numero && mesmaConversa(numero, n)) { setNumero(null); setMensagens([]); }
      onAviso(`Conversa excluída (${r.apagadas} mensagem(ns)).`, "success");
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
            <div key={c.numero} className={`flex items-stretch border-b border-gray-100 ${numero && mesmaConversa(c.numero, numero) ? "bg-[var(--brand-yellow)]/10" : ""}`}>
            <button type="button" onClick={() => abrir(c.numero)} className="min-w-0 flex-1 text-left px-3 py-3 hover:bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-[var(--brand-dark)] truncate">{c.nome ?? formatar(c.numero)}</p>
                {c.naoLidas > 0 && <span className="bg-green-600 px-2 text-xs font-bold text-white">{c.naoLidas}</span>}
              </div>
              <p className="text-xs text-gray-700 truncate">{c.ultima}</p>
              <p className="text-[11px] text-gray-600">{hora(c.quando)}</p>
            </button><button type="button" title="Excluir conversa" aria-label={`Excluir conversa com ${c.nome ?? formatar(c.numero)}`} disabled={pendente} onClick={() => excluir(c.numero, c.nome)} className="px-3 text-gray-500 hover:text-red-600"><Trash2 size={15} /></button></div>
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
                    {m.midia && <MidiaMensagem id={m.id} midia={m.midia} onAtualizar={carregarMensagens} onAviso={onAviso} />}
                    {legenda(m.mensagem, m.midia)}
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
