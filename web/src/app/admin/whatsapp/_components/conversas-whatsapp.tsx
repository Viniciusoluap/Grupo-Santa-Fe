"use client";

// Pedido de 25/10: Conversas do WhatsApp — ver respostas dos clientes e continuar a conversa pelo sistema.
// Gêmeo de Prospecta/client/src/components/whatsapp/ConversasWhatsApp.tsx (visual do Santa Fé).
// Lote 03 (29/10/2026): seleção múltipla com exclusão em lote (01) e "Vincular lead" (02).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, ExternalLink, Link2, RefreshCw, Send, Trash2, Unlink, UserPlus, MessageCircle, ArrowLeft, X } from "lucide-react";
import {
  ativarAvisosWhatsapp, baixarMidiaWhatsappDeNovo, buscarLeadsParaVincularWhatsapp, conversasWhatsapp, criarLeadDaConversaWhatsapp, desvincularLeadWhatsapp,
  excluirConversaWhatsapp, excluirConversasWhatsapp, mensagensConversaWhatsapp, previaExclusaoConversasWhatsapp, responderWhatsapp, vincularLeadWhatsapp,
  type ConversaWhatsapp, type MensagemConversa, type MidiaConversa,
} from "@/lib/actions/whatsapp";
import { alternarItem, alternarTodosVisiveis, chaveTelefone, podarSelecao, textoConfirmacaoExclusao, type LeadCandidato } from "@/lib/whatsapp/conversas";

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

const ORIGEM: Record<string, string> = { manual: "vinculado manualmente", telefone: "identificado pelo telefone", mensagem: "registrado nas mensagens" };
const botaoCls = "flex items-center gap-1 border border-[var(--brand-yellow)] text-[var(--brand-dark)] hover:bg-[var(--brand-yellow)]/10 font-bold text-xs uppercase px-3 py-1.5 disabled:opacity-40";

/**
 * Lote 03, correção 02: busca de lead (nome, telefone ou CPF) para vincular à conversa. No modo "duplicado"
 * (antes de "Criar lead"), lista os leads com o mesmo telefone e permite criar um novo assim mesmo.
 */
function VincularLeadDialog({ numero, modo, onFechar, onVinculado, onCriarMesmoAssim, onAviso }: {
  numero: string; modo: "vincular" | "duplicado"; onFechar: () => void; onVinculado: () => void; onCriarMesmoAssim: () => void;
  onAviso: (m: string, t: "success" | "error") => void;
}) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<(LeadCandidato & { mesmoTelefone: boolean })[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarLeadsParaVincularWhatsapp(numero, termo).catch(() => null);
      if (!ativo) return;
      setBuscando(false);
      if (r?.erro) onAviso(r.erro, "error"); else if (r) setLista(r.leads);
    }, 300);
    return () => { ativo = false; clearTimeout(t); };
  }, [numero, termo, onAviso]);
  const mesmos = lista.filter((l) => l.mesmoTelefone).length;
  async function vincular(leadId: string) {
    setSalvando(true);
    const r = await vincularLeadWhatsapp(numero, leadId).catch(() => ({ erro: "Não consegui vincular." }));
    setSalvando(false);
    if (r.erro) return onAviso(r.erro, "error");
    onAviso("Conversa vinculada ao lead.", "success");
    onVinculado();
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={modo === "duplicado" ? "Já existe lead com este telefone" : "Vincular lead"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="w-full max-w-lg bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-black uppercase text-[var(--brand-dark)]">{modo === "duplicado" ? "Já existe lead com este telefone" : "Vincular lead"}</h2>
            <p className="text-xs text-gray-700">{modo === "duplicado" ? "Para não duplicar o cadastro, vincule a conversa a um lead existente ou crie um novo assim mesmo." : "Busque por nome, telefone ou CPF. O cadastro do lead não é alterado."}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
        </div>
        <input autoFocus type="text" placeholder="Nome, telefone ou CPF" value={termo} onChange={(e) => setTermo(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
        {mesmos > 1 && <p className="text-xs font-bold text-amber-700">Este telefone está em {mesmos} leads. Escolha qual é o desta conversa.</p>}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {buscando && <p className="p-2 text-xs text-gray-700">Buscando…</p>}
          {!buscando && lista.length === 0 && <p className="p-2 text-xs text-gray-700">{termo ? "Nenhum lead encontrado." : "Nenhum lead com o telefone desta conversa. Digite para buscar."}</p>}
          {lista.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 border border-gray-200 p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--brand-dark)]">{l.nome}</p>
                <p className="truncate text-xs text-gray-700">{[l.telefone, l.cpf ? `CPF ${l.cpf}` : null].filter(Boolean).join(" · ")}</p>
                {l.mesmoTelefone && <span className="text-[10px] font-bold uppercase text-green-700">mesmo telefone</span>}
              </div>
              <button type="button" disabled={salvando} onClick={() => vincular(l.id)} className="shrink-0 bg-[var(--brand-yellow)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-dark)] disabled:opacity-40">Vincular</button>
            </div>
          ))}
        </div>
        {modo === "duplicado" && <button type="button" onClick={onCriarMesmoAssim} className={botaoCls}><UserPlus size={12} /> Criar lead novo mesmo assim</button>}
      </div>
    </div>
  );
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
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [confirmarLote, setConfirmarLote] = useState<{ conversas: number; mensagens: number } | null>(null);
  const [dialogoLead, setDialogoLead] = useState<"vincular" | "duplicado" | null>(null);

  // Ao abrir a aba, garante que a Evolution avise o sistema das mensagens recebidas.
  useEffect(() => {
    ativarAvisosWhatsapp().then((r) => { if (r.erro) onAviso(r.erro, "error"); }).catch(() => undefined);
  }, [onAviso]);

  const carregarConversas = useCallback(async () => {
    const r = await conversasWhatsapp().catch(() => null);
    if (r && !r.erro) {
      setConversas(r.conversas);
      // Conversa que sumiu (excluída em outra aba, por exemplo) sai da seleção.
      setSelecionadas((s) => podarSelecao(s, r.conversas.map((c) => c.numero)));
    }
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
  const visiveis = lista.map((c) => c.numero);
  const todasVisiveis = visiveis.length > 0 && visiveis.every((n) => selecionadas.includes(n));

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

  // Lote 03, correção 02: antes de criar, confere se já existe lead com o mesmo telefone.
  function criarLead(forcar = false) {
    if (!numero) return;
    iniciar(async () => {
      if (!forcar) {
        const r = await buscarLeadsParaVincularWhatsapp(numero, "");
        if (r.leads.some((l) => l.mesmoTelefone)) { setDialogoLead("duplicado"); return; }
      }
      const r = await criarLeadDaConversaWhatsapp(numero, atual?.nome ?? undefined, forcar);
      if (r.duplicados) { setDialogoLead("duplicado"); return onAviso(r.erro ?? "Já existe lead com este telefone.", "error"); }
      if (r.erro) return onAviso(r.erro, "error");
      setDialogoLead(null);
      onAviso("Lead criado no CRM.", "success");
      await carregarConversas();
    });
  }

  function desvincular() {
    if (!numero || !window.confirm("Desfazer o vínculo desta conversa com o lead? O lead não é alterado.")) return;
    iniciar(async () => {
      const r = await desvincularLeadWhatsapp(numero);
      if (r.erro) return onAviso(r.erro, "error");
      onAviso("Vínculo desfeito.", "success");
      await carregarConversas();
    });
  }

  // Lote 03, correção 01: exclusão em lote (só no sistema; o celular mantém as mensagens).
  function pedirExclusaoLote() {
    if (!selecionadas.length) return;
    iniciar(async () => {
      const r = await previaExclusaoConversasWhatsapp(selecionadas);
      if (r.erro) return onAviso(r.erro, "error");
      setConfirmarLote({ conversas: r.conversas, mensagens: r.mensagens });
    });
  }
  function excluirLote() {
    const alvo = selecionadas;
    iniciar(async () => {
      const r = await excluirConversasWhatsapp(alvo);
      setConfirmarLote(null);
      if (r.erro) return onAviso(r.erro, "error");
      if (numero && alvo.some((n) => chaveTelefone(n) === chaveTelefone(numero))) { setNumero(null); setMensagens([]); }
      setSelecionadas([]);
      onAviso(`${r.conversas} conversa(s) excluída(s) (${r.apagadas} mensagem(ns)).`, "success");
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
        <div className="p-3 border-b border-gray-100 space-y-2">
          <input type="text" placeholder="Buscar conversa..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={todasVisiveis} disabled={!visiveis.length} onChange={() => setSelecionadas((s) => alternarTodosVisiveis(s, visiveis))}
                aria-label="Selecionar todas as conversas da lista" className="accent-[var(--brand-yellow)]" />
              Selecionar todas ({visiveis.length})
            </label>
            <span className="text-xs text-gray-700">{selecionadas.length} selecionada(s)</span>
            <button type="button" onClick={pedirExclusaoLote} disabled={!selecionadas.length || pendente}
              className="flex items-center gap-1 border border-red-300 px-2 py-1 text-xs font-bold uppercase text-red-700 hover:bg-red-50 disabled:opacity-40">
              <Trash2 size={12} /> Excluir selecionadas
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[560px]">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-700">Nenhuma conversa ainda. As mensagens recebidas aparecem aqui sozinhas.</p>}
          {lista.map((c) => (
            <div key={c.numero} className={`flex items-stretch border-b border-gray-100 ${numero && mesmaConversa(c.numero, numero) ? "bg-[var(--brand-yellow)]/10" : ""}`}>
            <label className="flex items-center pl-3">
              <input type="checkbox" checked={selecionadas.includes(c.numero)} onChange={() => setSelecionadas((s) => alternarItem(s, c.numero))}
                aria-label={`Selecionar conversa com ${c.nome ?? formatar(c.numero)}`} className="accent-[var(--brand-yellow)]" />
            </label>
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => criarLead()} disabled={pendente} className={botaoCls}><UserPlus size={12} /> Criar lead</button>
                  <button type="button" onClick={() => setDialogoLead("vincular")} disabled={pendente} className={botaoCls}><Link2 size={12} /> Vincular lead</button>
                </div>
              )}
              {atual?.leadId && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link href={`/admin/leads/${atual.leadId}`} className="inline-flex items-center gap-1 font-bold text-[var(--brand-dark)] underline">
                    <ExternalLink size={12} /> Abrir lead no CRM
                  </Link>
                  {atual.vinculo && <span className="text-gray-600">({ORIGEM[atual.vinculo]})</span>}
                  <button type="button" onClick={() => setDialogoLead("vincular")} disabled={pendente} className={botaoCls}><Link2 size={12} /> Trocar lead</button>
                  {atual.vinculo === "manual" && (
                    <button type="button" onClick={desvincular} disabled={pendente}
                      className="flex items-center gap-1 border border-red-300 px-3 py-1.5 text-xs font-bold uppercase text-red-700 disabled:opacity-40"><Unlink size={12} /> Desvincular</button>
                  )}
                </div>
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

      {dialogoLead && numero && (
        <VincularLeadDialog numero={numero} modo={dialogoLead} onAviso={onAviso} onFechar={() => setDialogoLead(null)}
          onVinculado={() => { setDialogoLead(null); void carregarConversas(); }}
          onCriarMesmoAssim={() => criarLead(true)} />
      )}

      {confirmarLote && (
        <div role="alertdialog" aria-modal="true" aria-label="Excluir conversas selecionadas" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-5 space-y-4">
            <h2 className="font-black uppercase text-[var(--brand-dark)]">Excluir conversas selecionadas</h2>
            <p className="text-sm text-gray-800">{textoConfirmacaoExclusao(confirmarLote.conversas, confirmarLote.mensagens)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmarLote(null)} className="border border-gray-300 px-4 py-2 text-xs font-bold uppercase text-gray-800">Cancelar</button>
              <button type="button" onClick={excluirLote} disabled={pendente || !confirmarLote.mensagens} className="bg-red-600 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40">
                {pendente ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
