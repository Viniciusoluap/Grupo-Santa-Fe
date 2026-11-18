"use client";

// Paridade 17/11, bloco 3 — Anthropic (Inteligência Artificial) em Integrações. Gêmeo de
// Prospecta/client/src/components/admin/AnthropicCard.tsx (EPIC-024 S-10 e S-11), no visual do Santa Fé.
// Só cadastro: guardar a chave (criptografada no servidor), testar quando o admin pedir, listar os modelos que a
// chave tem, guardar o preferencial e escolher o modelo de cada função. Nada aqui liga a IA de função nenhuma.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import {
  modelosAnthropicAcao, modelosPorFuncaoAnthropicAcao, removerAnthropicAcao, salvarAnthropicAcao, salvarModeloAnthropicAcao,
  salvarModeloFuncaoAnthropicAcao, statusAnthropicAcao, testarAnthropicAcao,
} from "@/lib/actions/integracoes";
import { haAlgoParaSalvar } from "@/lib/ia/funcoes-anthropic";

const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";
const campo = "mt-1 w-full border border-gray-300 px-3 py-2 text-sm text-[var(--brand-dark)] bg-white focus:outline-none focus:border-[var(--brand-yellow)] normal-case tracking-normal font-normal";
const FAMILIA: Record<string, string> = { opus: "Opus", sonnet: "Sonnet", haiku: "Haiku", fable: "Fable", outro: "Outros" };
const ORIGEM: Record<string, string> = {
  ambiente: "variável de ambiente do servidor (tem prioridade)", funcao: "escolhido para esta função",
  anterior: "configurado na própria função", preferencial: "preferencial do painel", padrao: "padrão da função",
};

type Status = NonNullable<Extract<Awaited<ReturnType<typeof statusAnthropicAcao>>, { status: unknown }>["status"]>;
type PorFuncao = NonNullable<Extract<Awaited<ReturnType<typeof modelosPorFuncaoAnthropicAcao>>, { status: unknown }>["status"]>;
type Modelo = { id: string; nome: string; familia: string };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;

function OpcoesDeModelo({ lista }: { lista: Modelo[] }) {
  const familias = Array.from(new Set(lista.map((m) => m.familia)));
  return <>{familias.map((f) => (
    <optgroup key={f} label={FAMILIA[f] ?? f}>
      {lista.filter((m) => m.familia === f).map((m) => <option key={m.id} value={m.id}>{m.nome} — {m.id}</option>)}
    </optgroup>
  ))}</>;
}

export function AnthropicCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pf, setPf] = useState<PorFuncao | null>(null);
  const [erroPf, setErroPf] = useState<string | null>(null);
  const [lista, setLista] = useState<Modelo[] | null>(null);
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [chave, setChave] = useState("");
  const [escolhido, setEscolhido] = useState("");
  const [escolhaFuncao, setEscolhaFuncao] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);

  const recarregar = useCallback(async () => {
    const [s, p] = await Promise.all([statusAnthropicAcao(), modelosPorFuncaoAnthropicAcao()]);
    if ("status" in s && s.status) setStatus(s.status); else if ("erro" in s) setMsg({ tipo: "erro", texto: s.erro ?? "Erro." });
    if ("status" in p && p.status) { setPf(p.status); setErroPf(null); } else if ("erro" in p) setErroPf(p.erro ?? "Erro.");
  }, []);
  useEffect(() => {
    let vivo = true;
    Promise.all([statusAnthropicAcao(), modelosPorFuncaoAnthropicAcao()]).then(([s, p]) => {
      if (!vivo) return;
      if ("status" in s && s.status) setStatus(s.status);
      if ("status" in p && p.status) setPf(p.status); else if ("erro" in p) setErroPf(p.erro ?? "Erro.");
    });
    return () => { vivo = false; };
  }, []);

  async function testar() {
    setOcupado("testar");
    setTeste(await testarAnthropicAcao());
    setOcupado(null);
  }
  async function carregarModelos() {
    setOcupado("modelos");
    const r = await modelosAnthropicAcao();
    setOcupado(null);
    if ("erro" in r) { setMsg({ tipo: "erro", texto: r.erro ?? "Erro." }); return; }
    setLista(r.modelos);
    await recarregar();
  }
  async function salvarChave(e: React.FormEvent) {
    e.preventDefault();
    setOcupado("salvar"); setMsg(null);
    const r = await salvarAnthropicAcao(chave);
    setOcupado(null);
    if ("erro" in r) { setMsg({ tipo: "erro", texto: r.erro ?? "Erro." }); return; }
    setMsg({ tipo: "ok", texto: r.mensagem }); setChave(""); setTrocando(false); setTeste(null); setLista(null);
    await recarregar();
  }
  async function remover() {
    if (!window.confirm("Remover a chave da Anthropic, o modelo preferencial e os modelos escolhidos por função?")) return;
    const r = await removerAnthropicAcao();
    setMsg(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Chave da Anthropic removida." });
    setTeste(null); setLista(null);
    await recarregar();
  }
  async function salvarPreferencial(e: React.FormEvent) {
    e.preventDefault();
    setOcupado("preferencial");
    const r = await salvarModeloAnthropicAcao(escolhido || status?.modeloPreferencial || "");
    setOcupado(null);
    if ("erro" in r) { setMsg({ tipo: "erro", texto: r.erro ?? "Erro." }); return; }
    setMsg({ tipo: "ok", texto: `Modelo preferencial: ${r.modelo.nome}.` });
    await recarregar();
  }
  async function salvarFuncao(funcao: string, valor: string, rotulo: string) {
    setOcupado(`funcao:${funcao}`);
    const r = await salvarModeloFuncaoAnthropicAcao(funcao, valor);
    setOcupado(null);
    if ("erro" in r) { setMsg({ tipo: "erro", texto: r.erro ?? "Erro." }); return; }
    setMsg({ tipo: "ok", texto: r.modelo ? `${rotulo}: ${r.modelo.nome}.` : `${rotulo}: usa a próxima opção (configuração da função ou preferencial).` });
    setEscolhaFuncao((x) => { const n = { ...x }; delete n[funcao]; return n; });
    setPf(r.status);
  }

  const s = status;
  const modelos = lista ?? [];
  const nomeDe = (id: string | null | undefined) => (id ? modelos.find((m) => m.id === id)?.nome ?? id : null);

  return (
    <section id="integracao-anthropic" className="scroll-mt-4 border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="font-black text-[var(--brand-dark)] uppercase tracking-wide text-sm">Anthropic — Inteligência Artificial</h2>
      {ocupado === "testar" ? <p className="flex items-center gap-2 text-sm text-gray-700"><Loader2 size={14} className="animate-spin" /> Testando…</p>
        : teste && <p className={`flex items-start gap-2 text-sm ${teste.ok ? "text-emerald-700" : "text-red-700"}`}>{teste.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />} {teste.mensagem}</p>}
      <p className="text-sm text-gray-700">
        {!s ? "Carregando…" : s.configurado ? `Chave configurada, terminando em ${s.final} (salva nesta tela, criptografada).` : s.ilegivel ? "" : "Nenhuma chave salva."}
      </p>
      {s?.ilegivel && <p role="alert" className="flex items-start gap-2 text-sm text-amber-800"><XCircle size={16} className="mt-0.5 shrink-0" /> {s.aviso}</p>}
      {s?.configurado && <p className="text-sm text-gray-700">Modelo preferencial: {s.modeloPreferencial ? <code className="bg-gray-100 px-1">{nomeDe(s.modeloPreferencial) !== s.modeloPreferencial ? `${nomeDe(s.modeloPreferencial)} (${s.modeloPreferencial})` : s.modeloPreferencial}</code> : "nenhum escolhido."}</p>}
      <p className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        <Info size={14} className="mt-0.5 shrink-0" /> A chave não é usada automaticamente: nenhuma função do sistema roda por ela. Aqui você escolhe só o MODELO de cada função; cada uma continua com a chave dela (a da Central de Vendas ou ANTHROPIC_API_KEY no servidor). Testar e listar modelos não consome tokens.
      </p>
      <div className="flex flex-wrap gap-2">
        {s?.configurado && <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={() => void testar()}>Testar conexão</button>}
        <button type="button" className={botaoSec} onClick={() => { setTrocando((t) => !t); setChave(""); }}>{trocando ? "Cancelar" : s?.configurado ? "Trocar chave" : "Adicionar chave"}</button>
        {s?.configurado && <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={() => void carregarModelos()}>{ocupado === "modelos" ? "Consultando…" : modelos.length ? "Atualizar modelos" : "Escolher modelo"}</button>}
        {(s?.configurado || s?.ilegivel) && <button type="button" className={botaoSec} onClick={() => void remover()}>Remover</button>}
      </div>
      {trocando && (
        <form className="space-y-3 border border-gray-200 bg-gray-50 p-3" onSubmit={salvarChave}>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Chave de API da Anthropic
            <input type="password" autoComplete="off" placeholder="sk-ant-..." value={chave} onChange={(e) => setChave(e.target.value)} className={campo} />
          </label>
          <p className="text-xs text-gray-500">A chave é conferida na Anthropic antes de salvar e nunca volta para a tela.</p>
          <button type="submit" className={botaoPri} disabled={!chave.trim() || ocupado !== null}>{ocupado === "salvar" ? "Validando…" : "Validar e salvar"}</button>
        </form>
      )}
      {s?.configurado && lista && (
        <form className="space-y-2 border border-gray-200 bg-gray-50 p-3" onSubmit={salvarPreferencial}>
          <label htmlFor="modelo-anthropic" className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Modelo de IA preferencial ({modelos.length} disponível(is) para esta chave)</label>
          {modelos.length === 0 ? <p className="text-sm text-gray-700">A Anthropic não listou nenhum modelo para esta chave.</p> : (
            <select id="modelo-anthropic" value={escolhido || s.modeloPreferencial || ""} onChange={(e) => setEscolhido(e.target.value)} className={campo}>
              <option value="" disabled>Escolha um modelo</option>
              <OpcoesDeModelo lista={modelos} />
            </select>
          )}
          {s.modeloPreferencial && modelos.length > 0 && !modelos.some((m) => m.id === s.modeloPreferencial) && <p className="text-xs text-amber-800">O modelo salvo não aparece mais na lista desta chave — escolha outro.</p>}
          <button type="submit" className={botaoPri} disabled={!(escolhido || s.modeloPreferencial) || ocupado !== null || modelos.length === 0}>{ocupado === "preferencial" ? "Salvando…" : "Salvar preferência"}</button>
        </form>
      )}

      <section aria-labelledby="modelo-por-funcao" className="space-y-2 border border-gray-200 bg-gray-50 p-3">
        <h3 id="modelo-por-funcao" className="text-xs font-black uppercase tracking-wide text-[var(--brand-dark)]">Modelo por função</h3>
        {erroPf ? <p role="alert" className="text-sm text-red-700">{erroPf}</p> : !pf ? <p className="text-sm text-gray-700">Carregando…</p> : <>
          <p className="text-xs text-gray-600">
            {pf.configurado
              ? `Cada função pode usar um modelo diferente da conta. Sem escolha, vale o configurado na própria função; depois, o preferencial${pf.preferencial ? ` (${nomeDe(pf.preferencial)})` : " (nenhum escolhido)"}. Escolher aqui não liga a IA nem consome tokens.`
              : "Cadastre a chave da Anthropic acima para listar os modelos da conta e escolher o de cada função. Sem a escolha, cada função segue como antes."}
          </p>
          {pf.configurado && modelos.length === 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
              <span>Para escolher, carregue a lista de modelos desta conta.</span>
              <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={() => void carregarModelos()}>{ocupado === "modelos" ? "Consultando…" : "Carregar modelos"}</button>
            </div>
          )}
          <ul className="space-y-3">
            {pf.funcoes.map((f) => {
              const valor = escolhaFuncao[f.id] ?? f.modelo ?? "";
              const idSelect = `modelo-funcao-${f.id}`;
              const foraDaLista = modelos.length > 0 && f.valendo.modelo && f.valendo.origem !== "ambiente" && !modelos.some((m) => m.id === f.valendo.modelo);
              return (
                <li key={f.id} className="space-y-2 border border-gray-200 bg-white p-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-dark)]">{f.rotulo}</p>
                    <p className="text-xs text-gray-600">{f.descricao}</p>
                    <p className="mt-1 text-xs text-gray-700">Recomendação — {f.recomendacao}</p>
                    {f.nota && <p className="mt-1 text-xs text-gray-500">{f.nota}</p>}
                  </div>
                  <p className="text-sm text-gray-800">
                    Valendo agora: {f.valendo.modelo
                      ? <><code className="bg-gray-100 px-1">{nomeDe(f.valendo.modelo)}</code> <span className="text-xs text-gray-500">({ORIGEM[f.valendo.origem ?? ""] ?? "—"})</span></>
                      : <span className="text-amber-800">nenhum modelo</span>}
                  </p>
                  {f.semChave && <p className="text-xs text-amber-800">{f.semChave}</p>}
                  {f.sumiu && <p role="alert" className="flex items-start gap-2 text-xs text-amber-800"><XCircle size={14} className="mt-0.5 shrink-0" /> O modelo escolhido ({f.sumiu}) não existe mais nesta conta: a função passou a usar a próxima opção. Escolha outro, ou salve a opção vazia para tirar este aviso.</p>}
                  {foraDaLista && <p className="text-xs text-amber-800">O modelo em uso não aparece na lista atual desta conta.</p>}
                  {pf.configurado && modelos.length > 0 && (
                    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void salvarFuncao(f.id, valor, f.rotulo); }}>
                      <div className="min-w-0 flex-1">
                        <label className="block text-xs font-bold text-gray-700" htmlFor={idSelect}>Modelo para esta função</label>
                        <select id={idSelect} value={valor} onChange={(e) => setEscolhaFuncao((x) => ({ ...x, [f.id]: e.target.value }))} className={campo}>
                          <option value="">Sem escolha (configuração da função ou preferencial)</option>
                          <OpcoesDeModelo lista={modelos} />
                        </select>
                      </div>
                      <button type="submit" className={botaoPri} disabled={!haAlgoParaSalvar(f, valor) || ocupado !== null}>{ocupado === `funcao:${f.id}` ? "Salvando…" : "Salvar"}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </>}
      </section>
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-sm ${msg.tipo === "erro" ? "text-red-700" : "text-emerald-700"}`}>{msg.texto}</p>}
    </section>
  );
}
