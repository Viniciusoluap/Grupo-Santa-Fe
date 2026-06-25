"use client";

import { useState, useTransition, useEffect } from "react";
import {
  MessageCircle, CheckCircle2, Clock, AlertCircle, Wifi, WifiOff,
  Search, X, Send, Smartphone, Plus, Eye, Users,
} from "lucide-react";
import { salvarConexaoBusiness } from "@/lib/actions/whatsapp";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConexaoData {
  id: string; usuarioId: string; numero: string | null; status: string;
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
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template { id: string; name: string; category: string; body: string; }

const TEMPLATES: Template[] = [
  { id: "t1", name: "Boas-vindas ao lead", category: "Captação", body: "Olá {{nome}}! Sou {{corretor}} da Grupo Santa Fé. Recebemos seu contato sobre {{servico}}. Podemos conversar?" },
  { id: "t2", name: "Follow-up 48h", category: "Acompanhamento", body: "Olá {{nome}}, tudo bem? Estou entrando em contato sobre {{servico}}. Tenho opções que podem te interessar! 😊" },
  { id: "t3", name: "Confirmação de visita", category: "Agenda", body: "Olá {{nome}}! Confirmo nossa visita às {{horario}} no endereço {{endereco}}. Qualquer dúvida me chame! ✅" },
  { id: "t4", name: "Envio de proposta", category: "Negociação", body: "Olá {{nome}}! Preparei uma proposta sobre {{imovel}}. Podemos agendar para apresentar os detalhes?" },
  { id: "t5", name: "Atualização do financiamento", category: "Financiamento", body: "Olá {{nome}}! O banco {{banco}} aprovou sua análise de crédito! Vamos conversar?" },
  { id: "t6", name: "Lembrete de documentos", category: "Documentação", body: "Olá {{nome}}! Ainda precisamos dos documentos: {{documentos}}. Pode nos enviar? 📄" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  enviada:  { label: "Enviada",  bg: "bg-gray-100",  text: "text-gray-600"  },
  entregue: { label: "Entregue", bg: "bg-blue-100",  text: "text-blue-700"  },
  lida:     { label: "Lida",     bg: "bg-green-100", text: "text-green-700" },
  falhou:   { label: "Falhou",   bg: "bg-red-100",   text: "text-red-700"   },
};

function StatusConexao({ status }: { status: string }) {
  if (status === "conectado") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold">
      <Wifi size={12} /> Conectado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-500 text-xs font-bold">
      <WifiOff size={12} /> Desconectado
    </span>
  );
}

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

export function WhatsAppClient({ leads, minhaConexao: initialConexao, conexoesCorretores, historico, role, usuarioId }: Props) {
  const [activeTab, setActiveTab] = useState<"conexao" | "enviar" | "templates" | "historico">("conexao");
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
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

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
    setEnviando(true);
    try {
      const destinatarios = leads.filter((l) => selectedLeads.includes(l.id)).map((l) => ({ id: l.id, nome: l.nome, telefone: l.telefone, leadId: l.id }));
      const res = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem, destinatarios }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; enviadas?: number; falhas?: number };
      if (data.error) {
        setToast({ msg: data.error, type: "error" });
      } else {
        setToast({ msg: `${data.enviadas ?? 0} enviada(s)${(data.falhas ?? 0) > 0 ? `, ${data.falhas} falha(s)` : ""}`, type: (data.falhas ?? 0) > 0 ? "error" : "success" });
        setSelectedLeads([]); setMensagem(""); setSelectedTemplate(null);
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
        <p className="text-gray-400 text-sm mt-0.5">{totalLeads} leads disponíveis para envio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Leads Disponíveis", value: totalLeads, icon: Users, color: "text-[var(--brand-yellow)]" },
          { label: "Mensagens Enviadas", value: totalEnviadas, icon: MessageCircle, color: "text-blue-500" },
          { label: "Taxa de Leitura", value: `${taxaLeitura}%`, icon: Eye, color: "text-green-500" },
          { label: "Falhas", value: totalFalhas, icon: AlertCircle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
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
          { key: "enviar" as const, label: "Enviar Mensagem", icon: Send },
          { key: "templates" as const, label: "Templates", icon: MessageCircle },
          { key: "historico" as const, label: "Histórico", icon: Clock },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${activeTab === key ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Conexão ────────────────────────────────────────────────────── */}
      {activeTab === "conexao" && (
        <div className="space-y-5">

          {/* Colaborador: read-only */}
          {role === "colaborador" && (
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4">WhatsApp Business (Admin)</h2>
              {minhaConexao ? (
                <div className="space-y-2">
                  <StatusConexao status={minhaConexao.status} />
                  {minhaConexao.numero && <p className="text-xs text-gray-500">{minhaConexao.numero}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nenhuma conexão configurada pelo administrador.</p>
              )}
              <p className="text-xs text-gray-400 mt-3">Como colaborador, você usa a conexão do administrador. Contate o admin para gerenciar.</p>
            </div>
          )}

          {/* Admin / Corretor: manage own connection */}
          {(role === "admin" || role === "corretor") && (
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4">
                {role === "admin" ? "Minha Conexão WhatsApp Business" : "Minha Conexão WhatsApp"}
              </h2>

              {/* Connected */}
              {conexaoAtiva && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <div>
                      <p className="font-bold text-green-700 text-sm">Conectado via WhatsApp Business API</p>
                      {minhaConexao?.numero && <p className="text-xs text-gray-500 mt-0.5">{minhaConexao.numero}</p>}
                    </div>
                  </div>
                  <button onClick={handleDesconectar} disabled={desconectando}
                    className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs uppercase px-4 py-2 transition-colors disabled:opacity-40">
                    <WifiOff size={13} /> {desconectando ? "Removendo..." : "Remover conexão"}
                  </button>
                </div>
              )}

              {/* Not connected: Business API form */}
              {!conexaoAtiva && (
                <div className="space-y-5">
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
              )}
            </div>
          )}

          {/* Admin: corretores' connections */}
          {role === "admin" && (
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4">
                Conexões dos Corretores {conexoesCorretores.length > 0 && `(${conexoesCorretores.length})`}
              </h2>
              {conexoesCorretores.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum corretor cadastrado.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {conexoesCorretores.map((c) => (
                    <div key={c.usuarioId} className="flex items-center gap-4 py-3">
                      <div className="w-8 h-8 bg-[var(--brand-dark)] flex items-center justify-center text-[var(--brand-yellow)] font-black text-sm shrink-0">
                        {c.usuarioNome[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--brand-dark)] text-sm truncate">{c.usuarioNome}</p>
                        {c.numero && <p className="text-xs text-gray-400">{c.numero}</p>}
                      </div>
                      <StatusConexao status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Enviar ─────────────────────────────────────────────────────── */}
      {activeTab === "enviar" && (
        <div className="space-y-4">
          {!conexaoAtiva && (
            <div className="flex items-center gap-3 border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle size={18} className="text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-800">
                {role === "colaborador"
                  ? "A conexão WhatsApp do administrador não está ativa. Contate o admin."
                  : "Configure sua conexão WhatsApp Business na aba Conexão."}
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
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                        <p className="text-xs text-gray-400">{l.telefone} · {l.servico}</p>
                      </div>
                    </label>
                  );
                })}
                {filteredLeads.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum lead encontrado.</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => setSelectedLeads(leads.map((l) => l.id))}
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-[var(--brand-dark)] transition-colors">
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
                  onChange={(e) => { const t = TEMPLATES.find((t) => t.id === e.target.value) ?? null; setSelectedTemplate(t); setMensagem(t?.body ?? ""); }}
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">— Selecione um template —</option>
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.category} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mensagem</label>
                <textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem ou selecione um template..."
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none font-mono" />
                <p className="text-xs text-gray-400 mt-1">{mensagem.length} caracteres</p>
              </div>
              {mensagem && (
                <div className="bg-[#ECE5DD] p-4">
                  <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase">Prévia</p>
                  <div className="bg-white p-3 shadow-sm max-w-xs">
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{mensagem}</p>
                    <p className="text-[10px] text-gray-400 text-right mt-2">agora ✓✓</p>
                  </div>
                </div>
              )}
              <button onClick={handleEnviar} disabled={enviando || selectedLeads.length === 0 || !mensagem.trim()}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors">
                <Send size={13} /> {enviando ? "Enviando..." : `Enviar para ${selectedLeads.length} contato${selectedLeads.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Templates ──────────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-[var(--brand-dark)] text-sm">{t.name}</p>
                  <span className="text-[10px] font-bold bg-[var(--brand-yellow)]/20 text-[var(--brand-dark)] px-2 py-0.5 uppercase">{t.category}</span>
                </div>
                <button onClick={() => { setSelectedTemplate(t); setMensagem(t.body); setActiveTab("enviar"); }}
                  className="text-xs bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase px-3 py-1.5 shrink-0 transition-colors">
                  Usar
                </button>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mt-3 whitespace-pre-line line-clamp-3">{t.body}</p>
            </div>
          ))}
          <div className="bg-gray-50 border border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 text-center">
            <Plus size={24} className="text-gray-300" />
            <p className="text-sm font-bold text-gray-400">Novo Template</p>
            <p className="text-xs text-gray-400">Em breve</p>
          </div>
        </div>
      )}

      {/* ── Tab: Histórico ──────────────────────────────────────────────────── */}
      {activeTab === "historico" && (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Mensagens Enviadas</h2>
            <span className="text-xs text-gray-400">{historico.length} registros</span>
          </div>
          {historico.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <MessageCircle size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma mensagem enviada ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--brand-dark)] text-[var(--brand-yellow)]">
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">Contato</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide hidden md:table-cell">Mensagem</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide hidden lg:table-cell">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historico.map((m) => {
                    const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.enviada;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--brand-dark)]">{m.nomeDestinatario ?? m.destinatario}</p>
                          <p className="text-xs text-gray-400">{m.destinatario}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                          <p className="text-xs text-gray-600 truncate">{m.mensagem}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                          {m.erroMsg && <p className="text-xs text-red-400 mt-0.5">{m.erroMsg}</p>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                          {new Date(m.enviadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
