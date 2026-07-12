"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, CheckCircle, Trash2, AlertCircle, RefreshCw, Phone, ExternalLink } from "lucide-react";

interface Draft {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  preco: number;
  area: number;
  quartos: number | null;
  bairro: string;
  cidade: string;
  estado: string;
  contatoOrigem: string | null;
  origemUrl: string | null;
  criadoEm: string;
}

function formatCurrency(v: number) {
  const fixed = v.toFixed(2);
  const [int, dec] = fixed.split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

export function ProspeccaoModule({ apiConfigurada }: { apiConfigurada: boolean }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prospeccao");
      if (res.ok) {
        const data = await res.json() as { drafts: Draft[] };
        setDrafts(data.drafts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDrafts(); }, [fetchDrafts]);

  async function executarProspeccao() {
    setRunning(true);
    setMessage(null);
    // Timeout no cliente: garante que o botão nunca fique "Buscando..." para
    // sempre, mesmo que a resposta do servidor nunca chegue por algum motivo
    // de rede — sempre recupera a UI em no máximo 58s com uma mensagem clara.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 58_000);
    try {
      const res = await fetch("/api/admin/prospeccao", { method: "POST", signal: controller.signal });
      let data: { created?: number; message?: string; error?: string } = {};
      try {
        data = await res.json() as typeof data;
      } catch {
        setMessage({ text: "O servidor não devolveu uma resposta válida. Tente novamente.", type: "error" });
        return;
      }
      if (!res.ok) {
        setMessage({ text: data.error ?? "Erro desconhecido.", type: "error" });
      } else {
        setMessage({ text: data.message ?? `${data.created ?? 0} imóveis adicionados.`, type: "ok" });
        await fetchDrafts();
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      setMessage({
        text: isAbort
          ? "A busca demorou demais e foi cancelada. Tente novamente."
          : String(e),
        type: "error",
      });
    } finally {
      clearTimeout(timeoutId);
      setRunning(false);
    }
  }

  async function handleAcao(id: string, action: "aprovar" | "descartar") {
    const res = await fetch("/api/admin/prospeccao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="bg-white border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded flex items-center justify-center bg-[var(--brand-dark)] text-[var(--brand-yellow)] flex-shrink-0">
            <Search size={18} />
          </div>
          <div>
            <h2 className="font-bold text-[var(--brand-dark)]">Prospecção com IA</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Busca automática de imóveis em portais e na web · execução mensal recomendada
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDrafts}
            disabled={loading}
            title="Atualizar lista"
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={executarProspeccao}
            disabled={running || !apiConfigurada}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-wider"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            {running ? "Buscando…" : "Executar busca"}
          </button>
        </div>
      </div>

      {/* API not configured warning */}
      {!apiConfigurada && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Configuração necessária</p>
            <p className="mt-0.5">
              Adicione <code className="bg-yellow-100 px-1">ANTHROPIC_API_KEY</code> nas variáveis de ambiente do Vercel para ativar a busca automática.
              Opcionalmente, configure <code className="bg-yellow-100 px-1">PROSPECCAO_CIDADE</code> com o nome da cidade (padrão: &quot;Canaã dos Carajás PA&quot;).
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`flex items-start gap-2 p-3 text-xs ${message.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-100 text-red-600"}`}>
          {message.type === "ok" ? <CheckCircle size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* How it works */}
      <div className="mt-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Como funciona</p>
        <ol className="space-y-1">
          {[
            "A IA busca imóveis disponíveis no Google, portais e redes sociais usando Brave Search",
            "Claude extrai preço, área, localização e contato do anunciante de cada resultado",
            "Os imóveis encontrados ficam em rascunho para sua revisão — nenhum é publicado automaticamente",
            "Você aprova os que interessam ou descarta os irrelevantes",
            "O contato do anunciante fica visível apenas para admin e colaboradores",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-xs font-black text-[var(--brand-dark)] w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Drafts list */}
      {drafts.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Aguardando revisão ({drafts.length})
          </p>
          <div className="space-y-3">
            {drafts.map((d) => (
              <div key={d.id} className="border border-gray-100 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--brand-dark)] truncate">{d.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.tipo} · {d.status === "venda" ? "Venda" : "Locação"} · {d.bairro}, {d.cidade}/{d.estado}
                    </p>
                  </div>
                  <p className="font-black text-[var(--brand-dark)] text-sm shrink-0">{formatCurrency(d.preco)}</p>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {d.area > 0 && <span>{d.area} m²</span>}
                  {d.quartos != null && <span>{d.quartos} qto{d.quartos !== 1 ? "s" : ""}</span>}
                </div>

                {/* Contact — admin only */}
                {d.contatoOrigem && (
                  <div className="flex items-center gap-1.5 bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]/30 px-3 py-1.5 text-xs">
                    <Phone size={11} className="text-[var(--brand-dark)] shrink-0" />
                    <span className="font-bold text-[var(--brand-dark)]">Contato do anunciante:</span>
                    <span className="text-gray-700">{d.contatoOrigem}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {d.origemUrl && (
                    <a
                      href={d.origemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ExternalLink size={10} /> Ver origem
                    </a>
                  )}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => handleAcao(d.id, "descartar")}
                    className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 transition-colors"
                  >
                    <Trash2 size={11} /> Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcao(d.id, "aprovar")}
                    className="flex items-center gap-1 text-xs font-bold bg-[var(--brand-dark)] text-[var(--brand-yellow)] px-2.5 py-1 hover:opacity-90 transition-opacity"
                  >
                    <CheckCircle size={11} /> Aprovar e publicar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {drafts.length === 0 && !loading && (
        <p className="text-xs text-gray-400 text-center py-4">
          Nenhum imóvel aguardando revisão. Execute uma busca para começar.
        </p>
      )}
    </div>
  );
}
