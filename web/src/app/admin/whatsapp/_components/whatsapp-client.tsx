"use client";

import { useState } from "react";
import { MessageSquare, Send, CheckCheck, Clock, AlertCircle, Users, Plus, Search, Phone } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

type DbLead = { id: string; nome: string; telefone: string; servico: string };

type TemplateCategory = "boas_vindas" | "follow_up" | "agendamento" | "proposta" | "financiamento" | "personalizada";

interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
}

interface MessageLog {
  id: string;
  to: string;
  phone: string;
  template: string;
  sentAt: string;
  status: "enviada" | "entregue" | "lida" | "falhou";
}

const TEMPLATES: Template[] = [
  {
    id: "t1",
    name: "Boas-vindas ao lead",
    category: "boas_vindas",
    body: "Olá *{{nome}}*! 👋 Aqui é da equipe do *Grupo Santa Fé*. Recebemos seu contato sobre {{servico}}. Em breve um de nossos especialistas entrará em contato. Fique à vontade para responder aqui! 🏡",
    variables: ["nome", "servico"],
  },
  {
    id: "t2",
    name: "Follow-up após 48h",
    category: "follow_up",
    body: "Olá *{{nome}}*! Sou {{corretor}} do Grupo Santa Fé. Gostaria de saber se ainda tem interesse em {{servico}}? Posso te ajudar com mais informações ou agendar uma visita. 😊",
    variables: ["nome", "corretor", "servico"],
  },
  {
    id: "t3",
    name: "Confirmação de visita",
    category: "agendamento",
    body: "Olá *{{nome}}*! ✅ Confirmando sua visita ao imóvel *{{imovel}}* para *{{data}}* às *{{hora}}*. Nosso corretor {{corretor}} estará te esperando. Qualquer dúvida, é só chamar! 📍",
    variables: ["nome", "imovel", "data", "hora", "corretor"],
  },
  {
    id: "t4",
    name: "Envio de proposta",
    category: "proposta",
    body: "Olá *{{nome}}*! 🎉 Sua proposta para o imóvel *{{imovel}}* foi preparada. Valor: *R$ {{valor}}*. Acesse o link para visualizar os detalhes: {{link}}. Em caso de dúvidas, entre em contato!",
    variables: ["nome", "imovel", "valor", "link"],
  },
  {
    id: "t5",
    name: "Atualização do financiamento",
    category: "financiamento",
    body: "Olá *{{nome}}*! 🏦 Temos uma atualização sobre seu processo de financiamento: *{{status}}*. {{mensagem}} Para mais informações, fale com seu corretor {{corretor}}.",
    variables: ["nome", "status", "mensagem", "corretor"],
  },
  {
    id: "t6",
    name: "Lembrete de documentos",
    category: "financiamento",
    body: "Olá *{{nome}}*! 📄 Lembrete: ainda precisamos dos seguintes documentos para dar continuidade ao seu processo:\n\n{{documentos}}\n\nPor favor, envie o quanto antes para não atrasar! ⏰",
    variables: ["nome", "documentos"],
  },
];

const RECENT_LOGS: MessageLog[] = [
  { id: "ml1", to: "Carlos Mendes", phone: "(94) 9 8888-1111", template: "Boas-vindas ao lead", sentAt: "2026-06-04T09:15:00", status: "lida" },
  { id: "ml2", to: "Beatriz Santos", phone: "(94) 9 7777-2222", template: "Confirmação de visita", sentAt: "2026-06-04T09:30:00", status: "entregue" },
  { id: "ml3", to: "Roberto Alves", phone: "(94) 9 6666-3333", template: "Atualização do financiamento", sentAt: "2026-06-04T10:00:00", status: "enviada" },
  { id: "ml4", to: "Ana Paula Lima", phone: "(94) 9 5555-4444", template: "Lembrete de documentos", sentAt: "2026-06-03T14:22:00", status: "lida" },
  { id: "ml5", to: "Marcos Ferreira", phone: "(94) 9 8877-5566", template: "Follow-up após 48h", sentAt: "2026-06-03T11:00:00", status: "falhou" },
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  boas_vindas: "Boas-vindas",
  follow_up: "Follow-up",
  agendamento: "Agendamento",
  proposta: "Proposta",
  financiamento: "Financiamento",
  personalizada: "Personalizada",
};

const STATUS_CONFIG = {
  enviada: { label: "Enviada", icon: <Clock size={12} className="text-gray-400" />, color: "text-gray-500" },
  entregue: { label: "Entregue", icon: <CheckCheck size={12} className="text-blue-400" />, color: "text-blue-500" },
  lida: { label: "Lida", icon: <CheckCheck size={12} className="text-green-500" />, color: "text-green-600" },
  falhou: { label: "Falhou", icon: <AlertCircle size={12} className="text-red-400" />, color: "text-red-500" },
};

interface WhatsAppClientProps {
  leads: DbLead[];
}

export function WhatsAppClient({ leads }: WhatsAppClientProps) {
  const [activeTab, setActiveTab] = useState<"enviar" | "templates" | "historico">("enviar");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchLead, setSearchLead] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "todas">("todas");

  const filteredLeads = leads.filter(
    (l) => !searchLead || l.nome.toLowerCase().includes(searchLead.toLowerCase()) || l.telefone.includes(searchLead)
  );

  const filteredTemplates = TEMPLATES.filter(
    (t) => categoryFilter === "todas" || t.category === categoryFilter
  );

  function handleSend() {
    if (selectedLeads.length === 0 || !customMessage.trim()) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setSelectedLeads([]);
      setSelectedTemplate(null);
      setCustomMessage("");
    }, 3000);
  }

  const lidas = RECENT_LOGS.filter((m) => m.status === "lida").length;
  const entregues = RECENT_LOGS.filter((m) => m.status === "entregue").length;
  const falhas = RECENT_LOGS.filter((m) => m.status === "falhou").length;
  const taxa = Math.round(((lidas + entregues) / RECENT_LOGS.length) * 100);

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Central WhatsApp</h1>
        <p className="text-gray-400 text-sm mt-0.5">{leads.length} leads disponíveis para envio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Leads cadastrados", value: leads.length, icon: Users, color: "text-[var(--brand-yellow)]" },
          { label: "Taxa de leitura", value: `${taxa}%`, icon: CheckCheck, color: "text-green-500" },
          { label: "Lidas", value: lidas, icon: CheckCheck, color: "text-green-500" },
          { label: "Falhas", value: falhas, icon: AlertCircle, color: "text-red-400" },
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
      <div className="flex border-b border-gray-200">
        {([
          { key: "enviar", label: "Enviar Mensagem", icon: Send },
          { key: "templates", label: "Templates", icon: MessageSquare },
          { key: "historico", label: "Histórico", icon: Clock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === key
                ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Enviar */}
      {activeTab === "enviar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
                Destinatários ({selectedLeads.length} selecionados)
              </h2>
              {selectedLeads.length > 0 && (
                <button onClick={() => setSelectedLeads([])} className="text-xs text-red-400 hover:underline">Limpar</button>
              )}
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lead..."
                value={searchLead}
                onChange={(e) => setSearchLead(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 text-xs focus:outline-none focus:border-[var(--brand-yellow)]"
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredLeads.map((l) => {
                const selected = selectedLeads.includes(l.id);
                return (
                  <label key={l.id} className={`flex items-center gap-3 p-2.5 cursor-pointer border transition-colors ${selected ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-transparent hover:bg-gray-50"}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setSelectedLeads((prev) => selected ? prev.filter((id) => id !== l.id) : [...prev, l.id])}
                      className="accent-[var(--brand-yellow)]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{l.nome}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> {l.telefone}</p>
                    </div>
                  </label>
                );
              })}
              {filteredLeads.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum lead encontrado.</p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedLeads(leads.map((l) => l.id))}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
              >
                <Users size={12} /> Selecionar todos ({leads.length})
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 p-5 space-y-4">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Mensagem</h2>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Template</label>
              <select
                value={selectedTemplate?.id ?? ""}
                onChange={(e) => {
                  const t = TEMPLATES.find((t) => t.id === e.target.value) ?? null;
                  setSelectedTemplate(t);
                  setCustomMessage(t?.body ?? "");
                }}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
              >
                <option value="">— Selecione um template —</option>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{CATEGORY_LABELS[t.category]} — {t.name}</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div className="bg-gray-50 p-3 text-xs text-gray-500">
                <p className="font-bold mb-1">Variáveis necessárias:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.variables.map((v) => (
                    <span key={v} className="bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold px-2 py-0.5">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mensagem</label>
              <textarea
                rows={6}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Digite a mensagem ou selecione um template acima..."
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{customMessage.length} caracteres</p>
            </div>

            {customMessage && (
              <div className="bg-[#ECE5DD] p-4 rounded-sm">
                <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Prévia</p>
                <div className="bg-white p-3 rounded-sm shadow-sm max-w-xs">
                  <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: customMessage.replace(/\*([^*]+)\*/g, "<strong>$1</strong>") }}
                  />
                  <p className="text-[10px] text-gray-400 text-right mt-2">agora ✓✓</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={handleSend}
                disabled={selectedLeads.length === 0 || !customMessage.trim()}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
              >
                <Send size={13} /> Enviar para {selectedLeads.length} contato{selectedLeads.length !== 1 ? "s" : ""}
              </button>
              {sent && (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <CheckCheck size={13} /> Enviado com sucesso!
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter("todas")}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${categoryFilter === "todas" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}
            >
              Todos ({TEMPLATES.length})
            </button>
            {(Object.entries(CATEGORY_LABELS) as [TemplateCategory, string][]).map(([cat, label]) => {
              const count = TEMPLATES.filter((t) => t.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${categoryFilter === cat ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((t) => (
              <div key={t.id} className="bg-white border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-[var(--brand-dark)] text-sm">{t.name}</p>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 uppercase">{CATEGORY_LABELS[t.category]}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedTemplate(t); setCustomMessage(t.body); setActiveTab("enviar"); }}
                    className="text-xs bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase px-3 py-1.5 shrink-0 transition-colors"
                  >
                    Usar
                  </button>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mt-3 whitespace-pre-line line-clamp-3">{t.body}</p>
                {t.variables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.variables.map((v) => (
                      <span key={v} className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="bg-gray-50 border border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-[var(--brand-yellow)] transition-colors">
              <Plus size={24} className="text-gray-300" />
              <p className="text-sm font-bold text-gray-400">Novo Template</p>
              <p className="text-xs text-gray-400">Criar um template personalizado</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === "historico" && (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Mensagens Recentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {RECENT_LOGS.map((m) => {
              const sc = STATUS_CONFIG[m.status];
              return (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-green-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                      {m.to[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{m.to}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> {m.phone}</p>
                    </div>
                  </div>
                  <div className="hidden md:block flex-1 min-w-0 px-4">
                    <p className="text-xs text-gray-500 truncate">{m.template}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-xs text-gray-400 hidden lg:block">
                      {new Date(m.sentAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className={`flex items-center gap-1 text-xs font-bold ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
