"use client";

// Mapbox (opcional) — pedido de 11/11: com o token PÚBLICO (pk.) o mapa do terreno usa o
// satélite do Mapbox (mais nítido em várias cidades); sem token tudo funciona com a Esri.
// Gêmeo de Prospecta/client/src/components/admin/MapboxCard.tsx (visual do Santa Fé).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { removerMapboxAcao, salvarMapboxAcao, statusMapboxAcao, testarMapboxAcao } from "@/lib/actions/integracoes";

type Status = Awaited<ReturnType<typeof statusMapboxAcao>>;
const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";

export function MapboxCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [testando, setTestando] = useState(true);
  const [trocando, setTrocando] = useState(false);
  const [token, setToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const recarregar = useCallback(async () => {
    setTestando(true);
    const [s, t] = await Promise.all([statusMapboxAcao(), testarMapboxAcao()]).catch(() => [null, { ok: false, mensagem: "Não foi possível testar agora." }] as const);
    setStatus(s); setTeste(t); setTestando(false);
  }, []);
  useEffect(() => {
    let vivo = true;
    Promise.all([statusMapboxAcao(), testarMapboxAcao()])
      .then(([s, t]) => { if (vivo) { setStatus(s); setTeste(t); setTestando(false); } })
      .catch(() => { if (vivo) { setTeste({ ok: false, mensagem: "Não foi possível testar agora." }); setTestando(false); } });
    return () => { vivo = false; };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setMsg(null);
    const r = await salvarMapboxAcao(token).catch(() => ({ erro: "Não foi possível salvar." }) as { erro?: string; mensagem?: string });
    setSalvando(false);
    if (r.erro) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    setMsg({ tipo: "ok", texto: r.mensagem ?? "Salvo." }); setToken(""); setTrocando(false);
    await recarregar();
  }
  async function remover() {
    const r = await removerMapboxAcao();
    setMsg(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Token removido — o mapa volta a usar a Esri." });
    await recarregar();
  }

  return (
    <section className="border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="font-black text-[var(--brand-dark)] uppercase tracking-wide text-sm">Mapbox — satélite do mapa do terreno (opcional)</h2>
      {testando ? <p className="flex items-center gap-2 text-sm text-gray-700"><Loader2 size={14} className="animate-spin" /> Testando…</p>
        : teste && (status?.configurado
          ? <p className={`flex items-start gap-2 text-sm ${teste.ok ? "text-emerald-700" : "text-red-700"}`}>{teste.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />} {teste.mensagem}</p>
          : <p className="flex items-start gap-2 text-sm text-gray-700"><Info size={16} className="mt-0.5 shrink-0" /> {teste.mensagem}</p>)}
      <p className="text-sm text-gray-700">{status?.configurado ? `Token salvo terminando em ${status.final}${status.fonte === "env" ? " (variável MAPBOX_PUBLIC_TOKEN do servidor)" : " (salvo nesta tela)"}.` : "Nenhum token salvo — não é obrigatório."}</p>
      <p className="text-xs text-gray-500">Use o token público (começa com pk.) da sua conta Mapbox. O sistema confere o token no Mapbox antes de salvar.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={botaoSec} disabled={testando} onClick={() => void recarregar()}>Testar</button>
        <button type="button" className={botaoSec} onClick={() => { setTrocando((t) => !t); setToken(""); }}>{trocando ? "Cancelar" : status?.configurado ? "Trocar" : "Adicionar token"}</button>
        {status?.configurado && status.fonte === "banco" && <button type="button" className={botaoSec} onClick={() => void remover()}>Remover</button>}
      </div>
      {trocando && (
        <form className="space-y-3 border border-gray-200 bg-gray-50 p-3" onSubmit={salvar}>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Token público do Mapbox
            <input autoComplete="off" placeholder="pk.eyJ1Ijoi..." value={token} onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm text-[var(--brand-dark)] bg-white focus:outline-none focus:border-[var(--brand-yellow)] normal-case tracking-normal font-normal" />
          </label>
          <button type="submit" className={botaoPri} disabled={!token.trim() || salvando}>{salvando ? "Validando…" : "Validar e salvar"}</button>
        </form>
      )}
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-sm ${msg.tipo === "erro" ? "text-red-700" : "text-emerald-700"}`}>{msg.texto}</p>}
    </section>
  );
}
