"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import {
  MessageCircle, CheckCircle2, AlertCircle, WifiOff,
  Search, X, Send, Smartphone, Plus, Eye, Users,
} from "lucide-react";
import { documentosParaEnvioWhatsapp, imoveisParaEnvioWhatsapp, previaEnvioWhatsapp, salvarConexaoBusiness, salvarTemplateWhatsapp } from "@/lib/actions/whatsapp";
import { DOCUMENTOS_CHECKLIST, textoDocumentosMarcados, VARIAVEIS_TEMPLATE, variaveisDoTexto } from "@/lib/whatsapp/variaveis";
import { parseServicosLead } from "@/lib/crm/servicos-lead";
import { ConexaoQrCode } from "./conexao-qr-code";
import { ConversasWhatsApp } from "./conversas-whatsapp";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConexaoData {
  id: string; usuarioId: string; numero: string | null; status: string; provedor?: string;
}

interface ConexaoCorretor {
  id: string; usuarioId: string; usuarioNome: string; numero: string | null; status: string;
}

interface MensagemData {
  id: string; destinatario: string; nomeDestinatario: string | null;
  mensagem: string; status: string; enviadaEm: string; erroMsg: string | null;
}

interface Props {
  leads: { id: string; nome: string; telefone: string; servico: string }[];
  minhaConexao: ConexaoData | null;
  conexoesCorretores: ConexaoCorretor[];
  historico: MensagemData[];
  role: string;
  usuarioId: string;
  abaInicial?: "conexao" | "conversas";
  numeroInicial?: string | null;
  templates: Template[];
  servicosDisponiveis: string[];
  podeGerenciarTemplates: boolean;
}

type Aba = "conexao" | "conversas" | "enviar" | "templates";
type Previa = { id: string; texto: string; faltando: string[] };

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template { id: string; name: string; category: string; body: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 shadow-lg text-sm font-bold ${type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function WhatsAppClient({ leads, minhaConexao: initialConexao, historico, role, usuarioId, templates, servicosDisponiveis, podeGerenciarTemplates, abaInicial = "conexao", numeroInicial = null }: Props) {
  // Pedido de 25/10: ?aba=conversas&numero=… abre direto o chat (notificações e página do lead).
  const [activeTab, setActiveTab] = useState<Aba>(abaInicial === "conexao" && role !== "corretor" ? "conversas" : abaInicial);
  const [minhaConexao, setMinhaConexao] = useState<ConexaoData | null>(initialConexao);
  const [businessToken, setBusinessToken] = useState("");
  const [businessPhoneId, setBusinessPhoneId] = useState("");
  const [businessNumero, setBusinessNumero] = useState("");
  const [desconectando, setDesconectando] = useState(false);
  const [_isPending, startTransition] = useTransition();

  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchLead, setSearchLead] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
  const [editorTemplate, setEditorTemplate] = useState<{ id?: string; nome: string; finalidade: string; conteudo: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Pedido de 25/10: variáveis do template preenchidas por destinatário, com prévia e campos para o que faltar.
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [imoveis, setImoveis] = useState<{ id: string; texto: string }[]>([]);
  const [docsPorLead, setDocsPorLead] = useState<Record<string, { marcados: string[]; livre: string }>>({});
  const [previa, setPrevia] = useState<Previa[]>([]);
  const variaveis = useMemo(() => variaveisDoTexto(mensagem), [mensagem]);
  const usaVariaveis = variaveis.length > 0;
  const usaServicos = variaveis.includes("servico") || variaveis.includes("servicos");
  const textoServicos = servicosSelecionados.join(", ");
  const extrasComServicos = useMemo(() => ({ ...extras, ...(usaServicos ? { servico: textoServicos, servicos: textoServicos } : {}) }), [extras, usaServicos, textoServicos]);
  const extrasPorLead = useMemo(() => Object.fromEntries(Object.entries(docsPorLead).map(([id, d]) => [id, { documentos: textoDocumentosMarcados(d.marcados, d.livre) }])), [docsPorLead]);

  useEffect(() => {
    if (!variaveis.includes("imovel") || imoveis.length) return;
    imoveisParaEnvioWhatsapp().then(setImoveis).catch(() => undefined);
  }, [variaveis, imoveis.length]);
  useEffect(() => {
    if (!variaveis.includes("documentos") || !selectedLeads.length) return;
    documentosParaEnvioWhatsapp(selectedLeads).then((itens) => setDocsPorLead((atual) => {
      const proximo = { ...atual };
      for (const item of itens) if (!proximo[item.id]) proximo[item.id] = { marcados: item.pendentes, livre: "" };
      return proximo;
    })).catch(() => undefined);
  }, [variaveis, selectedLeads]);
  const calcularPrevia = usaVariaveis && selectedLeads.length > 0 && mensagem.trim().length > 0;
  useEffect(() => {
    if (!calcularPrevia) return;
    let ativo = true;
    const t = setTimeout(async () => {
      const r = await previaEnvioWhatsapp(mensagem, selectedLeads, extrasComServicos, extrasPorLead).catch(() => null);
      if (ativo && r && !r.erro) setPrevia(r.itens);
    }, 300);
    return () => { ativo = false; clearTimeout(t); };
  }, [calcularPrevia, mensagem, selectedLeads, extrasComServicos, extrasPorLead]);
  const previaAtual = calcularPrevia ? previa.filter((p) => selectedLeads.includes(p.id)) : [];
  const faltando = Array.from(new Set(previaAtual.flatMap((p) => p.faltando)));

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  const totalLeads = leads.length;
  const totalEnviadas = historico.length;
  const totalLidas = historico.filter((m) => m.status === "lida").length;
  const totalFalhas = historico.filter((m) => m.status === "falhou").length;
  const taxaLeitura = totalEnviadas > 0 ? Math.round((totalLidas / totalEnviadas) * 100) : 0;
  const conexaoAtiva = minhaConexao?.status === "conectado";

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSalvarBusiness(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await salvarConexaoBusiness(usuarioId, businessToken, businessPhoneId, businessNumero);
        setMinhaConexao({ id: "", usuarioId, numero: businessNumero, status: "conectado" });
        setBusinessToken(""); setBusinessPhoneId(""); setBusinessNumero("");
        setToast({ msg: "WhatsApp Business configurado com sucesso!", type: "success" });
      } catch { setToast({ msg: "Erro ao salvar configuração", type: "error" }); }
    });
  }

  const aoConectarQr = useCallback((numero: string | null) => {
    setMinhaConexao({ id: "", usuarioId, numero, status: "conectado", provedor: "evolution" });
  }, [usuarioId]);
  const aviso = useCallback((msg: string, type: "success" | "error") => setToast({ msg, type }), []);

  async function handleDesconectar() {
    setDesconectando(true);
    try {
      await fetch("/api/whatsapp/desconectar", { method: "POST" });
      setMinhaConexao(null);
      setToast({ msg: "WhatsApp desconectado", type: "success" });
    } catch { setToast({ msg: "Erro ao desconectar", type: "error" }); }
    finally { setDesconectando(false); }
  }

  const filteredLeads = leads.filter(
    (l) => !searchLead || l.nome.toLowerCase().includes(searchLead.toLowerCase()) || l.telefone.includes(searchLead)
  );

  async function handleEnviar() {
    if (!mensagem.trim() || selectedLeads.length === 0) return;
    if (faltando.length || (usaServicos && !servicosSelecionados.length)) { setToast({ msg: "Preencha os campos destacados antes de enviar.", type: "error" }); return; }
    setEnviando(true);
    try {
      const destinatarios = leads.filter((l) => selectedLeads.includes(l.id)).map((l) => ({ id: l.id, nome: l.nome, telefone: l.telefone, leadId: l.id }));
      const res = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem, destinatarios, extras: extrasComServicos, extrasPorLead }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; enviadas?: number; falhas?: number };
      if (data.error) {
        setToast({ msg: data.error, type: "error" });
      } else {
        setToast({ msg: `${data.enviadas ?? 0} enviada(s)${(data.falhas ?? 0) > 0 ? `, ${data.falhas} falha(s)` : ""}`, type: (data.falhas ?? 0) > 0 ? "error" : "success" });
        setSelectedLeads([]); setMensagem(""); setSelectedTemplate(null); setExtras({}); setServicosSelecionados([]); setDocsPorLead({}); setPrevia([]);
      }
    } catch { setToast({ msg: "Erro ao enviar mensagens", type: "error" }); }
    finally { setEnviando(false); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Central WhatsApp</h1>
        <p className="text-gray-600 text-sm mt-0.5">{totalLeads} leads disponíveis para envio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Mensagens Enviadas", value: totalEnviadas, icon: MessageCircle, color: "text-blue-500" },
          { label: "Taxa de Leitura", value: `${taxaLeitura}%`, icon: Eye, color: "text-green-500" },
          { label: "Falhas", value: totalFalhas, icon: AlertCircle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {([
          { key: "conexao" as const, label: "Conexão", icon: Smartphone },
          { key: "conversas" as const, label: "Conversas", icon: Users },
          { key: "enviar" as const, label: "Enviar Mensagem", icon: Send },
          { key: "templates" as const, label: "Templates", icon: MessageCircle },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${activeTab === key ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-transparent text-gray-600 hover:text-[var(--brand-dark)]"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Conversas (pedido de 25/10) ─────────────────────────────────── */}
      {activeTab === "conversas" && <ConversasWhatsApp numeroInicial={numeroInicial} onAviso={aviso} />}

      {/* ── Tab: Conexão ────────────────────────────────────────────────────── */}
      {activeTab === "conexao" && (
        <div className="space-y-5">

          {/* Admin e colaborador (conexão da empresa) / Corretor: a própria conexão */}
          {
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4">
                {role === "corretor" ? "Minha Conexão WhatsApp" : "Conexão WhatsApp da empresa"}
              </h2>

              {/* Connected */}
              {conexaoAtiva && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <div>
                      <p className="font-bold text-green-700 text-sm">{minhaConexao?.provedor === "evolution" ? "Conectado pelo QR code" : "Conectado via WhatsApp Business API"}</p>
                      {minhaConexao?.numero && <p className="text-xs text-gray-500 mt-0.5">{minhaConexao.numero}</p>}
                    </div>
                  </div>
                  <button onClick={handleDesconectar} disabled={desconectando}
                    className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs uppercase px-4 py-2 transition-colors disabled:opacity-40">
                    <WifiOff size={13} /> {desconectando ? "Removendo..." : "Remover conexão"}
                  </button>
                </div>
              )}

              {/* Not connected: QR code (Evolution) e, como alternativa, a API oficial */}
              {!conexaoAtiva && (
                <div className="space-y-5">
                  <ConexaoQrCode podeConfigurarServidor={role === "admin"} onConectado={aoConectarQr} onAviso={aviso} />
                  <details className="border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer text-xs text-gray-700 font-bold">Usar a API oficial do WhatsApp Business (Meta)</summary>
                  <div className="space-y-5 mt-3">
                  <div className="border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
                    <p className="font-bold">WhatsApp Business API (Meta Cloud API)</p>
                    <p>Gratuito até 1.000 conversas/mês. Requer conta Meta Business verificada.</p>
                    <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-1 font-bold underline hover:text-blue-900">
                      Ver guia de configuração →
                    </a>
                  </div>

                  <form onSubmit={handleSalvarBusiness} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Token de Acesso Permanente</label>
                      <input type="text" value={businessToken} onChange={(e) => setBusinessToken(e.target.value)}
                        placeholder="EAAxxxxxxxx..." required
                        className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Phone Number ID</label>
                      <input type="text" value={businessPhoneId} onChange={(e) => setBusinessPhoneId(e.target.value)}
                        placeholder="1234567890" required
                        className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Número WhatsApp</label>
                      <input type="text" value={businessNumero} onChange={(e) => setBusinessNumero(e.target.value)}
                        placeholder="+55 94 9 9999-9999" required
                        className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                    </div>
                    <button type="submit"
                      className="flex items-center gap-2 bg-[var(--brand-dark)] hover:bg-[var(--brand-dark)]/90 text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-5 py-3 transition-colors">
                      <CheckCircle2 size={14} /> Salvar e Conectar
                    </button>
                  </form>
                  </div>
                  </details>
                </div>
              )}
            </div>
          }

        </div>
      )}

      {/* ── Tab: Enviar ─────────────────────────────────────────────────────── */}
      {activeTab === "enviar" && (
        <div className="space-y-4">
          {!conexaoAtiva && (
            <div className="flex items-center gap-3 border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle size={18} className="text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-800">
                {role === "corretor" ? "Conecte o WhatsApp (QR code ou API oficial) na aba Conexão." : "Peça ao administrador para conectar o WhatsApp na aba Conexão."}
              </p>
            </div>
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${!conexaoAtiva ? "opacity-50 pointer-events-none" : ""}`}>
            {/* Lead selection */}
            <div className="bg-white border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
                  Destinatários{selectedLeads.length > 0 && <span className="text-[var(--brand-yellow)]"> ({selectedLeads.length})</span>}
                </h2>
                {selectedLeads.length > 0 && (
                  <button onClick={() => setSelectedLeads([])} className="text-xs text-red-400 hover:underline">Limpar</button>
                )}
              </div>
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" placeholder="Buscar lead..." value={searchLead}
                  onChange={(e) => setSearchLead(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 text-xs focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredLeads.map((l) => {
                  const selected = selectedLeads.includes(l.id);
                  return (
                    <label key={l.id}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer border transition-colors ${selected ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-transparent hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={selected} onChange={() => setSelectedLeads((prev) => selected ? prev.filter((id) => id !== l.id) : [...prev, l.id])}
                        className="accent-[var(--brand-yellow)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{l.nome}</p>
                        <p className="text-xs text-gray-600">{l.telefone}{parseServicosLead(l.servico).length ? ` · ${parseServicosLead(l.servico).join(", ")}` : ""}</p>
                      </div>
                    </label>
                  );
                })}
                {filteredLeads.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Nenhum lead encontrado.</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => setSelectedLeads(leads.map((l) => l.id))}
                  className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[var(--brand-dark)] transition-colors">
                  <Users size={12} /> Selecionar todos ({leads.length})
                </button>
              </div>
            </div>

            {/* Message composer */}
            <div className="bg-white border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Mensagem</h2>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Template</label>
                <select value={selectedTemplate?.id ?? ""}
                  onChange={(e) => { const t = templates.find((t) => t.id === e.target.value) ?? null; setSelectedTemplate(t); setMensagem(t?.body ?? ""); setServicosSelecionados([]); }}
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">— Selecione um template —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.category} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mensagem</label>
                <textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem ou selecione um template..."
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none font-mono" />
                <p className="text-xs text-gray-600 mt-1">{mensagem.length} caracteres</p>
              </div>
              {usaVariaveis && selectedLeads.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  {usaServicos && <div className="border border-yellow-200 bg-yellow-50 p-3"><p className="mb-2 text-xs font-bold text-yellow-900">Selecione somente os serviços desta mensagem:</p><div className="grid gap-2 sm:grid-cols-2">{servicosDisponiveis.map((servico) => <label key={servico} className="flex items-center gap-2 text-xs text-gray-800"><input type="checkbox" checked={servicosSelecionados.includes(servico)} onChange={() => setServicosSelecionados((atual) => atual.includes(servico) ? atual.filter((s) => s !== servico) : [...atual, servico])} />{servico}</label>)}</div>{!servicosSelecionados.length && <p className="mt-2 text-xs text-red-700">Selecione ao menos um serviço.</p>}</div>}
                  {(faltando.length > 0 || variaveis.includes("documentos")) && (
                    <div className="space-y-2 border border-yellow-200 bg-yellow-50 p-3">
                      {faltando.length > 0 && <p className="text-xs font-bold text-yellow-900">Alguns destinatários não têm estes dados no cadastro. Informe para enviar:</p>}
                      {faltando.filter((v) => v !== "documentos" && v !== "servico" && v !== "servicos").map((v) => (
                        <div key={v}>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">{VARIAVEIS_TEMPLATE[v] ?? v}</label>
                          <input type="text" list={v === "imovel" ? "imoveis-whatsapp" : undefined} value={extras[v] ?? ""} onChange={(e) => setExtras((x) => ({ ...x, [v]: e.target.value }))}
                            className="w-full border border-yellow-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
                          {v === "imovel" && <datalist id="imoveis-whatsapp">{imoveis.map((i) => <option key={i.id} value={i.texto} />)}</datalist>}
                        </div>
                      ))}
                      {variaveis.includes("documentos") && selectedLeads.map((id) => {
                        const d = docsPorLead[id] ?? { marcados: [], livre: "" };
                        return <div key={id} className="border-t border-yellow-200 pt-2">
                          <p className="text-xs font-bold text-gray-800 mb-1">Documentos de {leads.find((l) => l.id === id)?.nome}</p>
                          <div className="grid gap-1 sm:grid-cols-2">{DOCUMENTOS_CHECKLIST.map((doc) => <label key={doc.chave} className="flex items-center gap-2 text-xs text-gray-800">
                            <input type="checkbox" checked={d.marcados.includes(doc.chave)} onChange={(e) => setDocsPorLead((x) => ({ ...x, [id]: { ...d, marcados: e.target.checked ? [...d.marcados, doc.chave] : d.marcados.filter((c) => c !== doc.chave) } }))} /> {doc.nome}
                          </label>)}</div>
                          <input type="text" value={d.livre} placeholder="Outro documento (opcional)" onChange={(e) => setDocsPorLead((x) => ({ ...x, [id]: { ...d, livre: e.target.value } }))} className="mt-2 w-full border border-yellow-300 px-3 py-2 text-sm bg-white" />
                        </div>;
                      })}
                    </div>
                  )}
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Prévia (como cada contato vai receber)</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {previaAtual.slice(0, 20).map((p) => (
                      <div key={p.id} className="bg-gray-50 border border-gray-100 p-2 text-xs text-gray-900 whitespace-pre-wrap">
                        <b className="text-[var(--brand-dark)]">{leads.find((l) => l.id === p.id)?.nome}: </b>{p.texto}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mensagem && !usaVariaveis && (
                <div className="bg-[#ECE5DD] p-4">
                  <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase">Prévia</p>
                  <div className="bg-white p-3 shadow-sm max-w-xs">
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{mensagem}</p>
                    <p className="text-[10px] text-gray-600 text-right mt-2">agora ✓✓</p>
                  </div>
                </div>
              )}
              <button onClick={handleEnviar} disabled={enviando || selectedLeads.length === 0 || !mensagem.trim() || faltando.length > 0 || (usaServicos && !servicosSelecionados.length)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors">
                <Send size={13} /> {enviando ? "Enviando..." : `Enviar para ${selectedLeads.length} contato${selectedLeads.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Templates ──────────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {podeGerenciarTemplates && <div className="flex justify-end"><button onClick={() => setEditorTemplate({ nome: "", finalidade: "", conteudo: "" })} className="flex items-center gap-2 bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase text-[var(--brand-dark)]"><Plus size={14}/>Novo template</button></div>}
          {editorTemplate && <form action={() => startTransition(async () => { try { await salvarTemplateWhatsapp(editorTemplate); setEditorTemplate(null); setToast({ msg: "Template salvo.", type: "success" }); window.location.reload(); } catch (e) { setToast({ msg: e instanceof Error ? e.message : "Erro ao salvar template.", type: "error" }); } })} className="space-y-3 border border-gray-200 bg-white p-5"><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Nome" placeholder="Nome" value={editorTemplate.nome} onChange={(e) => setEditorTemplate({ ...editorTemplate, nome: e.target.value })} className="border p-2 text-sm"/><input aria-label="Finalidade" placeholder="Finalidade" value={editorTemplate.finalidade} onChange={(e) => setEditorTemplate({ ...editorTemplate, finalidade: e.target.value })} className="border p-2 text-sm"/></div><textarea aria-label="Conteúdo" rows={7} value={editorTemplate.conteudo} onChange={(e) => setEditorTemplate({ ...editorTemplate, conteudo: e.target.value })} className="w-full border p-2 text-sm"/><div className="whitespace-pre-wrap bg-gray-50 p-3 text-xs"><b>Prévia:</b><br/>{editorTemplate.conteudo || "Digite o conteúdo."}</div><div className="flex gap-2"><button type="submit" className="bg-green-600 px-4 py-2 text-xs font-bold text-white">Salvar</button><button type="button" onClick={() => setEditorTemplate(null)} className="border px-4 py-2 text-xs font-bold">Cancelar</button></div></form>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-[var(--brand-dark)] text-sm">{t.name}</p>
                  <span className="text-[10px] font-bold bg-[var(--brand-yellow)]/20 text-[var(--brand-dark)] px-2 py-0.5 uppercase">{t.category}</span>
                </div>
                {podeGerenciarTemplates && <button onClick={() => setEditorTemplate({ id: t.id, nome: t.name, finalidade: t.category, conteudo: t.body })} className="border px-3 py-1.5 text-xs font-bold uppercase">Editar</button>}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mt-3 whitespace-pre-line line-clamp-3">{t.body}</p>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ── Tab: Histórico ──────────────────────────────────────────────────── */}
    </div>
  );
}
