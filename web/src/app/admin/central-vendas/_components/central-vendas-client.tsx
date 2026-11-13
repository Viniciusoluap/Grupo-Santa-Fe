"use client";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/client/src/pages/admin/AdminCentralVendas.tsx).
// Painel de indicadores, atendimentos (com a decisão da análise) e as telas de configuração (só admin):
// interruptores, modo de teste, horários, SLA, limites, produtos, checklists, sequências, campanhas (links wa.me),
// templates e auditoria/fila.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, RefreshCw, Save } from "lucide-react";
import { Toaster, toast } from "sonner";
import { exigirResultado, type ErroAcao } from "@/lib/acao-resultado";
import {
  atendimentosCentralVendas, auditoriaCentralVendas, campanhasCentralVendas, checklistsCentralVendas, configuracaoCentralVendas,
  criarCampanhaCentralVendas, definirSegredoCentralVendas, encerrarAtendimentoCentralVendas, executarRotinaAgoraCentralVendas,
  exportarCsvCentralVendas, gerarTokenCentralVendas, painelCentralVendas, produtosCentralVendas, reativarAutomacaoCentralVendas,
  registrarDecisaoCentralVendas, reprocessarCentralVendas, salvarChecklistCentralVendas, salvarConfiguracaoCentralVendas,
  salvarProdutoCentralVendas, salvarSequenciaCentralVendas, salvarTemplateCentralVendas, sequenciasCentralVendas, templatesCentralVendas,
} from "@/lib/actions/central-vendas";
import {
  ROTULOS_SEQUENCIA, ROTULOS_STATUS, TIPOS_DOCUMENTO, TIPOS_SEQUENCIA, type ItemChecklist, type PassoSequencia, type TipoSequencia,
} from "@/lib/central-vendas/config";

const card = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm";
const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const select = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm";
const btn = "inline-flex items-center gap-1 rounded-md bg-[var(--brand-dark)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnSec = "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50";
const rotulo = "mb-1 block text-xs font-medium text-gray-600";
const SEM = "sem dados";

type Aba = "painel" | "atendimentos" | "configuracoes" | "produtos" | "checklists" | "sequencias" | "campanhas" | "templates" | "auditoria";
const ABAS: { id: Aba; rotulo: string; admin?: boolean }[] = [
  { id: "painel", rotulo: "Painel" }, { id: "atendimentos", rotulo: "Atendimentos" },
  { id: "configuracoes", rotulo: "Configurações", admin: true }, { id: "produtos", rotulo: "Produtos", admin: true },
  { id: "checklists", rotulo: "Checklists", admin: true }, { id: "sequencias", rotulo: "Sequências", admin: true },
  { id: "campanhas", rotulo: "Campanhas", admin: true }, { id: "templates", rotulo: "Templates", admin: true },
  { id: "auditoria", rotulo: "Auditoria", admin: true },
];

const fmtMin = (v: number | null) => (v === null ? SEM : v < 60 ? `${v.toLocaleString("pt-BR")} min` : v < 1440 ? `${(v / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(v / 1440).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`);
const rot = (s: string) => ROTULOS_STATUS[s] ?? s;
const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

/** Carrega dados por server action e recarrega quando pedir (ou quando `chave` mudar). */
function useDados<T>(carregar: () => Promise<T | ErroAcao>, chave = "") {
  const [dados, setDados] = useState<T | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    carregar().then(r => { if (vivo) setDados(exigirResultado(r)); }).catch(erro);
    return () => { vivo = false; };
    // A função muda a cada render; o que importa é a chave dos filtros e o pedido de recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);
  return { dados, recarregar: () => setVersao(v => v + 1) };
}

async function rodar<T>(p: Promise<T | ErroAcao>, ok?: string): Promise<T | null> {
  try { const r = exigirResultado(await p); if (ok) toast.success(ok); return r; } catch (e) { erro(e); return null; }
}

export function CentralVendasClient({ admin }: { admin: boolean }) {
  const [aba, setAba] = useState<Aba>("painel");
  return (
    <div className="space-y-5">
      <Toaster richColors position="top-right" />
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-dark)]">Central de Vendas</h1>
        <p className="text-sm text-gray-500">Captação, qualificação, documentos e análise pelo WhatsApp, de forma automática.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {ABAS.filter(a => admin || !a.admin).map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)} className={aba === a.id ? btn : btnSec}>{a.rotulo}</button>
        ))}
      </nav>
      {aba === "painel" && <Painel />}
      {aba === "atendimentos" && <Atendimentos />}
      {admin && aba === "configuracoes" && <Configuracoes />}
      {admin && aba === "produtos" && <Produtos />}
      {admin && aba === "checklists" && <Checklists />}
      {admin && aba === "sequencias" && <Sequencias />}
      {admin && aba === "campanhas" && <Campanhas />}
      {admin && aba === "templates" && <Templates />}
      {admin && aba === "auditoria" && <Auditoria />}
    </div>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string | number | null }) {
  return (
    <div className={card}>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{valor === null ? <span className="text-base text-gray-400">{SEM}</span> : valor}</p>
    </div>
  );
}

function Painel() {
  const [f, setF] = useState({ de: "", ate: "", operadorId: "", produtoId: "", origem: "" });
  const filtros = { de: f.de || null, ate: f.ate || null, operadorId: f.operadorId || null, produtoId: f.produtoId ? Number(f.produtoId) : null, origem: f.origem || null };
  const chave = JSON.stringify(filtros);
  const { dados } = useDados(() => painelCentralVendas(JSON.parse(chave)), chave);
  const ind = dados?.indicadores;
  async function exportar() {
    const r = await rodar(exportarCsvCentralVendas(filtros));
    if (!r) return;
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `central-de-vendas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      {dados && !dados.ativo && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">As automações estão desligadas (interruptor geral em Configurações).</p>}
      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <div><label className={rotulo}>De</label><input type="date" className={input} value={f.de} onChange={e => setF({ ...f, de: e.target.value })} /></div>
        <div><label className={rotulo}>Até</label><input type="date" className={input} value={f.ate} onChange={e => setF({ ...f, ate: e.target.value })} /></div>
        {dados?.admin && (
          <div><label className={rotulo}>Operador</label>
            <select className={select} value={f.operadorId} onChange={e => setF({ ...f, operadorId: e.target.value })}>
              <option value="">Todos</option>{dados.opcoes.operadores.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select></div>
        )}
        <div><label className={rotulo}>Empreendimento</label>
          <select className={select} value={f.produtoId} onChange={e => setF({ ...f, produtoId: e.target.value })}>
            <option value="">Todos</option>{dados?.opcoes.produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select></div>
        <div><label className={rotulo}>Origem</label>
          <select className={select} value={f.origem} onChange={e => setF({ ...f, origem: e.target.value })}>
            <option value="">Todas</option>{dados?.opcoes.origens.map(o => <option key={o} value={o}>{o}</option>)}
          </select></div>
        <button type="button" className={btnSec} onClick={exportar}><Download className="h-4 w-4" />CSV</button>
      </div>
      {!ind && <p className="text-gray-500">Carregando…</p>}
      {ind && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi titulo="Leads recebidos" valor={ind.recebidos} />
            <Kpi titulo="Qualificados" valor={ind.recebidos ? ind.qualificados : null} />
            <Kpi titulo="Tempo de 1ª resposta (média)" valor={ind.tempoPrimeiraRespostaMin === null ? null : fmtMin(ind.tempoPrimeiraRespostaMin)} />
            <Kpi titulo="Taxa de conversão (aprovados/recebidos)" valor={ind.taxaConversao === null ? null : `${ind.taxaConversao.toLocaleString("pt-BR")}%`} />
            <Kpi titulo="Aguardando documentos" valor={ind.recebidos ? ind.aguardandoDocumentos : null} />
            <Kpi titulo="Documentação completa" valor={ind.recebidos ? ind.documentacaoCompleta : null} />
            <Kpi titulo="Enviados à análise" valor={ind.recebidos ? ind.enviadosAnalise : null} />
            <Kpi titulo="Pendências da análise" valor={ind.recebidos ? ind.pendencias : null} />
            <Kpi titulo="Aprovados" valor={ind.recebidos ? ind.aprovados : null} />
            <Kpi titulo="Reprovados" valor={ind.recebidos ? ind.reprovados : null} />
            <Kpi titulo="Entrada → qualificação" valor={ind.tempoMedioEtapasMin.entradaAteQualificacao === null ? null : fmtMin(ind.tempoMedioEtapasMin.entradaAteQualificacao)} />
            <Kpi titulo="Qualificação → documentos" valor={ind.tempoMedioEtapasMin.qualificacaoAteDocumentos === null ? null : fmtMin(ind.tempoMedioEtapasMin.qualificacaoAteDocumentos)} />
            <Kpi titulo="Análise → decisão" valor={ind.tempoMedioEtapasMin.documentosAteDecisao === null ? null : fmtMin(ind.tempoMedioEtapasMin.documentosAteDecisao)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className={card}><p className="mb-2 font-semibold">Atendimentos por operador</p>
              {ind.atendimentosPorOperador.length ? ind.atendimentosPorOperador.map(o => <div key={o.operadorId} className="flex justify-between text-sm"><span>{o.nome}</span><span>{o.total}</span></div>) : <p className="text-sm text-gray-400">{SEM}</p>}
            </div>
            <div className={card}><p className="mb-2 font-semibold">Origem das oportunidades</p>
              {ind.origens.length ? ind.origens.map(o => <div key={o.origem} className="flex justify-between text-sm"><span>{o.origem}</span><span>{o.total}</span></div>) : <p className="text-sm text-gray-400">{SEM}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Atendimentos() {
  const { dados, recarregar } = useDados(() => atendimentosCentralVendas({}));
  const [decisao, setDecisao] = useState<{ leadId: string; tipo: "pendente" | "aprovado" | "reprovado"; pendencias: string; motivo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    if (!decisao) return;
    setOcupado(true);
    const r = await rodar(registrarDecisaoCentralVendas({ leadId: decisao.leadId, decisao: decisao.tipo, pendencias: decisao.pendencias || undefined, motivoInterno: decisao.motivo || undefined }), "Decisão registrada. A mensagem ao cliente foi disparada automaticamente.");
    setOcupado(false);
    if (r) { setDecisao(null); recarregar(); }
  }
  if (!dados) return <p className="text-gray-500">Carregando…</p>;
  if (!dados.length) return <p className="text-gray-500">Nenhum atendimento na Central ainda.</p>;
  return (
    <div className="space-y-3">
      {dados.map(a => (
        <div key={a.leadId} className={`${card} space-y-2 text-sm`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/admin/leads/${a.leadId}`} className="font-semibold text-[var(--brand-dark)] hover:underline">{a.nome}</Link>
            <span className="text-xs text-gray-500">{a.origem}{a.campanha ? ` · ${a.campanha}` : ""} · {a.operador ?? "sem operador"}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">{rot(a.statusAtendimento)}</span>
            <span className="rounded bg-teal-100 px-2 py-0.5 text-teal-800">Docs: {rot(a.statusDocumental)}</span>
            <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">Análise: {rot(a.statusAnalise)}</span>
            {a.optOut && <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">Saiu das mensagens automáticas</span>}
          </div>
          {a.motivo && <p className="text-xs text-gray-600">Transferido: {a.motivo}</p>}
          {a.resumo && <p className="whitespace-pre-line text-xs text-gray-600">{a.resumo}</p>}
          {a.pendencias && <p className="text-xs text-amber-700">Pendências: {a.pendencias}</p>}
          {a.motivoReprovacao && <p className="text-xs text-gray-500">Motivo interno (só equipe): {a.motivoReprovacao}</p>}
          <div className="flex flex-wrap gap-2">
            {a.podeDecidir && (["pendente", "aprovado", "reprovado"] as const).map(t => (
              <button key={t} type="button" className={btnSec} onClick={() => setDecisao({ leadId: a.leadId, tipo: t, pendencias: "", motivo: "" })}>
                {t === "pendente" ? "Pendente" : t === "aprovado" ? "Aprovar" : "Reprovar"}
              </button>
            ))}
            {a.optOut && <button type="button" className={btnSec} onClick={async () => { if (await rodar(reativarAutomacaoCentralVendas(a.leadId))) recarregar(); }}>Reativar automação</button>}
            {a.statusAtendimento !== "encerrado" && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={async () => { if (await rodar(encerrarAtendimentoCentralVendas(a.leadId))) recarregar(); }}>Encerrar</button>}
          </div>
          {decisao?.leadId === a.leadId && (
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="font-medium">Registrar: {decisao.tipo}</p>
              {decisao.tipo === "pendente" && <textarea className={input} placeholder="Pendências (vão para o cliente)" value={decisao.pendencias} onChange={e => setDecisao({ ...decisao, pendencias: e.target.value })} />}
              {decisao.tipo === "reprovado" && <textarea className={input} placeholder="Motivo interno (fica só com a equipe; o cliente recebe mensagem neutra)" value={decisao.motivo} onChange={e => setDecisao({ ...decisao, motivo: e.target.value })} />}
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={confirmar} disabled={ocupado}>Confirmar</button>
                <button type="button" className={btnSec} onClick={() => setDecisao(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const linhas = (t: string) => t.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
const inteiros = (t: string) => linhas(t).map(Number).filter(n => Number.isInteger(n) && n > 0);
const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

function Interruptor({ marcado, mudar, texto }: { marcado: boolean; mudar: (v: boolean) => void; texto: string }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={marcado} onChange={e => mudar(e.target.checked)} /> {texto}</label>;
}

function Configuracoes() {
  const { dados, recarregar } = useDados(() => configuracaoCentralVendas());
  const { dados: checklists } = useDados(() => checklistsCentralVendas());
  type Cfg = NonNullable<typeof dados>["config"];
  const [c, setC] = useState<Cfg | null>(null);
  const [testes, setTestes] = useState("");
  const [lembretes, setLembretes] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [segredos, setSegredos] = useState({ tokenLogycaEnvio: "", chaveAnthropic: "" });
  if (dados && !c) { setC(dados.config); setTestes(dados.config.numerosTeste.join("\n")); setLembretes(dados.config.lembretesDias.join(", ")); }
  if (!c || !dados) return <p className="text-gray-500">Carregando…</p>;
  const set = (p: Partial<Cfg>) => setC({ ...c, ...p });
  async function gravar() {
    if (!c) return;
    const { segredosDefinidos: _definidos, ...resto } = c;
    void _definidos;
    await rodar(salvarConfiguracaoCentralVendas({ ...resto, numerosTeste: linhas(testes), lembretesDias: inteiros(lembretes) }), "Configurações salvas.");
  }
  const auto = c.automacoes;
  const n = (v: string) => Number(v);
  return (
    <div className="space-y-4">
      <div className={`${card} grid gap-3 sm:grid-cols-2`}>
        <p className="font-semibold sm:col-span-2">Interruptores</p>
        <Interruptor marcado={c.ativo} mudar={v => set({ ativo: v })} texto="Automações ligadas (geral)" />
        <Interruptor marcado={c.modoTeste} mudar={v => set({ modoTeste: v })} texto="Modo de teste (só números autorizados)" />
        {(Object.keys(auto) as (keyof typeof auto)[]).map(k => (
          <Interruptor key={k} marcado={auto[k]} mudar={v => set({ automacoes: { ...auto, [k]: v } })}
            texto={{ ia: "IA de atendimento", documentos: "Documentos", lembretes: "Lembretes", followup: "Follow-up", reativacao: "Reativação" }[k]} />
        ))}
        <div className="sm:col-span-2"><label className={rotulo}>Números autorizados no modo de teste (um por linha)</label><textarea className={input} value={testes} onChange={e => setTestes(e.target.value)} /></div>
      </div>

      <div className={`${card} space-y-3 text-sm`}>
        <p className="font-semibold">Equipe</p>
        <p className="text-gray-600">Operadores recebem os atendimentos em rodízio. Analistas recebem a tarefa de análise e registram a decisão (o administrador também pode).</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {dados.pessoas.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded border border-gray-200 p-2">
              <span className="min-w-32 flex-1">{p.nome}</span>
              <label className="flex items-center gap-1"><input type="checkbox" checked={c.operadores.includes(p.id)} onChange={() => set({ operadores: alternar(c.operadores, p.id) })} /> Operador</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={c.analistas.includes(p.id)} onChange={() => set({ analistas: alternar(c.analistas, p.id) })} /> Analista</label>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} grid gap-3 sm:grid-cols-3`}>
        <p className="font-semibold sm:col-span-3">Horários, SLA e limites</p>
        <div><label className={rotulo}>Atendimento: início</label><input type="time" className={input} value={c.horarioAtendimento.inicio} onChange={e => set({ horarioAtendimento: { ...c.horarioAtendimento, inicio: e.target.value } })} /></div>
        <div><label className={rotulo}>Atendimento: fim</label><input type="time" className={input} value={c.horarioAtendimento.fim} onChange={e => set({ horarioAtendimento: { ...c.horarioAtendimento, fim: e.target.value } })} /></div>
        <div><label className={rotulo}>Dias de atendimento</label>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">{["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <label key={i} className="flex items-center gap-0.5"><input type="checkbox" checked={c.horarioAtendimento.dias.includes(i)} onChange={() => set({ horarioAtendimento: { ...c.horarioAtendimento, dias: alternar(c.horarioAtendimento.dias, i).sort() } })} />{d}</label>
          ))}</div></div>
        <div><label className={rotulo}>Envio automático: início</label><input type="time" className={input} value={c.janelaEnvio.inicio} onChange={e => set({ janelaEnvio: { ...c.janelaEnvio, inicio: e.target.value } })} /></div>
        <div><label className={rotulo}>Envio automático: fim</label><input type="time" className={input} value={c.janelaEnvio.fim} onChange={e => set({ janelaEnvio: { ...c.janelaEnvio, fim: e.target.value } })} /></div>
        <div><label className={rotulo}>SLA 1ª resposta humana (min)</label><input type="number" className={input} value={c.slaMinutos} onChange={e => set({ slaMinutos: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Limite diário por número</label><input type="number" className={input} value={c.limiteDiarioPorNumero} onChange={e => set({ limiteDiarioPorNumero: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Intervalo mínimo entre envios (s)</label><input type="number" className={input} value={c.intervaloMinSeg} onChange={e => set({ intervaloMinSeg: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Intervalo máximo entre envios (s)</label><input type="number" className={input} value={c.intervaloMaxSeg} onChange={e => set({ intervaloMaxSeg: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Limite mensal de tokens da IA</label><input type="number" className={input} value={c.limiteMensalTokens} onChange={e => set({ limiteMensalTokens: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Modelo da IA</label><input className={input} value={c.modeloIA} onChange={e => set({ modeloIA: e.target.value })} /></div>
        <div><label className={rotulo}>Confiança mínima da IA (0–1)</label><input type="number" step="0.05" className={input} value={c.limiarConfianca} onChange={e => set({ limiarConfianca: n(e.target.value) })} /></div>
        <div><label className={rotulo}>Lembretes de documentos (dias)</label><input className={input} value={lembretes} onChange={e => setLembretes(e.target.value)} placeholder="1, 3, 7" /></div>
        <div><label className={rotulo}>Checklist padrão</label>
          <select className={select} value={c.checklistPadraoId ?? ""} onChange={e => set({ checklistPadraoId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Nenhum</option>{checklists?.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select></div>
        <div><label className={rotulo}>Número dos links de campanha</label><input className={input} value={c.numeroCampanhas} placeholder={dados.numeroConexao ?? "número conectado"} onChange={e => set({ numeroCampanhas: e.target.value })} /></div>
      </div>

      <div className={`${card} space-y-3 text-sm`}>
        <p className="font-semibold">Entradas, Logyca e IA</p>
        <p className="text-gray-600">Site: POST <code>/api/central-vendas/entrada/site</code> · Logyca (bloco HTTP Request): POST <code>/api/central-vendas/entrada/logyca</code>, ambos com <code>Authorization: Bearer &lt;token&gt;</code>.</p>
        <div className="flex flex-wrap gap-2">
          {(["tokenSite", "tokenLogycaEntrada"] as const).map(t => (
            <button key={t} type="button" className={btnSec} onClick={async () => { const r = await rodar(gerarTokenCentralVendas(t)); if (r) { setToken(r.token); recarregar(); setC(null); } }}>
              {c.segredosDefinidos[t] ? "Trocar" : "Gerar"} token {t === "tokenSite" ? "do site" : "de entrada da Logyca"}
            </button>
          ))}
        </div>
        {token && <p className="break-all rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">Copie agora (não será mostrado de novo): <code>{token}</code></p>}
        <Interruptor marcado={c.logyca.ativo} mudar={v => set({ logyca: { ...c.logyca, ativo: v } })} texto="Adaptador Logyca ligado" />
        <Interruptor marcado={c.logyca.usarParaEnvio} mudar={v => set({ logyca: { ...c.logyca, usarParaEnvio: v } })} texto="Enviar mensagens pela Logyca (em vez da conexão QR code)" />
        <div><label className={rotulo}>Endpoint de envio (menu &quot;Mensagens API&quot; da Logyca)</label><input className={input} value={c.logyca.endpointEnvio} onChange={e => set({ logyca: { ...c.logyca, endpointEnvio: e.target.value } })} /></div>
        {(["tokenLogycaEnvio", "chaveAnthropic"] as const).map(t => (
          <div key={t} className="flex flex-wrap items-end gap-2">
            <div className="flex-1"><label className={rotulo}>{t === "tokenLogycaEnvio" ? "Token de envio da Logyca" : "Chave própria da IA (opcional; sem ela usa ANTHROPIC_API_KEY)"} {c.segredosDefinidos[t] ? "· definido" : "· não definido"}</label>
              <input type="password" autoComplete="off" className={input} value={segredos[t]} onChange={e => setSegredos({ ...segredos, [t]: e.target.value })} /></div>
            <button type="button" className={btnSec} onClick={async () => { if (await rodar(definirSegredoCentralVendas(t, segredos[t]), "Guardado no cofre.")) { setSegredos({ ...segredos, [t]: "" }); recarregar(); setC(null); } }}>{segredos[t] ? "Guardar" : "Remover"}</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={gravar}><Save className="h-4 w-4" />Salvar configurações</button>
        <button type="button" className={btnSec} onClick={() => rodar(executarRotinaAgoraCentralVendas(), "Rotina executada.")}><RefreshCw className="h-4 w-4" />Executar rotina agora</button>
      </div>
    </div>
  );
}

type ProdutoForm = { id?: number; nome: string; slug: string; tipo: "empreendimento" | "produto"; descricao: string; cidade: string; precoMin: string; precoMax: string; requisitos: string; condicoes: string; checklistId: string; ativo: boolean };
const produtoVazio: ProdutoForm = { nome: "", slug: "", tipo: "empreendimento", descricao: "", cidade: "", precoMin: "", precoMax: "", requisitos: "", condicoes: "", checklistId: "", ativo: true };

function Produtos() {
  const { dados, recarregar } = useDados(() => produtosCentralVendas());
  const { dados: checklists } = useDados(() => checklistsCentralVendas());
  const [f, setF] = useState<ProdutoForm | null>(null);
  const valor = (v: string) => (v.trim() ? Number(v.replace(/\./g, "").replace(",", ".")) : null);
  async function gravar() {
    if (!f) return;
    const r = await rodar(salvarProdutoCentralVendas({ ...f, cidade: f.cidade || null, precoMin: valor(f.precoMin), precoMax: valor(f.precoMax), checklistId: f.checklistId ? Number(f.checklistId) : null }), "Produto salvo.");
    if (r) { setF(null); recarregar(); }
  }
  const area = (k: "descricao" | "requisitos" | "condicoes", t: string) => f && (
    <div className="sm:col-span-2"><label className={rotulo}>{t}</label><textarea className={input} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">A IA só fala o que estiver cadastrado aqui. Condições comerciais (parcelas, entrada etc.) só podem ser citadas se estiverem escritas no campo &quot;Condições&quot;.</p>
      <button type="button" className={btn} onClick={() => setF(produtoVazio)}><Plus className="h-4 w-4" />Novo</button>
      {f && (
        <div className={`${card} grid gap-3 sm:grid-cols-2`}>
          <div><label className={rotulo}>Nome</label><input className={input} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          <div><label className={rotulo}>Código (usado nos links [ref:...])</label><input className={input} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} /></div>
          <div><label className={rotulo}>Tipo</label><select className={select} value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as ProdutoForm["tipo"] })}><option value="empreendimento">Empreendimento</option><option value="produto">Produto/modalidade</option></select></div>
          <div><label className={rotulo}>Cidade</label><input className={input} value={f.cidade} onChange={e => setF({ ...f, cidade: e.target.value })} /></div>
          <div><label className={rotulo}>Preço mínimo (R$)</label><input className={input} value={f.precoMin} onChange={e => setF({ ...f, precoMin: e.target.value })} /></div>
          <div><label className={rotulo}>Preço máximo (R$)</label><input className={input} value={f.precoMax} onChange={e => setF({ ...f, precoMax: e.target.value })} /></div>
          {area("descricao", "Descrição")}{area("requisitos", "Requisitos")}{area("condicoes", "Condições comerciais cadastradas")}
          <div><label className={rotulo}>Checklist de documentos</label><select className={select} value={f.checklistId} onChange={e => setF({ ...f, checklistId: e.target.value })}><option value="">Padrão da Central</option>{checklists?.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}</select></div>
          <Interruptor marcado={f.ativo} mudar={v => setF({ ...f, ativo: v })} texto="Ativo" />
          <div className="flex gap-2 sm:col-span-2"><button type="button" className={btn} onClick={gravar}>Salvar</button><button type="button" className={btnSec} onClick={() => setF(null)}>Cancelar</button></div>
        </div>
      )}
      {dados?.map(p => (
        <div key={p.id} className={`${card} flex flex-wrap items-center justify-between gap-2 text-sm`}>
          <span><b>{p.nome}</b> <span className="text-gray-500">({p.slug}{p.cidade ? `, ${p.cidade}` : ""}){p.ativo ? "" : " · inativo"}</span></span>
          <button type="button" className={btnSec} onClick={() => setF({ id: p.id, nome: p.nome, slug: p.slug, tipo: p.tipo as ProdutoForm["tipo"], descricao: p.descricao, cidade: p.cidade ?? "", precoMin: p.precoMin != null ? String(p.precoMin) : "", precoMax: p.precoMax != null ? String(p.precoMax) : "", requisitos: p.requisitos, condicoes: p.condicoes, checklistId: p.checklistId ? String(p.checklistId) : "", ativo: p.ativo })}>Editar</button>
        </div>
      ))}
    </div>
  );
}

function Checklists() {
  const { dados, recarregar } = useDados(() => checklistsCentralVendas());
  const [f, setF] = useState<{ id?: number; nome: string; itens: ItemChecklist[]; ativo: boolean } | null>(null);
  const novoItem = (): ItemChecklist => ({ chave: "", nome: "", tipo: "other", obrigatorio: true });
  async function gravar() {
    if (!f) return;
    if (await rodar(salvarChecklistCentralVendas(f), "Checklist salvo.")) { setF(null); recarregar(); }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Documentos por produto ou modalidade (ex.: MCMV, ATC, SBPE). Nenhum documento é fixo no sistema: tudo vem daqui. O &quot;tipo no CRM&quot; é o item do checklist de documentos do lead que recebe o arquivo.</p>
      <button type="button" className={btn} onClick={() => setF({ nome: "", itens: [novoItem()], ativo: true })}><Plus className="h-4 w-4" />Novo checklist</button>
      {f && (
        <div className={`${card} space-y-3`}>
          <div><label className={rotulo}>Nome</label><input className={input} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          {f.itens.map((it, i) => {
            const mudar = (p: Partial<ItemChecklist>) => setF({ ...f, itens: f.itens.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div><label className={rotulo}>Chave</label><input className={`${input} w-32`} value={it.chave} onChange={e => mudar({ chave: e.target.value.toLowerCase() })} /></div>
                <div className="flex-1"><label className={rotulo}>Nome para o cliente</label><input className={input} value={it.nome} onChange={e => mudar({ nome: e.target.value })} /></div>
                <div><label className={rotulo}>Tipo no CRM</label><select className={select} value={it.tipo} onChange={e => mudar({ tipo: e.target.value as ItemChecklist["tipo"] })}>{TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.obrigatorio} onChange={e => mudar({ obrigatorio: e.target.checked })} /> Obrigatório</label>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setF({ ...f, itens: f.itens.filter((_, j) => j !== i) })}>Remover</button>
              </div>
            );
          })}
          <button type="button" className={btnSec} onClick={() => setF({ ...f, itens: [...f.itens, novoItem()] })}><Plus className="h-4 w-4" />Documento</button>
          <Interruptor marcado={f.ativo} mudar={v => setF({ ...f, ativo: v })} texto="Ativo" />
          <div className="flex gap-2"><button type="button" className={btn} onClick={gravar}>Salvar</button><button type="button" className={btnSec} onClick={() => setF(null)}>Cancelar</button></div>
        </div>
      )}
      {dados?.map(k => (
        <div key={k.id} className={`${card} flex flex-wrap items-center justify-between gap-2 text-sm`}>
          <span><b>{k.nome}</b> <span className="text-gray-500">· {k.itens.length} documento(s){k.ativo ? "" : " · inativo"}</span></span>
          <button type="button" className={btnSec} onClick={() => setF({ id: k.id, nome: k.nome, itens: k.itens, ativo: k.ativo })}>Editar</button>
        </div>
      ))}
    </div>
  );
}

function Sequencias() {
  const { dados, recarregar } = useDados(() => sequenciasCentralVendas());
  const { dados: templates } = useDados(() => templatesCentralVendas());
  const [f, setF] = useState<{ id?: number; tipo: TipoSequencia; nome: string; passos: PassoSequencia[]; ativo: boolean } | null>(null);
  async function gravar() {
    if (!f) return;
    if (await rodar(salvarSequenciaCentralVendas(f), "Sequência salva.")) { setF(null); recarregar(); }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Envios só entre o horário de envio configurado, respeitando opt-out (SAIR/PARAR), limite diário e modo de teste.</p>
      <button type="button" className={btn} onClick={() => setF({ tipo: "reativacao", nome: "", passos: [{ aposDias: 30, templateSlug: "cv-reativacao" }], ativo: true })}><Plus className="h-4 w-4" />Nova sequência</button>
      {f && (
        <div className={`${card} space-y-3`}>
          <div className="flex flex-wrap gap-3">
            <div><label className={rotulo}>Tipo</label><select className={select} value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as TipoSequencia })}>{TIPOS_SEQUENCIA.map(t => <option key={t} value={t}>{ROTULOS_SEQUENCIA[t]}</option>)}</select></div>
            <div className="flex-1"><label className={rotulo}>Nome</label><input className={input} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          </div>
          {f.passos.map((p, i) => {
            const mudar = (x: Partial<PassoSequencia>) => setF({ ...f, passos: f.passos.map((y, j) => (j === i ? { ...y, ...x } : y)) });
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div><label className={rotulo}>Após (dias)</label><input type="number" className={`${input} w-24`} value={p.aposDias} onChange={e => mudar({ aposDias: Number(e.target.value) })} /></div>
                <div><label className={rotulo}>Template</label><select className={select} value={p.templateSlug} onChange={e => mudar({ templateSlug: e.target.value })}>{templates?.map(t => <option key={t.slug} value={t.slug}>{t.nome}</option>)}</select></div>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setF({ ...f, passos: f.passos.filter((_, j) => j !== i) })}>Remover</button>
              </div>
            );
          })}
          <button type="button" className={btnSec} onClick={() => setF({ ...f, passos: [...f.passos, { aposDias: 1, templateSlug: "cv-sem-resposta" }] })}><Plus className="h-4 w-4" />Passo</button>
          <Interruptor marcado={f.ativo} mudar={v => setF({ ...f, ativo: v })} texto="Ativa" />
          <div className="flex gap-2"><button type="button" className={btn} onClick={gravar}>Salvar</button><button type="button" className={btnSec} onClick={() => setF(null)}>Cancelar</button></div>
        </div>
      )}
      {dados?.map(s => (
        <div key={s.id} className={`${card} flex flex-wrap items-center justify-between gap-2 text-sm`}>
          <span><b>{s.nome}</b> <span className="text-gray-500">· {ROTULOS_SEQUENCIA[s.tipo as TipoSequencia] ?? s.tipo} · {s.passosLista.map(p => `D+${p.aposDias}`).join(", ")}{s.ativo ? "" : " · inativa"}</span></span>
          <button type="button" className={btnSec} onClick={() => setF({ id: s.id, tipo: s.tipo as TipoSequencia, nome: s.nome, passos: s.passosLista, ativo: s.ativo })}>Editar</button>
        </div>
      ))}
    </div>
  );
}

function Campanhas() {
  const { dados, recarregar } = useDados(() => campanhasCentralVendas());
  const { dados: produtos } = useDados(() => produtosCentralVendas());
  const [f, setF] = useState({ canal: "instagram", nome: "", produtoId: "" });
  async function gravar() {
    const r = await rodar(criarCampanhaCentralVendas({ canal: f.canal, nome: f.nome || f.canal, produtoId: f.produtoId ? Number(f.produtoId) : null }));
    if (r) { toast.success(`Campanha ${r.codigo} criada.`); recarregar(); }
  }
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <div><label className={rotulo}>Canal</label><input className={input} value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} /></div>
        <div><label className={rotulo}>Nome</label><input className={input} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
        <div><label className={rotulo}>Empreendimento/produto</label><select className={select} value={f.produtoId} onChange={e => setF({ ...f, produtoId: e.target.value })}><option value="">Nenhum</option>{produtos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <button type="button" className={btn} onClick={gravar}>Gerar link</button>
      </div>
      {dados && !dados.numero && <p className="text-sm text-amber-700">Conecte o WhatsApp (QR code) ou informe o número dos links em Configurações para gerar os links.</p>}
      {dados?.campanhas.map(k => (
        <div key={k.id} className={`${card} space-y-1 text-sm`}>
          <p><b>{k.nome}</b> <span className="text-gray-500">· {k.canal} · [ref:{k.codigo}]</span></p>
          {k.link && <div className="flex flex-wrap items-center gap-2"><code className="break-all text-xs text-gray-600">{k.link}</code>
            <button type="button" className={btnSec} onClick={() => { void navigator.clipboard?.writeText(k.link!); toast.success("Link copiado."); }}>Copiar</button></div>}
        </div>
      ))}
    </div>
  );
}

function Templates() {
  const { dados, recarregar } = useDados(() => templatesCentralVendas());
  const [edit, setEdit] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Textos automáticos (guardados nos templates do WhatsApp). Variáveis: {"{{nome}}"} (primeiro nome), {"{{documentos}}"} (pendentes ou pendências do analista), {"{{corretor}}"} (operador).</p>
      {dados?.map(t => (
        <div key={t.slug} className={`${card} space-y-2 text-sm`}>
          <p><b>{t.nome}</b> <span className="text-gray-500">· {t.slug}{t.personalizado ? " · personalizado" : " · padrão"}</span></p>
          <textarea className={input} rows={3} value={edit[t.slug] ?? t.conteudo} onChange={e => setEdit({ ...edit, [t.slug]: e.target.value })} />
          {edit[t.slug] !== undefined && edit[t.slug] !== t.conteudo && (
            <button type="button" className={btn} onClick={async () => { if (await rodar(salvarTemplateCentralVendas({ slug: t.slug, conteudo: edit[t.slug] }), "Template salvo.")) recarregar(); }}>Salvar</button>
          )}
        </div>
      ))}
    </div>
  );
}

function Auditoria() {
  const { dados, recarregar } = useDados(() => auditoriaCentralVendas());
  const data = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${card} space-y-1 text-xs`}>
        <p className="mb-2 text-sm font-semibold">Fila de envio e reprocessamento</p>
        {dados?.fila.length ? dados.fila.map(j => (
          <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-1">
            <span>#{j.id} {j.tipo}{j.proativa ? " (proativa)" : ""} · lead {j.leadId ?? "—"} · {j.status} · {j.tentativas} tentativa(s){j.ultimoErro ? ` · ${j.ultimoErro}` : ""}</span>
            {(j.status === "falhou" || j.status === "incerto") && (
              <button type="button" className={btnSec} onClick={async () => {
                if (j.status === "incerto" && !window.confirm("Este envio pode já ter saído. Reenviar mesmo assim?")) return;
                if (await rodar(reprocessarCentralVendas(j.id))) recarregar();
              }}>Reprocessar</button>
            )}
          </div>
        )) : <p className="text-gray-400">{SEM}</p>}
      </div>
      <div className={`${card} space-y-1 text-xs`}>
        <p className="mb-2 text-sm font-semibold">Eventos (auditoria)</p>
        {dados?.eventos.length ? dados.eventos.map(e => (
          <div key={e.id} className="border-b border-gray-100 py-1">
            <span className="text-gray-500">{data(e.criadoEm)}</span> · <b>{e.tipo}</b> · lead {e.leadId ?? "—"} · {e.origem} · {e.resultado}{e.erro ? ` · ${e.erro}` : ""}
          </div>
        )) : <p className="text-gray-400">{SEM}</p>}
      </div>
    </div>
  );
}
