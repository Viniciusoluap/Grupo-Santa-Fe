"use client";

// LOTE B (25/10): Configurações › Integrações — Asaas, Pluggy e WhatsApp (Evolution) num lugar só.
// Cada bloco testa ao abrir e no botão Testar (mensagem real do serviço), mostra só os 4 últimos
// caracteres da chave salva e permite trocar (o servidor valida antes de salvar).
// Gêmeo de Prospecta/client/src/pages/admin/AdminIntegracoes.tsx (visual do Santa Fé).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import {
  salvarAsaasIntegracaoAcao, salvarEvolutionIntegracaoAcao, salvarPluggyIntegracaoAcao, statusIntegracoesAcao, testarIntegracaoAcao,
} from "@/lib/actions/integracoes";
import type { ResultadoTeste, ServicoIntegracao, StatusIntegracoes } from "@/lib/integracoes";

type Campo = { nome: string; rotulo: string; segredo?: boolean; placeholder?: string; opcional?: boolean };
type Mensagem = { tipo: "ok" | "erro"; texto: string };

const campoCls = "w-full border border-gray-300 px-3 py-2 text-sm text-[var(--brand-dark)] bg-white focus:outline-none focus:border-[var(--brand-yellow)]";
const rotuloCls = "block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1";
const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";

const FONTE = (f: "env" | "banco" | null) => (f === "env" ? " (variável de ambiente do servidor)" : f === "banco" ? " (salva nesta tela)" : "");

function Status({ testando, teste }: { testando: boolean; teste: ResultadoTeste | null }) {
  if (testando) return <p className="flex items-center gap-2 text-sm text-gray-700"><Loader2 size={14} className="animate-spin" /> Testando…</p>;
  if (!teste) return null;
  return teste.ok
    ? <p role="status" className="flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> Conectado — {teste.mensagem}</p>
    : <p role="alert" className="flex items-start gap-2 text-sm text-red-700"><XCircle size={16} className="mt-0.5 shrink-0" /> Erro — {teste.mensagem}</p>;
}

function Bloco({ titulo, servico, salvo, extra, campos, onSalvar, onSalvo }: {
  titulo: string;
  servico: ServicoIntegracao;
  salvo: ReactNode;
  extra?: ReactNode;
  campos: Campo[];
  /** Devolve a mensagem de erro (ou null quando salvou). */
  onSalvar: (valores: Record<string, string>) => Promise<string | null>;
  onSalvo: () => Promise<void>;
}) {
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(true);
  const [trocando, setTrocando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Mensagem | null>(null);
  const preenchido = campos.some((c) => valores[c.nome]?.trim()) && campos.every((c) => c.opcional || valores[c.nome]?.trim());

  const testar = useCallback(async () => {
    setTestando(true);
    try { setTeste(await testarIntegracaoAcao(servico)); }
    catch { setTeste({ ok: false, mensagem: "Não foi possível testar agora." }); }
    finally { setTestando(false); }
  }, [servico]);

  // Teste real ao abrir a tela (o estado inicial já é "Testando…").
  useEffect(() => {
    let vivo = true;
    testarIntegracaoAcao(servico)
      .catch((): ResultadoTeste => ({ ok: false, mensagem: "Não foi possível testar agora." }))
      .then((r) => { if (vivo) { setTeste(r); setTestando(false); } });
    return () => { vivo = false; };
  }, [servico]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setMsg(null);
    try {
      const erro = await onSalvar(valores);
      if (erro) { setMsg({ tipo: "erro", texto: erro }); return; }
      setMsg({ tipo: "ok", texto: "Salvo." });
      setValores({}); setTrocando(false);
      await onSalvo();
      await testar();
    } catch { setMsg({ tipo: "erro", texto: "Não foi possível salvar." }); }
    finally { setSalvando(false); }
  }

  return (
    <section className="bg-white border border-gray-100 p-5 space-y-3" aria-label={titulo}>
      <h2 className="font-black text-[var(--brand-dark)] uppercase tracking-wide text-sm">{titulo}</h2>
      <Status testando={testando} teste={teste} />
      <div className="text-sm text-gray-800 space-y-1">{salvo}</div>
      {extra}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={botaoSec} disabled={testando} onClick={() => void testar()}>Testar</button>
        <button type="button" className={botaoSec} onClick={() => { setTrocando((t) => !t); setValores({}); setMsg(null); }}>{trocando ? "Cancelar" : "Trocar"}</button>
      </div>
      {trocando && (
        <form className="space-y-3 border border-gray-100 bg-gray-50 p-3" onSubmit={(e) => void salvar(e)}>
          {campos.map((c) => (
            <div key={c.nome}>
              <label className={rotuloCls} htmlFor={`${servico}-${c.nome}`}>{c.rotulo}{c.opcional ? " (opcional)" : ""}</label>
              <input id={`${servico}-${c.nome}`} type={c.segredo ? "password" : "text"} autoComplete="off" placeholder={c.placeholder} value={valores[c.nome] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))} className={campoCls} />
            </div>
          ))}
          <button type="submit" disabled={!preenchido || salvando} className={botaoPri}>
            {salvando && <Loader2 size={12} className="animate-spin" />}{salvando ? "Validando…" : "Validar e salvar"}
          </button>
        </form>
      )}
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-xs ${msg.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.texto}</p>}
    </section>
  );
}

export function IntegracoesClient({ inicial }: { inicial: StatusIntegracoes }) {
  const [status, setStatus] = useState<StatusIntegracoes>(inicial);
  const [copiado, setCopiado] = useState(false);
  const recarregar = useCallback(async () => {
    const r = await statusIntegracoesAcao().catch(() => null);
    if (r?.status) setStatus(r.status);
  }, []);

  const { asaas, pluggy, whatsapp } = status;

  return (
    <div className="space-y-5">
      <Bloco
        titulo="Asaas — conta Asaas do BPO"
        servico="asaas"
        salvo={<>
          <p>{asaas.configurado ? `Chave em uso terminando em ${asaas.final}${FONTE(asaas.fonte)} — ambiente ${asaas.ambiente === "production" ? "produção" : "sandbox"}.` : "Nenhuma chave de API salva."}</p>
          {asaas.fonte === "env" && <p className="text-amber-800">A chave em uso vem da variável ASAAS_API_KEY do servidor e tem precedência{asaas.salvaNoBancoIgnorada ? " — a chave salva nesta tela está sendo ignorada" : ""}.</p>}
          <p>{asaas.webhookConfigurado ? `Token do webhook terminando em ${asaas.webhookFinal}${FONTE(asaas.webhookFonte)}.` : "Token do webhook não salvo (os avisos em tempo real do Asaas serão recusados; o extrato continua pela sincronização diária)."}</p>
          {asaas.webhookFonte === "env" && <p className="text-amber-800">O token em uso vem da variável ASAAS_WEBHOOK_TOKEN do servidor e tem precedência sobre o salvo nesta tela.</p>}
        </>}
        extra={
          <div className="border border-[var(--brand-yellow)]/40 bg-[var(--brand-yellow)]/10 p-3 text-sm">
            <p className="font-bold text-[var(--brand-dark)]">URL do webhook para cadastrar no Asaas:</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all bg-white px-2 py-1 text-[var(--brand-dark)]">{asaas.webhookUrl}</code>
              <button type="button" className={botaoSec}
                onClick={() => { void navigator.clipboard?.writeText(asaas.webhookUrl).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); }}>
                <Copy size={12} /> {copiado ? "Copiada!" : "Copiar"}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-700">No Asaas: Integrações › Webhooks, use o mesmo token salvo aqui. O ambiente (produção/sandbox) é reconhecido pela chave ($aact_prod… = produção). Contas Asaas do BPO sem chave própria usam esta chave.</p>
          </div>
        }
        campos={[
          { nome: "apiKey", rotulo: "Nova chave de API", segredo: true, placeholder: "$aact_prod_...", opcional: true },
          { nome: "webhookToken", rotulo: "Novo token do webhook", segredo: true, opcional: true },
        ]}
        onSalvar={async (v) => (await salvarAsaasIntegracaoAcao({ apiKey: v.apiKey?.trim() || undefined, webhookToken: v.webhookToken?.trim() || undefined })).erro ?? null}
        onSalvo={recarregar}
      />

      <Bloco
        titulo="Pluggy — contas do Meu Pluggy no BPO"
        servico="pluggy"
        salvo={<p>{pluggy.configurado ? `Client ID terminando em ${pluggy.clientIdFinal} · Client Secret terminando em ${pluggy.secretFinal}${FONTE(pluggy.fonte)}.` : "Client ID e Client Secret não salvos."}</p>}
        extra={<p className="text-xs text-gray-700">Conectar banco e buscar contas: <Link href="/admin/bpo?aba=bancos" className="underline font-bold text-[var(--brand-dark)]">BPO › Bancos</Link>.</p>}
        campos={[
          { nome: "clientId", rotulo: "Client ID", segredo: true },
          { nome: "clientSecret", rotulo: "Client Secret", segredo: true },
        ]}
        onSalvar={async (v) => (await salvarPluggyIntegracaoAcao({ clientId: v.clientId ?? "", clientSecret: v.clientSecret ?? "" })).erro ?? null}
        onSalvo={recarregar}
      />

      <Bloco
        titulo="WhatsApp — servidor da Evolution (QR code)"
        servico="whatsapp"
        salvo={<p>{whatsapp.configurado ? `Endereço ${whatsapp.url} · chave terminando em ${whatsapp.final}${FONTE(whatsapp.fonte)}.` : "Endereço e chave do servidor não salvos."}</p>}
        extra={<p className="text-xs text-gray-700">Conectar o número (QR code) e conversas: <Link href="/admin/whatsapp" className="underline font-bold text-[var(--brand-dark)]">Central WhatsApp</Link>.</p>}
        campos={[
          { nome: "url", rotulo: "Endereço do servidor", placeholder: "https://evolution-xxxx.up.railway.app" },
          { nome: "apiKey", rotulo: "Chave de acesso (AUTHENTICATION_API_KEY)", segredo: true },
        ]}
        onSalvar={async (v) => (await salvarEvolutionIntegracaoAcao({ url: v.url ?? "", apiKey: v.apiKey ?? "" })).erro ?? null}
        onSalvo={recarregar}
      />
    </div>
  );
}
