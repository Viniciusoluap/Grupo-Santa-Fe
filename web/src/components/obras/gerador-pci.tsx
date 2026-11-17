"use client";
// Lote 2, correção 03 (AD-06): aba "Gerador de PCI" do Editar Obra.
// Formulário por seções, pré-preenchido com os dados da obra/cliente/PCI vinculada,
// rascunho, geração da planilha (modelo oficial atual) + PDF e histórico com
// download das duas versões. Regras em @/lib/pci-gerador; banco em
// @/lib/obras/pci-gerador-dados. Gêmeo de Prospecta/client/src/components/obra/GeradorPciAba.tsx.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, FilePlus, FileSpreadsheet, History, Library, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  engenheiroPciAcao, excluirModeloPreenchimentoPciAcao, gerarPci, historicoModeloPreenchimentoPciAcao, listarModelosPreenchimentoPciAcao,
  obterGeradorPci, obterModeloPreenchimentoPciAcao, salvarModeloPreenchimentoPciAcao, salvarRascunhoGeradorPci, sugestoesAutomaticasPciAcao,
} from "@/lib/actions/pci-gerador";
import type { DadosGeradorPci } from "@/lib/obras/pci-gerador-dados";
import { NumeroInput } from "@/components/ui/numero-input";
import { comprimirImagem } from "@/lib/obras/comprimir-imagem";
import { baixarArquivoEmPartes } from "@/lib/obras/pci-gerador-arquivos";
import {
  CAMPOS_PCI,
  LIMITE_IMAGEM_PCI_BYTES,
  MAX_ETAPAS_PCI,
  SECOES_PCI,
  SERVICOS_CUSTO_PCI,
  SERVICO_OUTROS_PCI,
  analisarCronogramaPci,
  aplicarEngenheiroPci,
  aplicarEscolhasPci,
  calcularTotaisPci,
  camposTrocadosPorEngenheiroPci,
  compararPreenchimentoPci,
  ORIGEM_CONFIRMADA_PCI,
  confirmarMesmaPessoaPci,
  definirCampoPci,
  errosPci,
  formularioPciVazio,
  misturaPessoaPci,
  numeroPci,
  pendenciasPci,
  sugestoesDoModeloPci,
  type CampoPci,
  type FormularioPci,
  type PessoaPci,
  type ResultadoPreenchimentoPci,
  type SecaoPci,
} from "@/lib/pci-gerador";

const campoCls = "w-full border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-[var(--brand-dark)] focus:outline-none focus:border-[var(--brand-yellow)]";
const rotuloCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";
const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";
const brl = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type Engenheiro = DadosGeradorPci["engenheiros"][number];

function Campo({ campo, valor, onChange }: { campo: CampoPci; valor: string | number | null; onChange: (v: string | number | null) => void }) {
  const id = `pci-${campo.id}`;
  let controle;
  if (campo.tipo === "lista") {
    // Lote 03, correção 07: lista do modelo oficial — grava a opção exata, mostra sem espaços nas pontas.
    const opcoes = campo.opcoes ?? [];
    const foraDaLista = valor !== null && valor !== "" && !opcoes.includes(String(valor));
    controle = (
      <select id={id} value={valor === null ? "" : String(valor)} onChange={(e) => onChange(e.target.value || null)} aria-invalid={foraDaLista || undefined}
        className={`${campoCls} ${foraDaLista ? "border-red-400" : ""}`}>
        <option value="">— selecione —</option>
        {foraDaLista && <option value={String(valor)} disabled>{String(valor)} (fora da lista oficial)</option>}
        {opcoes.map((o) => <option key={o} value={o}>{o.trim()}</option>)}
      </select>
    );
  } else if (campo.tipo === "numero" || campo.tipo === "inteiro") {
    controle = <NumeroInput id={id} value={numeroPci(valor)} onChange={onChange} casas={campo.tipo === "inteiro" ? 0 : 2} negativo={false} className={campoCls} />;
  } else if (campo.tipo === "data") {
    controle = <input id={id} type="date" value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(e.target.value || null)} className={campoCls} />;
  } else {
    const placeholder = campo.tipo === "coordenada" ? (campo.id === "latitude" ? `05° 29' 18" S` : `47° 28' 30" W`) : campo.tipo === "cep" ? "00000-000" : undefined;
    controle = <input id={id} value={valor === null ? "" : String(valor)} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={campoCls} />;
  }
  return (
    <div className={campo.largo ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className={rotuloCls}>{campo.rotulo}{campo.celula ? <span className="ml-1 normal-case text-[10px] text-gray-400">({campo.celula})</span> : null}</label>
      {controle}
    </div>
  );
}

/**
 * Paridade 17/11 (Prospecta EPIC-024 S-09): escolher o engenheiro busca no servidor os dados do perfil DELE (com
 * CPF — a lista não leva CPF) e preenche nome, CPF, e-mail, telefone, CREA e UF. Campos já preenchidos com outro
 * valor só trocam com confirmação. O mesmo profissional pode ser RTP e RTE.
 */
function SeletorEngenheiro({ papel, obraId, form, setForm, engenheiros }: { papel: "rtp" | "rte"; obraId: string; form: FormularioPci; setForm: (f: FormularioPci) => void; engenheiros: Engenheiro[] }) {
  const [buscando, setBuscando] = useState(false);
  const atual = papel === "rtp" ? form.rtpEngenheiroId : form.rteEngenheiroId;
  const sigla = papel === "rtp" ? "RTP" : "RTE";

  async function escolher(id: string) {
    if (!id) { setForm(aplicarEngenheiroPci(form, papel, null, null)); return; }
    setBuscando(true);
    try {
      const r = await engenheiroPciAcao(obraId, id);
      if ("erro" in r) { toast.error(r.erro); return; }
      const eng = r.engenheiro;
      const trocados = camposTrocadosPorEngenheiroPci(form, papel, eng);
      if (trocados.length && !confirm(`Os campos do ${sigla} já preenchidos serão trocados pelos dados do perfil de ${eng.nome ?? "engenheiro"}: ${trocados.join(", ")}. Continuar?`)) return;
      setForm(aplicarEngenheiroPci(form, papel, eng.id, eng));
      for (const a of eng.avisos) toast.warning(a, { duration: 10000 });
      if (!eng.avisos.length) toast.success(`${sigla}: dados de ${eng.nome ?? "engenheiro"} preenchidos pelo perfil (nome, CPF, e-mail, telefone, CREA e UF).`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBuscando(false); }
  }

  return (
    <div className="sm:col-span-2">
      <label htmlFor={`pci-eng-${papel}`} className={rotuloCls}>Selecionar engenheiro (preenche nome, CPF, e-mail, telefone, CREA e UF do perfil)</label>
      <div className="flex flex-wrap items-center gap-2">
        <select id={`pci-eng-${papel}`} value={atual ?? ""} disabled={buscando} className={`${campoCls} min-w-0 flex-1`}
          onChange={(e) => void escolher(e.target.value)}>
          <option value="">— digitar manualmente —</option>
          {engenheiros.map((e) => <option key={e.id} value={e.id}>{e.nome || e.email}{e.crea ? ` — CREA${e.creaUf ? `-${e.creaUf}` : ""} ${e.crea}` : e.engenheiro ? " — sem CREA" : ""}</option>)}
        </select>
        {buscando && <Loader2 size={16} className="animate-spin text-gray-500" aria-label="Buscando o perfil do engenheiro" />}
        {papel === "rte" && form.rtpEngenheiroId && form.rtpEngenheiroId !== atual && (
          <button type="button" className={botaoSec} disabled={buscando} onClick={() => void escolher(form.rtpEngenheiroId!)}>Mesmo profissional do RTP</button>
        )}
      </div>
    </div>
  );
}

type PainelResultado = Omit<ResultadoPreenchimentoPci, "formulario"> & { titulo: string };
type EscolhasPainel = Parameters<typeof aplicarEscolhasPci>[1];

/**
 * Paridade 17/11 (S-09): o que "Dados automáticos", a abertura ou o modelo fez — preencheu, igual, conflito,
 * faltou. Pessoa (proponente, RTP, RTE) é escolhida INTEIRA (manter ou trocar por uma opção), nunca campo a campo;
 * campos técnicos/do imóvel seguem com escolha por campo. `aplicarEscolhasPci` não deixa pessoa misturada.
 */
function ResultadoPreenchimento({ r, onAplicar, onFechar }: { r: PainelResultado; onAplicar: (e: EscolhasPainel, resolvidos: { conflitos: string[]; pessoas: PessoaPci[] }) => void; onFechar: () => void }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [escolhaPessoa, setEscolhaPessoa] = useState<Partial<Record<PessoaPci, string>>>({});
  const alternar = (chave: string) => setMarcados((m) => { const n = new Set(m); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });
  const pendentes = r.conflitos.length + r.pessoas.length;

  function aplicar(todosOsCampos: boolean) {
    const conflitos = todosOsCampos ? r.conflitos : r.conflitos.filter((c) => marcados.has(c.chave));
    const pessoas: NonNullable<EscolhasPainel["pessoas"]> = {};
    const resolvidas: PessoaPci[] = [];
    for (const e of r.pessoas) {
      const id = escolhaPessoa[e.pessoa];
      if (!id) continue;
      resolvidas.push(e.pessoa);
      pessoas[e.pessoa] = id === "manter" ? null : e.opcoes.find((o) => o.id === id) ?? null;
    }
    onAplicar({ conflitos, pessoas }, { conflitos: conflitos.map((c) => c.chave), pessoas: resolvidas });
  }

  return (
    <div role="status" className="space-y-2 border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold text-[var(--brand-dark)]">{r.titulo}: {r.preenchidos.length} campo(s) preenchido(s), {r.pessoas.length} pessoa(s) para escolher, {r.conflitos.length} campo(s) diferente(s), {r.iguais.length} já igual(is), {r.naoEncontrados.length} não encontrado(s).</p>
        <button type="button" className={botaoSec} onClick={onFechar}>Fechar</button>
      </div>
      {r.preenchidos.length > 0 && (
        <details open>
          <summary className="cursor-pointer font-bold">Preenchidos agora (estavam vazios)</summary>
          <ul className="ml-5 mt-1 list-disc">{r.preenchidos.map((p) => <li key={p.chave}><b>{p.rotulo}</b>: {p.valor} <span className="text-gray-500">— {p.fonte}</span></li>)}</ul>
        </details>
      )}
      {r.pessoas.map((e) => (
        <fieldset key={e.pessoa} className="border border-amber-300 bg-amber-50 p-2">
          <legend className="px-1 font-bold text-amber-900">{e.rotulo} — escolha quem é (a pessoa inteira; nada foi trocado)</legend>
          <p className="text-xs text-amber-900">{e.motivo}</p>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name={`pessoa-${e.pessoa}`} className="mt-1" checked={escolhaPessoa[e.pessoa] === "manter"} onChange={() => setEscolhaPessoa((s) => ({ ...s, [e.pessoa]: "manter" }))} />
            <span>{e.atualVazio ? "Deixar em branco (digitar depois)" : <>Manter o que está na tela: {e.atual}</>}</span>
          </label>
          {e.opcoes.map((o) => (
            <label key={o.id} className="mt-1 flex items-start gap-2">
              <input type="radio" name={`pessoa-${e.pessoa}`} className="mt-1" checked={escolhaPessoa[e.pessoa] === o.id} onChange={() => setEscolhaPessoa((s) => ({ ...s, [e.pessoa]: o.id }))} />
              <span>Usar {o.resumo} <span className="text-gray-500">— {o.fonte}</span>
                {o.origem === ORIGEM_CONFIRMADA_PCI && <span className="block text-xs text-amber-800">Junta duas fontes: escolher esta opção vale como sua confirmação de que é a mesma pessoa (fica registrado quem confirmou e quando).</span>}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      {r.conflitos.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 p-2">
          <p className="font-bold text-amber-900">Campos já preenchidos com outro valor — nada foi trocado. Marque o que deve ser substituído:</p>
          <ul className="mt-1 space-y-1">
            {r.conflitos.map((c) => (
              <li key={c.chave}>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={marcados.has(c.chave)} onChange={() => alternar(c.chave)} />
                  <span><b>{c.rotulo}</b>: atual &quot;{c.atual}&quot; → sugerido &quot;{c.sugerido}&quot; <span className="text-gray-500">— {c.fonte}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pendentes > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoSec} disabled={!marcados.size && !Object.keys(escolhaPessoa).length} onClick={() => aplicar(false)}>Aplicar as escolhas</button>
          {r.conflitos.length > 0 && <button type="button" className={botaoSec} onClick={() => { if (confirm(`Substituir os ${r.conflitos.length} campo(s) diferentes pelos valores sugeridos? (As pessoas seguem a escolha acima.)`)) aplicar(true); }}>Substituir todos os campos diferentes</button>}
        </div>
      )}
      {r.avisos.length > 0 && <ul className="ml-5 list-disc text-xs text-gray-600">{r.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
      {r.naoEncontrados.length > 0 && (
        <details>
          <summary className="cursor-pointer font-bold">Não encontrados ({r.naoEncontrados.length})</summary>
          <ul className="ml-5 mt-1 list-disc">{r.naoEncontrados.map((a) => <li key={a.chave}><b>{a.rotulo}</b>: {a.motivo}</li>)}</ul>
        </details>
      )}
      {r.iguais.length > 0 && (
        <details>
          <summary className="cursor-pointer">Já estavam iguais ({r.iguais.length})</summary>
          <ul className="ml-5 mt-1 list-disc">{r.iguais.map((p) => <li key={p.chave}>{p.rotulo} <span className="text-gray-500">— {p.fonte}</span></li>)}</ul>
        </details>
      )}
    </div>
  );
}

type ModeloResumo = Extract<Awaited<ReturnType<typeof listarModelosPreenchimentoPciAcao>>, { modelos: unknown }>["modelos"][number];

/**
 * Paridade 17/11 (S-09): biblioteca de modelos de preenchimento. O modelo leva só os dados técnicos (lista de
 * permissão em @/lib/pci-gerador); os dados pessoais desta obra ficam como estão.
 */
function ModelosPreenchimento({ obraId, form, setForm, mostrar }: { obraId: string; form: FormularioPci; setForm: (f: FormularioPci) => void; mostrar: (r: PainelResultado) => void }) {
  const [modelos, setModelos] = useState<ModeloResumo[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<ModeloResumo[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const atual = (modelos ?? []).find((m) => m.id === selecionado) ?? null;

  const recarregar = useCallback(async () => {
    const r = await listarModelosPreenchimentoPciAcao();
    if ("erro" in r) { setErroLista(r.erro ?? "Erro ao listar os modelos."); return; }
    setErroLista(null);
    setModelos(r.modelos);
  }, []);
  useEffect(() => {
    let vivo = true;
    listarModelosPreenchimentoPciAcao().then((r) => {
      if (!vivo) return;
      if ("erro" in r) setErroLista(r.erro ?? "Erro ao listar os modelos.");
      else setModelos(r.modelos);
    });
    return () => { vivo = false; };
  }, []);

  async function aplicar(id: string) {
    setOcupado(true);
    try {
      const r = await obterModeloPreenchimentoPciAcao(id);
      if ("erro" in r) { toast.error(r.erro); return; }
      const m = r.modelo;
      const fonte = `Modelo "${m.nome}" v${m.versao}`;
      const c = compararPreenchimentoPci(form, sugestoesDoModeloPci(m.dados, fonte));
      setForm({ ...c.formulario, modeloOrigem: { id: m.id, nome: m.nome, versao: m.versao } });
      mostrar({ ...c, titulo: `${fonte} aplicado (só dados técnicos; os dados pessoais desta obra não mudam)` });
    } finally { setOcupado(false); }
  }

  async function verVersoes() {
    if (versoes) { setVersoes(null); return; }
    if (!atual) return;
    const r = await historicoModeloPreenchimentoPciAcao(atual.id);
    if ("erro" in r) { toast.error(r.erro); return; }
    setVersoes(r.versoes);
  }

  async function salvarModelo(novaVersao: boolean) {
    const nome = novaVersao && atual ? atual.nome : prompt("Nome do modelo (ex.: Casa padrão 70 m²). Só os dados técnicos são guardados — nunca CPF, nomes, endereço, matrícula ou coordenadas.")?.trim();
    if (!nome) return;
    if (novaVersao && atual && !confirm(`Salvar os dados técnicos desta obra como a versão ${atual.versao + 1} de "${atual.nome}"? A versão ${atual.versao} continua guardada no histórico.`)) return;
    setOcupado(true);
    try {
      const r = await salvarModeloPreenchimentoPciAcao({ obraId, nome, formulario: form, novaVersaoDe: novaVersao && atual ? atual.id : null });
      if ("erro" in r) { toast.error(r.erro); return; }
      toast.success(`Modelo "${r.nome}" v${r.versao} salvo (só dados técnicos).`);
      for (const a of r.avisos) toast.warning(a, { duration: 12000 });
      await recarregar();
      setSelecionado(r.id);
      setVersoes(null);
    } finally { setOcupado(false); }
  }

  async function excluirModelo() {
    if (!atual || !confirm(`Excluir o modelo "${atual.nome}" (todas as versões)? As obras que já usaram o modelo não mudam.`)) return;
    setOcupado(true);
    try {
      const r = await excluirModeloPreenchimentoPciAcao(atual.id, true);
      if ("erro" in r) { toast.error(r.erro); return; }
      toast.success("Modelo excluído.");
      setSelecionado(null);
      setVersoes(null);
      await recarregar();
    } finally { setOcupado(false); }
  }

  const lista = modelos ?? [];
  return (
    <details className="border border-gray-200 bg-gray-50/50 p-3">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">Modelos de preenchimento {lista.length ? `(${lista.length})` : ""}</summary>
      <div className="mt-3 space-y-2 text-sm text-gray-800">
        <p className="text-xs text-gray-600">Um modelo guarda só os dados técnicos de um projeto padrão (memorial, sistema construtivo, áreas da casa, executor/BDI, custos e cronograma). Proponente, RT, endereço, matrícula, coordenadas, valores do terreno e do imóvel e a imagem nunca vão para o modelo. Ao aplicar, campos já preenchidos com outro valor só trocam com confirmação.</p>
        {form.modeloOrigem && <p className="text-xs text-gray-600">Esta obra usou o modelo &quot;{form.modeloOrigem.nome}&quot; v{form.modeloOrigem.versao}.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pci-modelo-preenchimento" className="sr-only">Modelo de preenchimento</label>
          <select id="pci-modelo-preenchimento" value={selecionado ?? ""} onChange={(e) => { setSelecionado(e.target.value || null); setVersoes(null); }} className={`${campoCls} min-w-0 flex-1`}>
            <option value="">{modelos === null && !erroLista ? "Carregando…" : lista.length ? "— escolha um modelo —" : "Nenhum modelo salvo"}</option>
            {lista.map((m) => <option key={m.id} value={m.id}>{m.nome} — v{m.versao} ({m.resumo})</option>)}
          </select>
          <button type="button" className={botaoSec} disabled={!atual || ocupado} onClick={() => atual && void aplicar(atual.id)}>
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Library size={14} />} Aplicar modelo
          </button>
          <button type="button" className={botaoSec} disabled={!atual} onClick={() => void verVersoes()}><History size={14} /> Versões</button>
          <button type="button" className={botaoSec} disabled={!atual || ocupado} onClick={() => void excluirModelo()} aria-label="Excluir modelo"><Trash2 size={14} /></button>
        </div>
        {erroLista && <p role="alert" className="text-red-700">{erroLista}</p>}
        {atual && <p className="text-xs text-gray-500">v{atual.versao} salva em {new Date(atual.criadoEm).toLocaleString("pt-BR")}{atual.autor ? ` por ${atual.autor}` : ""}{atual.obraOrigem ? `, a partir da obra "${atual.obraOrigem}"` : ""}.</p>}
        {versoes && atual && (
          <ul className="ml-5 list-disc text-xs">
            {versoes.map((v) => (
              <li key={v.id}>v{v.versao} — {new Date(v.criadoEm).toLocaleString("pt-BR")}{v.autor ? ` por ${v.autor}` : ""} ({v.resumo}){" "}
                <button type="button" className="underline" disabled={ocupado} onClick={() => void aplicar(v.id)}>aplicar esta versão</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoSec} disabled={ocupado} onClick={() => void salvarModelo(false)}><FilePlus size={14} /> Salvar como novo modelo</button>
          <button type="button" className={botaoSec} disabled={!atual || ocupado} onClick={() => void salvarModelo(true)}>Salvar como nova versão do modelo escolhido</button>
          <button type="button" className={botaoSec} onClick={() => { if (confirm("Começar em branco? Todos os campos desta tela serão limpos (o rascunho salvo só muda quando você salvar).")) setForm(formularioPciVazio()); }}>Começar em branco</button>
        </div>
      </div>
    </details>
  );
}

export function GeradorPci({ obraId }: { obraId: string }) {
  const [dados, setDados] = useState<DadosGeradorPci | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioPci | null>(null);
  const [ocupado, setOcupado] = useState<"salvar" | "gerar" | "auto" | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [painel, setPainel] = useState<PainelResultado | null>(null);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof obterGeradorPci>>, manterForm: boolean) => {
    if ("erro" in r) { setErro(r.erro ?? "Erro ao carregar."); return; }
    setErro(null);
    setDados(r.dados);
    if (!manterForm) {
      setForm(r.dados.formulario);
      // Paridade 17/11 (S-09): a abertura sem rascunho mostra as fontes e as escolhas de pessoa, como o botão.
      setPainel(r.dados.preenchimento ? { ...r.dados.preenchimento, titulo: "Pré-preenchimento automático" } : null);
    }
  }, []);
  const carregar = useCallback(async (manterForm: boolean) => aplicar(await obterGeradorPci(obraId), manterForm), [obraId, aplicar]);
  useEffect(() => {
    let vivo = true;
    obterGeradorPci(obraId).then((r) => { if (vivo) aplicar(r, false); });
    return () => { vivo = false; };
  }, [obraId, aplicar]);

  const totais = useMemo(() => (form ? calcularTotaisPci(form) : null), [form]);
  const pendencias = useMemo(() => (form ? pendenciasPci(form) : []), [form]);
  // Lote 03, correção 06: validação do cronograma durante a digitação (o servidor valida de novo).
  const cronograma = useMemo(() => (form ? analisarCronogramaPci(form) : null), [form]);
  const erros = useMemo(() => (form ? errosPci(form, { paraGerar: false }) : []), [form]);
  // Paridade 17/11 (S-09): nome e CPF de fontes diferentes bloqueiam a geração (o servidor confere de novo).
  const misturas = useMemo(() => (form ? misturaPessoaPci(form) : []), [form]);

  if (erro) return <div role="alert" className="text-sm text-red-700">{erro} <button type="button" className="underline" onClick={() => void carregar(false)}>Tentar novamente</button></div>;
  if (!dados || !form) return <p role="status" className="text-sm text-gray-600">Carregando o Gerador de PCI…</p>;
  const d = dados;

  const setCampo = (id: string, v: string | number | null) => setForm(definirCampoPci(form, id, v));
  const prazo = Math.min(Math.max(Math.round(numeroPci(form.campos.prazoMeses) ?? 0), 0), MAX_ETAPAS_PCI);

  async function salvarRascunho() {
    setOcupado("salvar");
    const r = await salvarRascunhoGeradorPci(obraId, form);
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    toast.success("Rascunho salvo.");
    await carregar(true);
  }

  // Paridade 17/11 (S-09): completa só o que está vazio e mostra fonte, conflitos/escolhas (com confirmação) e o que faltou.
  async function recarregarAutomatico() {
    if (!form) return;
    setOcupado("auto");
    const r = await sugestoesAutomaticasPciAcao(obraId, { rtpEngenheiroId: form.rtpEngenheiroId, rteEngenheiroId: form.rteEngenheiroId });
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    const c = compararPreenchimentoPci(form, r.sugestoes.sugestoes, r.sugestoes.ausencias);
    setForm(c.formulario);
    setPainel({ ...c, titulo: "Dados automáticos" });
    const pendentes = c.conflitos.length + c.pessoas.length;
    if (!c.preenchidos.length && !pendentes) toast.info("Dados automáticos: nada novo para preencher. Veja abaixo o que já estava igual e o que não foi encontrado.");
    else toast.success(`Dados automáticos: ${c.preenchidos.length} campo(s) preenchido(s)${pendentes ? `, ${pendentes} item(ns) aguardando sua escolha` : ""}. Confira e salve o rascunho.`);
  }

  function aplicarEscolhas(escolhas: EscolhasPainel, resolvidos: { conflitos: string[]; pessoas: PessoaPci[] }) {
    if (!form || !painel) return;
    setForm(aplicarEscolhasPci(form, escolhas));
    const chaves = new Set(resolvidos.conflitos);
    const trocados = painel.conflitos.filter((c) => chaves.has(c.chave)).map((c) => ({ chave: c.chave, rotulo: c.rotulo, valor: c.sugerido, fonte: c.fonte }));
    setPainel({ ...painel, preenchidos: [...painel.preenchidos, ...trocados], conflitos: painel.conflitos.filter((c) => !chaves.has(c.chave)), pessoas: painel.pessoas.filter((p) => !resolvidos.pessoas.includes(p.pessoa)) });
    toast.success("Escolhas aplicadas. Confira e salve o rascunho.");
  }

  async function gerar() {
    setOcupado("gerar");
    const r = await gerarPci(obraId, form);
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    toast.success("PCI gerada (planilha e PDF). Veja o histórico abaixo.");
    for (const a of r.avisos) toast.warning(a, { duration: 10000 });
    await carregar(true);
  }

  async function escolherImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const { dataUrl } = await comprimirImagem(arquivo, 1600, LIMITE_IMAGEM_PCI_BYTES);
      setForm((f) => (f ? { ...f, imagem: { tipo: "jpeg", base64: dataUrl.split(",")[1] } } : f));
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function baixar(id: string, tipo: "planilha" | "pdf", nome: string) {
    setBaixando(`${id}-${tipo}`);
    try { await baixarArquivoEmPartes(`/api/obras/${obraId}/pci-geradas/${id}/${tipo}`, nome); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBaixando(null); }
  }

  const secaoCampos = (secao: SecaoPci) => CAMPOS_PCI.filter((c) => c.secao === secao && (!c.visivel || c.visivel(form.campos))).map((c) => <Campo key={c.id} campo={c} valor={form.campos[c.id] ?? null} onChange={(v) => setCampo(c.id, v)} />);
  // Revisão do PR #180 (paridade): .xlsm/.xlsb geram a partir da versão .xls compatível — o servidor informa se ela existe.
  const podeGerar = !!d.modelo && d.baseCompativelDisponivel;

  return (
    <section className="space-y-4 border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-black uppercase tracking-wide text-[var(--brand-dark)]"><FileSpreadsheet size={18} /> Gerador de PCI</h2>
          <p className="text-sm text-gray-600">
            {d.modelo ? `Modelo atual: v${d.modelo.versao} — ${d.modelo.arquivo} (.${d.modelo.formato})` : "Sem modelo cadastrado."}
            {" · "}{d.origem === "rascunho" ? `Rascunho salvo em ${new Date(d.rascunhoEm!).toLocaleString("pt-BR")}${d.rascunhoAutor ? ` por ${d.rascunhoAutor}` : ""}` : "Pré-preenchido com os dados da obra, do cliente e da PCI vinculada."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={recarregarAutomatico}>
            {ocupado === "auto" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Dados automáticos
          </button>
          <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={salvarRascunho}>
            {ocupado === "salvar" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar rascunho
          </button>
          <button type="button" className={botaoPri} disabled={!podeGerar || ocupado !== null || misturas.length > 0} onClick={gerar}>
            {ocupado === "gerar" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Gerar PCI (planilha + PDF)
          </button>
        </div>
      </div>
      {d.avisoModelo && <p role="alert" className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {d.avisoModelo}</p>}
      {erros.length > 0 && (
        <div role="alert" className="border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          <p className="font-bold">Corrija antes de salvar ou gerar:</p>
          <ul className="ml-5 mt-1 list-disc">{erros.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {pendencias.length > 0 && (
        <details className="border border-amber-200 bg-amber-50/60 p-2 text-sm text-amber-900">
          <summary className="cursor-pointer">{pendencias.length} pendência(s) para conferir antes de enviar à CAIXA (não impedem gerar)</summary>
          <ul className="ml-5 mt-1 list-disc">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
      )}

      {misturas.length > 0 && (
        <div role="alert" className="space-y-1 border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          <p className="font-bold">A PCI não pode ser gerada assim:</p>
          {misturas.map((m) => (
            <div key={m.pessoa} className="flex flex-wrap items-center gap-2">
              <span>{m.mensagem}</span>
              <button type="button" className={botaoSec} onClick={() => { if (confirm(`${m.motivo === "legado" ? "Rascunho anterior à conferência de origem. " : ""}Confirma que o nome e o CPF são da MESMA pessoa? (Fica registrado quem confirmou e quando.)`)) setForm(confirmarMesmaPessoaPci(form, m.pessoa)); }}>Confirmo que nome e CPF são da mesma pessoa</button>
            </div>
          ))}
        </div>
      )}
      {painel && <ResultadoPreenchimento key={`${painel.titulo}-${painel.conflitos.length}-${painel.pessoas.length}`} r={painel} onAplicar={aplicarEscolhas} onFechar={() => setPainel(null)} />}
      <ModelosPreenchimento obraId={obraId} form={form} setForm={setForm} mostrar={setPainel} />

      {SECOES_PCI.map((s) => (
        <details key={s.id} open={s.id === "proponente"} className="border border-gray-200 bg-gray-50/50 p-3">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">{s.titulo}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(s.id === "rtp" || s.id === "rte") && <SeletorEngenheiro papel={s.id} obraId={obraId} form={form} setForm={setForm} engenheiros={d.engenheiros} />}
            {secaoCampos(s.id)}
            {s.id === "custos" && totais && (
              <div className="sm:col-span-2 overflow-x-auto">
                <table className="w-full text-sm text-gray-800">
                  <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Item</th><th className="p-1">Serviço</th><th className="p-1">Custo (R$)</th><th className="p-1 text-right">Incid. (%)</th></tr></thead>
                  <tbody>
                    {SERVICOS_CUSTO_PCI.map((nome, i) => (
                      <tr key={nome} className="border-t border-gray-100">
                        <td className="p-1">{i + 1}</td><td className="p-1">{nome}</td>
                        <td className="p-1 min-w-[140px]"><NumeroInput aria-label={`Custo ${nome}`} value={form.custos[i]} negativo={false} className={campoCls}
                          onChange={(v) => setForm({ ...form, custos: form.custos.map((c, k) => (k === i ? v : c)) })} /></td>
                        <td className="p-1 text-right">{brl(totais.incidencias[i])}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-100"><td className="p-1">20</td><td className="p-1">{SERVICO_OUTROS_PCI}</td><td className="p-1">{brl(totais.outros)}</td><td className="p-1 text-right">{brl(totais.incidencias[19])}</td></tr>
                  </tbody>
                  <tfoot className="font-bold">
                    <tr><td /><td className="p-1">Custo total de serviços</td><td className="p-1">{brl(totais.totalServicos)}</td><td /></tr>
                    <tr><td /><td className="p-1">Custo total com BDI</td><td className="p-1">{brl(totais.totalComBdi)}</td><td /></tr>
                  </tfoot>
                </table>
                <p className={`${rotuloCls} mt-3`}>Serviços adicionais (somam no item 20 &quot;Outros&quot;)</p>
                {form.adicionais.map((a, i) => (
                  <div key={i} className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <input aria-label={`Serviço adicional ${i + 1}`} value={a.descricao} placeholder={`Serviço adicional ${i + 1}`} className={campoCls}
                      onChange={(e) => setForm({ ...form, adicionais: form.adicionais.map((x, k) => (k === i ? { ...x, descricao: e.target.value } : x)) })} />
                    <NumeroInput aria-label={`Custo do serviço adicional ${i + 1}`} value={a.valor} negativo={false} className={campoCls}
                      onChange={(v) => setForm({ ...form, adicionais: form.adicionais.map((x, k) => (k === i ? { ...x, valor: v } : x)) })} />
                  </div>
                ))}
              </div>
            )}
            {s.id === "cronograma" && (
              <div className="sm:col-span-2">
                {prazo < 1 ? <p className="text-sm text-gray-600">Informe o prazo (meses) para montar o cronograma.</p> : (
                  <div className="overflow-x-auto">
                    <p className="mb-2 text-xs text-gray-600">Informe o % ACUMULADO da obra ao fim de cada etapa (0,00 a 100,00, sem diminuir; a última etapa termina em 100,00). A etapa 0 é o pré-executado. O incremental é a diferença entre etapas consecutivas.</p>
                    <table className="w-full text-sm text-gray-800">
                      <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Etapa</th><th className="p-1">% acumulado proposto</th><th className="p-1 text-right">% da etapa (incremental)</th><th className="p-1">Validação</th></tr></thead>
                      <tbody>
                        <tr className="border-t border-gray-100"><td className="p-1">0</td><td className="p-1">{brl(cronograma?.etapa0 ?? 0)}% (pré-executado)</td><td className="p-1 text-right">{brl(cronograma?.etapa0 ?? 0)}</td><td /></tr>
                        {Array.from({ length: prazo }, (_, k) => {
                          const problemas = [...(cronograma?.erros.filter((e) => e.etapa === k + 1).map((e) => ({ m: e.mensagem, erro: e.tipo === "valor" })) ?? []), ...(cronograma?.avisos.filter((a) => a.etapa === k + 1).map((a) => ({ m: a.mensagem, erro: false })) ?? [])];
                          const inc = cronograma?.incrementais[k] ?? null;
                          return (
                            <tr key={k} className="border-t border-gray-100 align-top">
                              <td className="p-1"><label htmlFor={`pci-etapa-${k}`}>{k + 1}</label></td>
                              <td className="p-1 min-w-[130px]">
                                <NumeroInput id={`pci-etapa-${k}`} value={form.cronograma[k] ?? null} negativo={false} casas={2} pontoDecimal sufixo="%" aria-invalid={problemas.some((p) => p.erro) || undefined}
                                  className={`${campoCls} ${problemas.some((p) => p.erro) ? "border-red-400" : ""}`}
                                  onChange={(v) => { const c = Array.from({ length: prazo }, (_, j) => form.cronograma[j] ?? null); c[k] = v; setForm({ ...form, cronograma: c }); }} />
                              </td>
                              <td className="p-1 text-right">{inc === null ? "—" : brl(inc)}</td>
                              <td className="p-1 text-xs">{problemas.map((p) => <span key={p.m} className={`block ${p.erro ? "text-red-700" : "text-amber-700"}`}>{p.m}</span>)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {s.id === "localizacao" && (
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs text-gray-600">Imagem da localização/poligonal do terreno (ex.: captura do Google Earth). No modelo .xls ela entra no quadro &quot;Inserir Poligonal do Terreno&quot;; sempre vai no PDF.</p>
                <input type="file" accept="image/png,image/jpeg" aria-label="Imagem de localização" onChange={(e) => void escolherImagem(e.target.files?.[0])} className="text-sm" />
                {form.imagem && (
                  <div className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (data URL) */}
                    <img src={`data:image/${form.imagem.tipo};base64,${form.imagem.base64}`} alt="Imagem de localização" className="max-h-64 border border-gray-200" />
                    <button type="button" className={botaoSec} onClick={() => setForm({ ...form, imagem: null })}>Remover imagem</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      ))}

      <div className="border border-gray-200 p-3">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">Histórico de PCIs geradas</h3>
        {!d.historico.length ? <p className="text-sm text-gray-600">Nenhuma PCI gerada para esta obra.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Gerada em</th><th className="p-1">Autor</th><th className="p-1">Modelo</th><th className="p-1">Arquivos</th></tr></thead>
              <tbody>
                {d.historico.map((h) => (
                  <tr key={h.id} className="border-t border-gray-100 align-top">
                    <td className="p-1 whitespace-nowrap">{new Date(h.geradoEm).toLocaleString("pt-BR")}</td>
                    <td className="p-1">{h.autor ?? "—"}</td>
                    <td className="p-1">v{h.modeloVersao}{h.avisos.length ? <span title={h.avisos.join("\n")} className="ml-1 text-amber-700">({h.avisos.length} aviso{h.avisos.length > 1 ? "s" : ""})</span> : null}</td>
                    <td className="p-1">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={botaoSec} disabled={baixando !== null} onClick={() => void baixar(h.id, "planilha", h.planilha)} aria-label={`Baixar planilha .${h.formato}`}>
                          {baixando === `${h.id}-planilha` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}.{h.formato}
                        </button>
                        <button type="button" className={botaoSec} disabled={baixando !== null} onClick={() => void baixar(h.id, "pdf", h.pdf)} aria-label="Baixar PDF">
                          {baixando === `${h.id}-pdf` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}.pdf
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
