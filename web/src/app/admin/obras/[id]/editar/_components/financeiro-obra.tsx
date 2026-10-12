"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Plus, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { calcularObra, centavosDe, lerPercentualDigitado, type Indicador, type Natureza, type ResultadoObra } from "@/lib/financeiro/obra";
import { calcularComissaoObra } from "@/lib/financeiro/comissao";
import type { MovimentoResumo, ResumoObra } from "@/lib/financeiro/obra-dados";
import { parseNumeroBR } from "@/lib/utils";
import {
  adicionarMovimentoObra,
  cancelarMovimentoObra,
  criarInvestidor,
  listarBpoDisponiveis,
  listarInvestidores,
  reativarMovimentoObra,
} from "@/lib/actions/obra-financeiro";

// EPIC-020 Lote 2 — abas "Valores da Operação" e "Custos" do Grupo Santa Fé.
// Mesmas regras e mesmo motor da Prospecta: campos automáticos são
// calculados ao vivo, somente leitura, e nunca enviados para gravação.

export const inputCls = "w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";
const leituraCls = "w-full border border-gray-100 px-3 py-2.5 text-sm bg-gray-100 text-gray-700";
export const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";

export interface FormFinanceiro {
  vgv: string | null;
  financiamento: string | null;
  fgts: string | null;
  subsidio: string | null;
  custoTerreno: string | null;
  comissao: string | null;
  comissaoPercentual: string | null;
  orcamentoPrevisto: string | null;
  taxaMensalPct: string | null;
  parcelas: number | null;
  empreiteiroId: string | null;
  percentualEmpreiteiro: string | null;
  investidores: { investidorId: string; nome: string; percentual: string }[];
}

export function formInicial(resumo: ResumoObra): FormFinanceiro {
  const v = resumo.valores;
  return {
    vgv: v.vgv, financiamento: v.financiamento, fgts: v.fgts, subsidio: v.subsidio,
    custoTerreno: v.custoTerreno, comissao: v.comissao, comissaoPercentual: v.comissaoPercentual, orcamentoPrevisto: v.orcamentoPrevisto,
    taxaMensalPct: v.taxaMensalPct, parcelas: v.parcelas,
    empreiteiroId: resumo.empreiteiro?.id ?? null, percentualEmpreiteiro: v.percentualEmpreiteiro,
    investidores: resumo.investidores.map((i) => ({ ...i })),
  };
}

/** Item 32: com corretor no CRM e regra de %, a comissão é VGV × % (somente leitura). */
export function comissaoAoVivo(form: FormFinanceiro, resumo: ResumoObra) {
  return calcularComissaoObra({
    corretor: resumo.corretor,
    vgvCentavos: centavosDe(form.vgv),
    percentualObra: form.comissaoPercentual,
    pagoCentavos: resumo.comissaoCalculada.pagoCentavos,
  });
}

export function calcularAoVivo(form: FormFinanceiro, resumo: ResumoObra, datas: { inicio: string; termino: string }): ResultadoObra {
  return calcularObra({
    vgv: centavosDe(form.vgv), financiamento: centavosDe(form.financiamento), fgts: centavosDe(form.fgts),
    subsidio: centavosDe(form.subsidio), custoTerreno: centavosDe(form.custoTerreno), comissao: resumo.corretor ? comissaoAoVivo(form, resumo).valorCentavos : centavosDe(form.comissao),
    orcamentoPrevisto: centavosDe(form.orcamentoPrevisto), taxaMensalPct: form.taxaMensalPct, parcelas: form.parcelas,
    dataInicio: datas.inicio || null, dataTerminoPrevista: datas.termino || null,
    investidores: form.investidores.map((i) => ({ id: i.investidorId, percentual: i.percentual })),
    percentualEmpreiteiro: form.empreiteiroId ? form.percentualEmpreiteiro : null,
    movimentos: resumo.movimentos.map((m) => ({ natureza: m.natureza, valorCentavos: centavosDe(m.valor)!, status: m.status })),
  });
}

const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlTexto = (v: string | null | undefined) => (v == null ? "—" : brl(centavosDe(v) ?? 0));
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Campo numérico BR que aceita vazio (vazio = não informado, nunca zero). */
export function CampoDecimal({ valor, onChange, casas = 2, prefixo, sufixo, placeholder, ariaLabel }: {
  valor: string | null; onChange: (v: string | null) => void; casas?: number; prefixo?: string; sufixo?: string; placeholder?: string; ariaLabel?: string;
}) {
  const formatar = (v: string | null) =>
    v == null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas === 2 ? 2 : 0, maximumFractionDigits: casas });
  // Fora de foco mostra sempre o valor canônico; em foco, o texto digitado.
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);
  return (
    <div className="relative">
      {prefixo && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefixo}</span>}
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={focado ? texto : formatar(valor)}
        placeholder={placeholder ?? "Não informado"}
        onFocus={() => { setTexto(formatar(valor)); setFocado(true); }}
        onBlur={() => setFocado(false)}
        onChange={(e) => {
          const t = e.target.value;
          setTexto(t);
          if (!t.trim()) return onChange(null);
          // Percentual/taxa: ponto é decimal ("2.345" = 2,345%); dinheiro segue o padrão BR.
          const n = casas > 2 ? lerPercentualDigitado(t) : parseNumeroBR(t);
          if (n !== null && Number.isFinite(n) && n >= 0) onChange(n.toFixed(casas));
        }}
        className={`${inputCls} ${prefixo ? "pl-10" : ""} ${sufixo ? "pr-8" : ""}`}
      />
      {sufixo && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sufixo}</span>}
    </div>
  );
}

function Calculado({ label, indicador, destaque, ajuda }: { label: string; indicador: Indicador; destaque?: boolean; ajuda?: string }) {
  const negativo = indicador.ok && indicador.centavos < 0;
  return (
    <div>
      <p className={labelCls}>{label} <span className="normal-case font-normal text-[10px] text-gray-400">· automático</span></p>
      <div className={`${leituraCls} ${destaque ? "font-black text-[var(--brand-dark)]" : ""} ${negativo ? "!text-red-600 border-red-200" : ""}`} aria-readonly="true">
        {indicador.ok ? brl(indicador.centavos) : <span className="text-amber-700 text-xs">{indicador.motivo}</span>}
      </div>
      {negativo && <p className="text-[11px] text-red-600 mt-1">Valor negativo — verifique os lançamentos.</p>}
      {ajuda && <p className="text-[11px] text-gray-400 mt-1">{ajuda}</p>}
    </div>
  );
}

function Leitura({ label, valor, ajuda }: { label: string; valor: string; ajuda?: string }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className={leituraCls} aria-readonly="true">{valor}</div>
      {ajuda && <p className="text-[11px] text-gray-400 mt-1">{ajuda}</p>}
    </div>
  );
}

function Secao({ titulo, formula, children }: { titulo: string; formula?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="font-black text-[var(--brand-dark)] uppercase tracking-wide text-sm">{titulo}</h3>
        {formula && <p className="text-[11px] text-gray-400 mt-0.5">{formula}</p>}
      </div>
      {children}
    </section>
  );
}

function Modal({ titulo, aberto, onFechar, children }: { titulo: string; aberto: boolean; onFechar: () => void; children: React.ReactNode }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="bg-white w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-[var(--brand-dark)] uppercase text-sm">{titulo}</h4>
          <button type="button" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Alertas({ calculo }: { calculo: ResultadoObra }) {
  if (!calculo.alertas.length) return null;
  return (
    <div role="alert" className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
      {calculo.alertas.map((a) => <p key={a} className="flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{a}</p>)}
    </div>
  );
}

const ORIGEM: Record<string, string> = { manual: "Manual", bpo: "BPO", migracao: "Migrado" };
const CATEGORIA: Record<string, string> = {
  terreno: "Terreno", comissao: "Comissão", empreiteiro: "Empreiteiro", fornecedor: "Fornecedor", outros: "Outros", nao_detalhado: "Não detalhado (migrado)",
};

function Historico({ titulo, movimentos }: { titulo: string; movimentos: MovimentoResumo[] }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [cancelando, setCancelando] = useState<MovimentoResumo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const executar = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, depois?: () => void) =>
    start(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) return setErro(r.erro);
      depois?.();
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{titulo}</p>
      {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      {movimentos.length === 0 ? <p className="text-xs text-gray-400">Nenhum lançamento.</p> : (
        <div className="overflow-x-auto border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
              <tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Origem</th><th className="p-2 text-right">Valor</th><th className="p-2 text-left">Situação</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id} className={`border-t border-gray-100 ${m.status === "cancelado" ? "text-gray-400 line-through" : ""}`}>
                  <td className="p-2 whitespace-nowrap">{dataBr(m.data)}</td>
                  <td className="p-2">
                    {m.descricao}
                    {m.categoria && <span className="ml-2 text-[10px] uppercase text-gray-400">{CATEGORIA[m.categoria]}</span>}
                    {m.observacao && <span className="block text-xs text-gray-400">{m.observacao}</span>}
                    {m.bpo && <span className="block text-xs text-gray-400">BPO: {m.bpo.descricao}{!m.bpo.pago ? " — não está mais pago!" : ""}</span>}
                    {m.status === "cancelado" && m.motivoCancelamento && <span className="block text-xs text-red-500">Cancelado: {m.motivoCancelamento}</span>}
                  </td>
                  <td className="p-2">{ORIGEM[m.origem]}</td>
                  <td className="p-2 text-right whitespace-nowrap">{brlTexto(m.valor)}</td>
                  <td className="p-2">{m.status === "confirmado" ? "Confirmado" : "Cancelado"}</td>
                  <td className="p-2 text-right">
                    {m.status === "confirmado" ? (
                      <button type="button" className="text-red-500" onClick={() => setCancelando(m)} aria-label={`Cancelar ${m.descricao}`}><Ban size={15} /></button>
                    ) : (
                      <button type="button" className="text-[var(--brand-dark)]" disabled={pendente} onClick={() => executar(() => reativarMovimentoObra(m.id))} aria-label={`Reativar ${m.descricao}`}><RotateCcw size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal titulo="Cancelar lançamento" aberto={!!cancelando} onFechar={() => setCancelando(null)}>
        <p className="text-sm text-gray-600">
          {cancelando?.descricao} — {brlTexto(cancelando?.valor)}. O lançamento continua no histórico e deixa de entrar nos totais.
          {cancelando?.origem === "bpo" && " O lançamento original no BPO não é alterado (isto desvincula o BPO desta obra)."}
        </p>
        <label className={labelCls} htmlFor="motivo-cancelamento">Motivo</label>
        <textarea id="motivo-cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className={inputCls} />
        <button type="button" disabled={pendente || motivo.trim().length < 3}
          onClick={() => cancelando && executar(() => cancelarMovimentoObra(cancelando.id, motivo), () => { setCancelando(null); setMotivo(""); })}
          className="bg-red-500 text-white font-bold text-xs uppercase px-4 py-2 disabled:opacity-50">Confirmar cancelamento</button>
      </Modal>
    </div>
  );
}

function NovoMovimento({ obraId, natureza, rotulo }: { obraId: string; natureza: Natureza; rotulo: string }) {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState<"manual" | "bpo">("manual");
  const [bpo, setBpo] = useState<{ id: string; descricao: string; disponivelCentavos: number }[] | null>(null);
  const [bpoId, setBpoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [categoria, setCategoria] = useState("empreiteiro");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  useEffect(() => {
    if (aberto && origem === "bpo" && bpo === null) listarBpoDisponiveis(natureza).then(setBpo).catch(() => setBpo([]));
  }, [aberto, origem, bpo, natureza]);
  const valido = !!valor && Number(valor) > 0 && descricao.trim().length >= 2 && !!data && (origem === "manual" || !!bpoId);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-1 border border-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2">
        <Plus size={14} /> {rotulo}
      </button>
      <Modal titulo={rotulo} aberto={aberto} onFechar={() => setAberto(false)}>
        <label className={labelCls}>Origem
          <select value={origem} onChange={(e) => setOrigem(e.target.value as "manual" | "bpo")} className={`${inputCls} mt-1 normal-case font-normal`}>
            <option value="manual">Lançamento manual</option>
            <option value="bpo">Vincular lançamento do BPO Financeiro</option>
          </select>
        </label>
        {natureza === "pagamento" && (
          <label className={labelCls}>Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${inputCls} mt-1 normal-case font-normal`}>
              {["empreiteiro", "terreno", "comissao", "fornecedor", "outros"].map((c) => <option key={c} value={c}>{CATEGORIA[c]}</option>)}
            </select>
          </label>
        )}
        {origem === "bpo" && (
          <label className={labelCls}>Lançamento do BPO (pago)
            <select value={bpoId} onChange={(e) => {
              setBpoId(e.target.value);
              const b = bpo?.find((x) => x.id === e.target.value);
              if (b) { setDescricao(b.descricao.slice(0, 255)); setValor((b.disponivelCentavos / 100).toFixed(2)); }
            }} className={`${inputCls} mt-1 normal-case font-normal`}>
              <option value="">{bpo === null ? "Carregando..." : "Selecione"}</option>
              {(bpo ?? []).map((b) => <option key={b.id} value={b.id}>{b.descricao} · disponível {brl(b.disponivelCentavos)}</option>)}
            </select>
            {bpo?.length === 0 && <span className="block text-[11px] text-gray-400 normal-case font-normal mt-1">Nenhum lançamento pago com saldo disponível no BPO.</span>}
          </label>
        )}
        <label className={labelCls}>Descrição<input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={`${inputCls} mt-1 normal-case font-normal`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <div><p className={labelCls}>Valor</p><CampoDecimal valor={valor} onChange={setValor} prefixo="R$" placeholder="0,00" ariaLabel="Valor" /></div>
          <label className={labelCls}>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${inputCls} mt-1`} /></label>
        </div>
        <label className={labelCls}>Observação (opcional)<textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={`${inputCls} mt-1 normal-case font-normal`} /></label>
        {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
        <button type="button" disabled={!valido || pendente}
          onClick={() => start(async () => {
            setErro(null);
            const r = await adicionarMovimentoObra({
              obraId, natureza, descricao, valor: valor!, data,
              categoria: natureza === "pagamento" ? (categoria as "empreiteiro") : undefined,
              observacao: observacao || undefined,
              bpoLancamentoId: origem === "bpo" ? bpoId : undefined,
            });
            if (!r.ok) return setErro(r.erro);
            setAberto(false); setDescricao(""); setValor(null); setObservacao(""); setBpoId(""); setBpo(null); setOrigem("manual"); setData(hoje);
            router.refresh();
          })}
          className="w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2.5 disabled:opacity-50">
          {pendente ? "Registrando..." : "Registrar"}
        </button>
      </Modal>
    </>
  );
}

function Investidores({ form, setForm, calculo }: { form: FormFinanceiro; setForm: (f: FormFinanceiro) => void; calculo: ResultadoObra }) {
  const [lista, setLista] = useState<{ id: string; nome: string }[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState({ nome: "", documento: "", telefone: "", email: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  useEffect(() => { listarInvestidores().then(setLista).catch(() => setLista([])); }, []);
  const disponiveis = lista.filter((i) => !form.investidores.some((f) => f.investidorId === i.id));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Investidores vinculados</p>
        <div className="flex gap-2">
          <select aria-label="Vincular investidor" value="" className={`${inputCls} w-56`} onChange={(e) => {
            const inv = lista.find((i) => i.id === e.target.value);
            if (inv) setForm({ ...form, investidores: [...form.investidores, { investidorId: inv.id, nome: inv.nome, percentual: "0.000000" }] });
          }}>
            <option value="">{disponiveis.length ? "Vincular investidor" : "Nenhum outro cadastrado"}</option>
            {disponiveis.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
          <button type="button" className="border border-gray-200 px-3" onClick={() => setNovoAberto(true)} aria-label="Cadastrar investidor"><UserPlus size={15} /></button>
        </div>
      </div>
      {form.investidores.length === 0 && <p className="text-xs text-gray-400">Nenhum investidor nesta obra.</p>}
      {form.investidores.map((inv, idx) => (
        <div key={inv.investidorId} className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_auto] gap-3 items-end">
          <Leitura label="Investidor" valor={inv.nome} />
          <div>
            <p className={labelCls}>Participação</p>
            <CampoDecimal valor={inv.percentual} casas={6} sufixo="%" placeholder="0" ariaLabel={`Participação de ${inv.nome}`} onChange={(v) => {
              const investidores = [...form.investidores];
              investidores[idx] = { ...inv, percentual: v ?? "0.000000" };
              setForm({ ...form, investidores });
            }} />
          </div>
          <Calculado label="Lucro do Investidor" indicador={calculo.investidores[idx]?.lucro ?? { ok: false, motivo: "—" }} />
          <button type="button" className="text-red-500 pb-3" aria-label={`Remover ${inv.nome}`}
            onClick={() => setForm({ ...form, investidores: form.investidores.filter((_, i) => i !== idx) })}><Trash2 size={15} /></button>
        </div>
      ))}
      <Modal titulo="Novo investidor" aberto={novoAberto} onFechar={() => setNovoAberto(false)}>
        {(["nome", "documento", "telefone", "email"] as const).map((k) => (
          <label key={k} className={labelCls}>{k === "documento" ? "CPF/CNPJ" : k}
            <input value={novo[k]} onChange={(e) => setNovo({ ...novo, [k]: e.target.value })} className={`${inputCls} mt-1 normal-case font-normal`} />
          </label>
        ))}
        {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
        <button type="button" disabled={pendente || novo.nome.trim().length < 2} className="w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2.5 disabled:opacity-50"
          onClick={() => start(async () => {
            try {
              const inv = await criarInvestidor(novo);
              setLista([...lista, inv]);
              setForm({ ...form, investidores: [...form.investidores, { investidorId: inv.id, nome: inv.nome, percentual: "0.000000" }] });
              setNovoAberto(false); setNovo({ nome: "", documento: "", telefone: "", email: "" });
            } catch (e) { setErro((e as Error).message); }
          })}>Cadastrar</button>
      </Modal>
    </div>
  );
}

const porNatureza = (resumo: ResumoObra, n: Natureza) => resumo.movimentos.filter((m) => m.natureza === n);

export function ValoresOperacao({ resumo, form, setForm, calculo, empreiteiroNome }: {
  resumo: ResumoObra; form: FormFinanceiro; setForm: (f: FormFinanceiro) => void; calculo: ResultadoObra; empreiteiroNome: string | null;
}) {
  const set = (k: keyof FormFinanceiro) => (v: string | null) => setForm({ ...form, [k]: v });
  const pls = calculo.plsReal;
  const obraId = resumo.obra.id;
  return (
    <div className="space-y-4">
      <Alertas calculo={calculo} />
      <Secao titulo="Composição da operação">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><p className={labelCls}>VGV</p><CampoDecimal valor={form.vgv} onChange={set("vgv")} prefixo="R$" ariaLabel="VGV" /></div>
          <div><p className={labelCls}>Financiamento CEF</p><CampoDecimal valor={form.financiamento} onChange={set("financiamento")} prefixo="R$" ariaLabel="Financiamento CEF" /></div>
          <div><p className={labelCls}>FGTS</p><CampoDecimal valor={form.fgts} onChange={set("fgts")} prefixo="R$" ariaLabel="FGTS" /></div>
          <div><p className={labelCls}>Subsídio</p><CampoDecimal valor={form.subsidio} onChange={set("subsidio")} prefixo="R$" ariaLabel="Subsídio" /></div>
        </div>
      </Secao>
      <Secao titulo="Entrada" formula="Entrada Total = VGV − Financiamento CEF − FGTS − Subsídio · Saldo = Entrada Total − Entrada Paga">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Calculado label="Entrada Total" indicador={calculo.entradaTotal} />
          <Calculado label="Entrada Paga" indicador={calculo.entradaPaga} ajuda="Soma das entradas confirmadas." />
          <Calculado label="Saldo da Entrada" indicador={calculo.saldoEntrada} destaque />
        </div>
        <NovoMovimento obraId={obraId} natureza="entrada" rotulo="Adicionar Entrada" />
        <Historico titulo="Histórico de entradas" movimentos={porNatureza(resumo, "entrada")} />
      </Secao>
      <Secao titulo="Caixa Econômica Federal" formula="A Receber do Banco = Financiamento + Subsídio + FGTS − Terreno − Recebido CEF · PLS Real = Recebido CEF × 100 ÷ (Financiamento + Subsídio + FGTS − Terreno)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Calculado label="Valor Recebido CEF" indicador={calculo.recebidoCef} />
          <Calculado label="Valor a Receber do Banco" indicador={calculo.receberBanco} destaque />
          <Leitura label="PLS Real (%)" valor={pls.ok ? `${pls.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : pls.motivo}
            ajuda="Percentual financeiro recebido — não mede a execução física." />
        </div>
        <NovoMovimento obraId={obraId} natureza="recebimento_cef" rotulo="Adicionar recebimento da CEF" />
        <Historico titulo="Histórico de recebimentos da CEF" movimentos={porNatureza(resumo, "recebimento_cef")} />
      </Secao>
      <Secao titulo="Custos (vindos da aba Custos)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Calculado label="Custo Construção" indicador={calculo.custoConstrucao} ajuda="Igual ao Orçamento Previsto." />
          <Calculado label="Gasto Obra Realizado" indicador={calculo.gastoObraRealizado} ajuda="Igual ao Total Gasto na Obra." />
        </div>
      </Secao>
      <Secao titulo="Distribuição dos lucros" formula="Lucro Estimado = VGV − Terreno − Comissão − Orçamento Previsto. Estimativa da operação, não é lucro contábil líquido.">
        <Calculado label="Lucro Estimado da Operação" indicador={calculo.lucroEstimado} destaque />
        <Investidores form={form} setForm={setForm} calculo={calculo} />
        <Calculado label="Lucro dos Investidores (total)" indicador={calculo.lucroInvestidores} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <Leitura label="Empreiteiro" valor={empreiteiroNome ?? "Nenhum (selecione na aba Custos)"} />
          <div>
            <p className={labelCls}>Participação do Empreiteiro</p>
            {form.empreiteiroId
              ? <CampoDecimal valor={form.percentualEmpreiteiro} onChange={set("percentualEmpreiteiro")} casas={6} sufixo="%" placeholder="0" ariaLabel="Participação do Empreiteiro" />
              : <div className={leituraCls}>—</div>}
          </div>
          <Calculado label="Base do Empreiteiro" indicador={calculo.baseEmpreiteiro} ajuda="Lucro Estimado − Lucro dos Investidores" />
          <Calculado label="Lucro do Empreiteiro" indicador={calculo.lucroEmpreiteiro} />
        </div>
        <Calculado label="Lucro Grupo Santa Fé" indicador={calculo.lucroEmpresa} destaque ajuda="Lucro Estimado − Lucro dos Investidores − Lucro do Empreiteiro" />
      </Secao>
      <Secao titulo="Pró-Soluto" formula="Pró-Soluto = Saldo da Entrada · Parcela pelo sistema Price (equivalente à HP 12C, modo END)">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Calculado label="Pró-Soluto" indicador={calculo.proSoluto} />
          <div><p className={labelCls}>Taxa Mensal (%)</p><CampoDecimal valor={form.taxaMensalPct} onChange={set("taxaMensalPct")} casas={4} sufixo="%" ariaLabel="Taxa Mensal" /></div>
          <div>
            <p className={labelCls}>Quantidade de Parcelas</p>
            <input aria-label="Quantidade de Parcelas" inputMode="numeric" value={form.parcelas ?? ""} placeholder="Não informado" className={inputCls}
              onChange={(e) => { const t = e.target.value.replace(/\D/g, ""); setForm({ ...form, parcelas: t ? Number(t) : null }); }} />
          </div>
          <Calculado label="Valor da Parcela" indicador={calculo.valorParcela} destaque />
        </div>
      </Secao>
      <Secao titulo="Prazo">
        <Leitura label="Dias de Obra" valor={calculo.diasObra.ok ? `${calculo.diasObra.dias} dias` : calculo.diasObra.motivo} ajuda="Previsão de término − data de início (aba Informações)." />
      </Secao>
    </div>
  );
}

export function Custos({ resumo, form, setForm, calculo, empreiteiros, corretor }: {
  resumo: ResumoObra; form: FormFinanceiro; setForm: (f: FormFinanceiro) => void; calculo: ResultadoObra;
  empreiteiros: { id: string; nome: string }[]; corretor: string | null;
}) {
  const set = (k: keyof FormFinanceiro) => (v: string | null) => setForm({ ...form, [k]: v });
  const legado = resumo.obra.valorTotalLegado;
  return (
    <div className="space-y-4">
      <Secao titulo="Custos previstos">
        {legado != null && (
          <p className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Valor total do cadastro anterior: <strong>{brl(Math.round(legado * 100))}</strong>. Ele foi preservado e não entra nos cálculos —
            informe-o como Orçamento Previsto ou como VGV, conforme o que ele representa.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={labelCls}>Orçamento Previsto</p>
            <CampoDecimal valor={form.orcamentoPrevisto} onChange={set("orcamentoPrevisto")} prefixo="R$" ariaLabel="Orçamento Previsto" />
            <p className="text-[11px] text-gray-400 mt-1">Orçamento da construção. Não inclui terreno nem comissão.</p>
          </div>
          <label className={labelCls}>Empreiteiro
            <select value={form.empreiteiroId ?? ""} className={`${inputCls} mt-1 normal-case font-normal`}
              onChange={(e) => setForm({ ...form, empreiteiroId: e.target.value || null, percentualEmpreiteiro: e.target.value ? form.percentualEmpreiteiro : null })}>
              <option value="">Nenhum</option>
              {empreiteiros.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <span className="block text-[11px] text-gray-400 normal-case font-normal mt-1">Usuários com papel Empreiteiro (Configurações → Usuários).</span>
          </label>
          <div>
            <p className={labelCls}>Custo do Terreno</p>
            <CampoDecimal valor={form.custoTerreno} onChange={set("custoTerreno")} prefixo="R$" ariaLabel="Custo do Terreno" />
            <p className="text-[11px] text-gray-400 mt-1">Valor contratual previsto; pagamentos do terreno entram no histórico.</p>
          </div>
          <ComissaoCampos resumo={resumo} form={form} setForm={setForm} />
          <Leitura label="Corretor vinculado" valor={corretor ?? "Sem corretor no lead"} ajuda="Vem do lead no CRM." />
        </div>
      </Secao>
      <Secao titulo="Pagamentos" formula="Total Gasto = soma dos pagamentos efetivamente realizados · Saldo Restante = VGV − Total Gasto (não é lucro nem saldo bancário)">
        <NovoMovimento obraId={resumo.obra.id} natureza="pagamento" rotulo="Adicionar Pagamento" />
        <Historico titulo="Histórico de pagamentos" movimentos={porNatureza(resumo, "pagamento")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Calculado label="Total Gasto na Obra" indicador={calculo.totalGasto} destaque />
          <Calculado label="Saldo Restante" indicador={calculo.saldoRestante} />
        </div>
      </Secao>
    </div>
  );
}

/** Item 32 + 17.4: comissão vinculada ao corretor do CRM. Com regra de % e VGV,
 *  o valor é calculado (VGV × % / 100); sem regra, o valor informado é preservado. */
function ComissaoCampos({ resumo, form, setForm }: { resumo: ResumoObra; form: FormFinanceiro; setForm: (f: FormFinanceiro) => void }) {
  const c = comissaoAoVivo(form, resumo);
  const padrao = resumo.corretor?.percentualPadrao;
  return (
    <>
      {resumo.corretor && (
        <div>
          <p className={labelCls}>Percentual de Comissão</p>
          <CampoDecimal valor={form.comissaoPercentual} onChange={(v) => setForm({ ...form, comissaoPercentual: v })} casas={4} sufixo="%" ariaLabel="Percentual de Comissão"
            placeholder={padrao ? `Padrão do corretor: ${Number(padrao).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%` : "Sem regra cadastrada"} />
          <p className="text-[11px] text-gray-400 mt-1">Vazio usa o percentual padrão do corretor (Corretores). Nunca é presumido.</p>
        </div>
      )}
      {c.valorCentavos !== null ? (
        <Leitura label="Comissão · automático" valor={brl(c.valorCentavos)}
          ajuda={`VGV × ${Number(c.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% (${c.fontePercentual === "obra" ? "percentual da obra" : "padrão do corretor"}) · pago ${brl(c.pagoCentavos)}`} />
      ) : resumo.corretor ? (
        <div>
          <Leitura label="Comissão · automático" valor="Indisponível" ajuda="Obra com corretor: a comissão é sempre VGV × % (nunca digitada)." />
          {c.pendencias.map((p) => <p key={p} className="text-[11px] text-amber-700 mt-1">{p}</p>)}
        </div>
      ) : (
        <div>
          <p className={labelCls}>Comissão</p>
          <CampoDecimal valor={form.comissao} onChange={(v) => setForm({ ...form, comissao: v })} prefixo="R$" ariaLabel="Comissão" />
        </div>
      )}
    </>
  );
}
