"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import { CampoDecimal, inputCls } from "@/app/admin/obras/[id]/editar/_components/financeiro-obra";
import { exigirResultado, type ErroAcao } from "@/lib/acao-resultado";
import { centavosDe } from "@/lib/financeiro/obra";
import {
  GRUPOS_FINANCEIROS,
  GRUPO_FINANCEIRO_LABEL,
  type FinanceiroRegularizacao,
  type GrupoFinanceiro,
} from "@/lib/financeiro/regularizacao";
import {
  adicionarRecebimentoRegularizacao,
  excluirRecebimentoRegularizacao,
  criarEtapaRegularizacao,
  criarItemFinanceiroRegularizacao,
  editarEtapaRegularizacao,
  editarItemFinanceiroRegularizacao,
  excluirEtapaRegularizacao,
  excluirItemFinanceiroRegularizacao,
  listarBpoDisponiveisRegularizacao,
  moverEtapaRegularizacao,
} from "@/lib/actions/regularizacao";

// EPIC-020 Lote 6 — Etapas do Processo (30) e Tabela financeira (31).
// Mesmas regras de Prospecta/client/src/components/regularizacao/ProcessoRegularizacao.tsx.

const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide";
const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const percentual = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const secaoCls = "bg-white border border-gray-100 p-5 space-y-4";
const tituloCls = "flex items-center gap-2 font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest";
const botaoSec = "flex items-center gap-1 border border-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-3 py-1.5";
const botaoPri = "w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2.5 disabled:opacity-50";

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
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

/** Executa a ação, mostra o erro (em português) e atualiza a página. */
function useAcao() {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const executar = (fn: () => Promise<unknown>, depois?: () => void) =>
    start(async () => {
      setErro(null);
      try {
        exigirResultado((await fn()) as object | ErroAcao);
        depois?.();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  return { pendente, erro, setErro, executar };
}

export interface EtapaTela { id: string; nome: string; progresso: number; observacoes: string | null }

export function EtapasProcesso({ regularizacaoId, etapas, progressoEtapas }: {
  regularizacaoId: string;
  etapas: EtapaTela[];
  progressoEtapas: number | null;
}) {
  const [editando, setEditando] = useState<Partial<EtapaTela> | null>(null);
  const { pendente, erro, setErro, executar } = useAcao();

  const salvar = () => {
    if (!editando) return;
    const dados = { nome: editando.nome ?? "", progresso: editando.progresso ?? 0, observacoes: editando.observacoes || null };
    executar(
      () => (editando.id ? editarEtapaRegularizacao(editando.id, dados) : criarEtapaRegularizacao(regularizacaoId, dados)),
      () => setEditando(null),
    );
  };

  return (
    <section className={secaoCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <h2 className={tituloCls}><ListChecks size={14} />Etapas do Processo</h2>
        <button type="button" className={botaoSec} onClick={() => { setErro(null); setEditando({ nome: "", progresso: 0, observacoes: "" }); }}><Plus size={14} />Nova etapa</button>
      </div>
      {progressoEtapas !== null && (
        <div>
          <div className="flex justify-between text-xs text-gray-500"><span>Progresso das etapas (média)</span><span className="font-bold text-[var(--brand-dark)]">{percentual(progressoEtapas)}</span></div>
          <div className="mt-1 h-2 bg-gray-100"><div className="h-2 bg-[var(--brand-yellow)]" style={{ width: `${Math.min(100, progressoEtapas)}%` }} /></div>
        </div>
      )}
      {!etapas.length && <p className="text-sm text-gray-500">Nenhuma etapa cadastrada. As etapas são livres para cada processo e não alteram o status geral.</p>}
      {erro && !editando && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      <ol className="space-y-2">
        {etapas.map((etapa, i) => (
          <li key={etapa.id} className="border border-gray-100 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-[var(--brand-dark)]">{i + 1}. {etapa.nome}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 w-32 bg-gray-100"><div className="h-1.5 bg-[var(--brand-yellow)]" style={{ width: `${etapa.progresso}%` }} /></div>
                  <span className="text-xs text-gray-500">{etapa.progresso}%</span>
                </div>
                {etapa.observacoes && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{etapa.observacoes}</p>}
              </div>
              <div className="flex gap-1 text-gray-500">
                <button type="button" className="p-1.5 disabled:opacity-30" aria-label={`Subir ${etapa.nome}`} disabled={i === 0 || pendente} onClick={() => executar(() => moverEtapaRegularizacao(etapa.id, -1))}><ArrowUp size={15} /></button>
                <button type="button" className="p-1.5 disabled:opacity-30" aria-label={`Descer ${etapa.nome}`} disabled={i === etapas.length - 1 || pendente} onClick={() => executar(() => moverEtapaRegularizacao(etapa.id, 1))}><ArrowDown size={15} /></button>
                <button type="button" className="p-1.5" aria-label={`Editar ${etapa.nome}`} onClick={() => { setErro(null); setEditando(etapa); }}><Pencil size={15} /></button>
                <button type="button" className="p-1.5 text-red-400 disabled:opacity-30" aria-label={`Excluir ${etapa.nome}`} disabled={pendente}
                  onClick={() => { if (window.confirm(`Excluir a etapa "${etapa.nome}"?`)) executar(() => excluirEtapaRegularizacao(etapa.id)); }}><Trash2 size={15} /></button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {editando && (
        <Modal titulo={editando.id ? "Editar etapa" : "Nova etapa"} onFechar={() => setEditando(null)}>
          <label className={labelCls}>Nome da etapa *<input className={`${inputCls} mt-1 normal-case font-normal`} maxLength={120} value={editando.nome ?? ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></label>
          <label className={labelCls}>Progresso (%)
            <input className={`${inputCls} mt-1`} type="number" min={0} max={100} step={1} value={editando.progresso ?? 0}
              onChange={(e) => setEditando({ ...editando, progresso: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
          </label>
          <label className={labelCls}>Observações<textarea className={`${inputCls} mt-1 normal-case font-normal`} maxLength={2000} rows={3} value={editando.observacoes ?? ""} onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })} /></label>
          {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
          <button type="button" className={botaoPri} disabled={pendente || (editando.nome ?? "").trim().length < 2} onClick={salvar}>{pendente ? "Salvando..." : "Salvar etapa"}</button>
        </Modal>
      )}
    </section>
  );
}

export interface RecebimentoTela {
  id: string;
  itemId: string;
  item: string;
  valor: string;
  data: string;
  observacao: string | null;
  origem: string;
  status: string;
  motivoCancelamento: string | null;
  bpoDescricao: string | null;
}

const ORIGEM_LABEL: Record<string, string> = { manual: "Manual", bpo: "BPO", migracao: "Migrado" };

export function FinanceiroRegularizacaoTabela({ regularizacaoId, financeiro, recebimentos, itensComRecebimento }: {
  regularizacaoId: string;
  financeiro: FinanceiroRegularizacao;
  recebimentos: RecebimentoTela[];
  itensComRecebimento: string[];
}) {
  const [item, setItem] = useState<{ id?: string; nome: string; grupo: GrupoFinanceiro; previsto: string | null } | null>(null);
  const [recebendo, setRecebendo] = useState(false);
  const [excluindo, setExcluindo] = useState<RecebimentoTela | null>(null);
  const { pendente, erro, setErro, executar } = useAcao();

  const salvarItem = () => {
    if (!item) return;
    const dados = { nome: item.nome, grupo: item.grupo, previsto: item.previsto ?? "0" };
    executar(
      () => (item.id ? editarItemFinanceiroRegularizacao(item.id, dados) : criarItemFinanceiroRegularizacao(regularizacaoId, dados)),
      () => setItem(null),
    );
  };

  return (
    <section className={secaoCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <h2 className={tituloCls}><Wallet size={14} />Financeiro do processo</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoSec} onClick={() => { setErro(null); setItem({ nome: "", grupo: "durante_obra", previsto: null }); }}><Plus size={14} />Novo item</button>
          <button type="button" className="flex items-center gap-1 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-3 py-1.5 disabled:opacity-50"
            disabled={!financeiro.linhas.length} onClick={() => setRecebendo(true)}><Plus size={14} />Registrar recebimento</button>
        </div>
      </div>
      {erro && !item && !excluindo && <p role="alert" className="text-xs text-red-600">{erro}</p>}

      <div className="overflow-x-auto border border-gray-100">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Previsto</th><th className="p-2 text-right">Recebido</th><th className="p-2 text-right">Saldo</th><th className="p-2" /></tr>
          </thead>
          {GRUPOS_FINANCEIROS.map((grupo) => {
            const linhas = financeiro.linhas.filter((l) => l.grupo === grupo);
            const total = financeiro.grupos[grupo];
            return (
              <tbody key={grupo}>
                <tr className="bg-[var(--brand-dark)]"><td colSpan={5} className="p-2 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-yellow)]">{GRUPO_FINANCEIRO_LABEL[grupo]}</td></tr>
                {linhas.map((l) => {
                  const comRecebimento = itensComRecebimento.includes(String(l.id));
                  return (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="p-2 text-[var(--brand-dark)]">{l.nome}</td>
                      <td className="p-2 text-right whitespace-nowrap">{brl(l.previsto)}</td>
                      <td className="p-2 text-right whitespace-nowrap text-green-700">{brl(l.recebido)}</td>
                      <td className={`p-2 text-right whitespace-nowrap font-bold ${l.recebidoAMaior ? "text-red-600" : l.saldo > 0 ? "text-orange-500" : "text-gray-600"}`} title={l.recebidoAMaior ? "Recebido acima do previsto" : undefined}>{brl(l.saldo)}</td>
                      <td className="p-2 text-right whitespace-nowrap text-gray-500">
                        <button type="button" className="p-1" aria-label={`Editar ${l.nome}`} onClick={() => { setErro(null); setItem({ id: String(l.id), nome: l.nome, grupo: l.grupo, previsto: (l.previsto / 100).toFixed(2) }); }}><Pencil size={14} /></button>
                        <button type="button" className="p-1 text-red-400 disabled:opacity-30" aria-label={`Excluir ${l.nome}`} disabled={pendente || comRecebimento}
                          title={comRecebimento ? "Item com recebimentos não pode ser excluído" : undefined}
                          onClick={() => { if (window.confirm(`Excluir o item "${l.nome}"?`)) executar(() => excluirItemFinanceiroRegularizacao(String(l.id))); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-gray-200 bg-gray-50 font-bold">
                  <td className="p-2">Total {GRUPO_FINANCEIRO_LABEL[grupo]}</td>
                  <td className="p-2 text-right whitespace-nowrap">{brl(total.previsto)}</td>
                  <td className="p-2 text-right whitespace-nowrap text-green-700">{brl(total.recebido)}</td>
                  <td className="p-2 text-right whitespace-nowrap">{brl(total.saldo)}</td>
                  <td />
                </tr>
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t-2 border-[var(--brand-yellow)] font-black text-[var(--brand-dark)]">
              <td className="p-2 uppercase text-xs">Total geral</td>
              <td className="p-2 text-right whitespace-nowrap">{brl(financeiro.geral.previsto)}</td>
              <td className="p-2 text-right whitespace-nowrap text-green-700">{brl(financeiro.geral.recebido)}</td>
              <td className={`p-2 text-right whitespace-nowrap ${financeiro.geral.saldo < 0 ? "text-red-600" : ""}`}>{brl(financeiro.geral.saldo)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-2">
        <p className={labelCls}>Histórico de recebimentos</p>
        {!recebimentos.length ? <p className="text-xs text-gray-600">Nenhum recebimento registrado.</p> : (
          <div className="overflow-x-auto border border-gray-100">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Item</th><th className="p-2 text-left">Origem</th><th className="p-2 text-right">Valor</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {recebimentos.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-2 whitespace-nowrap">{dataBr(r.data)}</td>
                    <td className="p-2">
                      <span>{r.item}</span>
                      {r.observacao && <span className="block text-xs text-gray-600">{r.observacao}</span>}
                      {r.bpoDescricao && <span className="block text-xs text-gray-600">BPO: {r.bpoDescricao}</span>}
                    </td>
                    <td className="p-2 text-gray-500">{ORIGEM_LABEL[r.origem] ?? r.origem}</td>
                    <td className="p-2 text-right whitespace-nowrap">{brl(centavosDe(r.valor) ?? 0)}</td>
                    <td className="p-2 text-right">
                      <button type="button" className="p-1 text-red-400" aria-label="Excluir recebimento" onClick={() => { setErro(null); setExcluindo(r); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {item && (
        <Modal titulo={item.id ? "Editar item" : "Novo item"} onFechar={() => setItem(null)}>
          <label className={labelCls}>Nome *<input className={`${inputCls} mt-1 normal-case font-normal`} maxLength={120} value={item.nome} onChange={(e) => setItem({ ...item, nome: e.target.value })} /></label>
          <label className={labelCls}>Grupo
            <select className={`${inputCls} mt-1 normal-case font-normal`} value={item.grupo} onChange={(e) => setItem({ ...item, grupo: e.target.value as GrupoFinanceiro })}>
              {GRUPOS_FINANCEIROS.map((g) => <option key={g} value={g}>{GRUPO_FINANCEIRO_LABEL[g]}</option>)}
            </select>
          </label>
          <div><p className={labelCls}>Previsto</p><CampoDecimal valor={item.previsto} onChange={(v) => setItem({ ...item, previsto: v })} prefixo="R$" placeholder="0,00" ariaLabel="Previsto" /></div>
          {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
          <button type="button" className={botaoPri} disabled={pendente || item.nome.trim().length < 2} onClick={salvarItem}>{pendente ? "Salvando..." : "Salvar item"}</button>
        </Modal>
      )}

      {recebendo && (
        <NovoRecebimento regularizacaoId={regularizacaoId} itens={financeiro.linhas.map((l) => ({ id: String(l.id), nome: l.nome }))} onFechar={() => setRecebendo(false)} />
      )}

      {excluindo && (
        <Modal titulo="Excluir recebimento" onFechar={() => setExcluindo(null)}>
          <p className="text-sm text-gray-600">
            {excluindo.item} — {brl(centavosDe(excluindo.valor) ?? 0)}. O recebimento será removido definitivamente e sai dos totais. Esta ação não pode ser desfeita.
            {excluindo.origem === "bpo" && " O lançamento original no BPO não é alterado (o valor volta a ficar disponível)."}
          </p>
          {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
          <button type="button" className="w-full bg-red-500 text-white font-bold text-xs uppercase py-2.5 disabled:opacity-50" disabled={pendente}
            onClick={() => executar(() => excluirRecebimentoRegularizacao(excluindo.id), () => setExcluindo(null))}>Excluir definitivamente</button>
        </Modal>
      )}
    </section>
  );
}

function NovoRecebimento({ regularizacaoId, itens, onFechar }: { regularizacaoId: string; itens: { id: string; nome: string }[]; onFechar: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [itemId, setItemId] = useState(itens[0]?.id ?? "");
  const [origem, setOrigem] = useState<"manual" | "bpo">("manual");
  const [bpo, setBpo] = useState<{ id: string; descricao: string; disponivelCentavos: number }[] | null>(null);
  const [bpoId, setBpoId] = useState("");
  const [valor, setValor] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const { pendente, erro, executar } = useAcao();
  useEffect(() => {
    if (origem === "bpo" && bpo === null)
      listarBpoDisponiveisRegularizacao().then((r) => setBpo(exigirResultado(r))).catch(() => setBpo([]));
  }, [origem, bpo]);
  const valido = !!itemId && !!valor && Number(valor) > 0 && !!data && (origem === "manual" || !!bpoId);
  return (
    <Modal titulo="Registrar recebimento" onFechar={onFechar}>
      <label className={labelCls}>Item
        <select className={`${inputCls} mt-1 normal-case font-normal`} value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </label>
      <label className={labelCls}>Origem
        <select className={`${inputCls} mt-1 normal-case font-normal`} value={origem} onChange={(e) => setOrigem(e.target.value as "manual" | "bpo")}>
          <option value="manual">Recebimento manual</option>
          <option value="bpo">Vincular receita do BPO Financeiro</option>
        </select>
      </label>
      {origem === "bpo" && (
        <label className={labelCls}>Receita do BPO (recebida)
          <select className={`${inputCls} mt-1 normal-case font-normal`} value={bpoId} onChange={(e) => {
            setBpoId(e.target.value);
            const b = bpo?.find((x) => x.id === e.target.value);
            if (b) setValor((b.disponivelCentavos / 100).toFixed(2));
          }}>
            <option value="">{bpo === null ? "Carregando..." : "Selecione"}</option>
            {(bpo ?? []).map((b) => <option key={b.id} value={b.id}>{b.descricao} · disponível {brl(b.disponivelCentavos)}</option>)}
          </select>
          {bpo?.length === 0 && <span className="block text-[11px] text-gray-600 normal-case font-normal mt-1">Nenhuma receita recebida com saldo disponível no BPO.</span>}
          <span className="block text-[11px] text-gray-600 normal-case font-normal mt-1">Pode usar parte do valor; o restante continua disponível. A mesma receita nunca é usada duas vezes (obras e regularizações somadas).</span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><p className={labelCls}>Valor</p><CampoDecimal valor={valor} onChange={setValor} prefixo="R$" placeholder="0,00" ariaLabel="Valor" /></div>
        <label className={labelCls}>Data<input type="date" className={`${inputCls} mt-1`} value={data} onChange={(e) => setData(e.target.value)} /></label>
      </div>
      <label className={labelCls}>Observação (opcional)<textarea className={`${inputCls} mt-1 normal-case font-normal`} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label>
      {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      <button type="button" className={botaoPri} disabled={!valido || pendente}
        onClick={() => executar(() => adicionarRecebimentoRegularizacao({
          regularizacaoId, itemId, valor: valor!, data,
          observacao: observacao || undefined,
          bpoLancamentoId: origem === "bpo" ? bpoId : undefined,
        }), onFechar)}>
        {pendente ? "Registrando..." : "Registrar"}
      </button>
    </Modal>
  );
}
