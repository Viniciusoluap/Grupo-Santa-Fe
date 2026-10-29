"use client";

// Pedido de 25/10: BPO › Bancos — contas por API (Asaas, Pluggy/Meu Pluggy) e importação de
// extrato (planilha, OFX, PDF) com prévia, sempre respeitando a data inicial de cada conta.
// Gêmeo de Prospecta/client/src/pages/admin/BancosPanel.tsx (visual do Santa Fé).
import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida } from "@/lib/bpo-lote";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { Building2, FileUp, Link2, ListOrdered, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { exigirResultado } from "@/lib/acao-resultado";
import {
  atualizarContaBancaria,
  atualizarStatusTransacao,
  classificarTransacaoAcao,
  confirmarImportacaoExtrato,
  criarContaBancaria,
  excluirContaBancaria,
  previaLimpezaContaBancaria,
  type PreviaLimpezaBpo,
  importarItemPluggy,
  listarTransacoesConta,
  previaImportacaoExtrato,
  reprocessarMovimentacoesAcao,
  sincronizarContaBancaria,
  tokenConexaoPluggy,
} from "@/lib/actions/banco";
import { CATEGORIAS_BPO } from "@/lib/bpo-categorias";

export interface ContaBancoPainel {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string;
  tipo: string;
  descricao: string | null;
  saldoAtual: number;
  provedor: string;
  dataInicial: string | null;
  ultimoErro: string | null;
  ultimaSincronizacao: string | null;
  /** LOTE C: data do saldo informado pelo extrato importado (se houver). */
  saldoExtratoData?: string | null;
}

type Transacao = { id: string; data: string; descricao: string; descricaoOriginal?: string | null; titular?: string | null; valor: number; tipo: string; categoria: string | null; status: string; origem: string; clienteId: string | null };
type LinhaPrevia = { data: string; descricao: string; titular?: string; original?: string; valor: number; tipo: "credito" | "debito"; jaImportada: boolean };
type Previa = { formato: string; linhas: LinhaPrevia[]; ignoradas: number; antesDaDataInicial: number; dataInicial: string | null; saldo: { valor: number; data: string | null } | null };

const PROVEDOR: Record<string, string> = { asaas: "API do Asaas", pluggy: "Pluggy (Meu Pluggy)", manual: "Importação de extrato" };
const dataBR = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");
// Vercel aceita até 4,5 MB por requisição; extratos costumam ter bem menos.
const LIMITE_ENVIO = 4 * 1024 * 1024;

const campo = "w-full border border-gray-300 px-3 py-2 text-sm text-[var(--brand-dark)] bg-white focus:outline-none focus:border-[var(--brand-yellow)]";
const rotulo = "block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1";
const ajuda = "text-[11px] text-gray-700 mt-1";
const botaoPri = "inline-flex items-center justify-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors disabled:opacity-50";
const botaoSec = "inline-flex items-center gap-1 text-xs font-bold border border-gray-300 text-gray-800 px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50";

function Modal({ titulo, onClose, largo, children }: { titulo: string; onClose: () => void; largo?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white w-full ${largo ? "max-w-3xl" : "max-w-md"} mx-4 shadow-2xl max-h-[90dvh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">{titulo}</h2>
          <button onClick={onClose} className="text-gray-700 hover:text-[var(--brand-dark)]" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function BancosPanel({
  contas,
  clientes = [],
  pluggy,
  abrirNovaConta = 0,
}: {
  contas: ContaBancoPainel[];
  /** LOTE C: clientes BPO para vincular a cada movimentação. */
  clientes?: { id: string; razaoSocial: string }[];
  pluggy: { configured: boolean; active: boolean };
  /** Muda de valor quando o botão "Adicionar Conta" do topo do BPO é clicado. */
  abrirNovaConta?: number;
}) {
  const router = useRouter();
  const [ocupado, startTransition] = useTransition();
  const atualizar = () => router.refresh();
  /** Executa uma action, mostra o erro em português e atualiza a tela. */
  function executar<T>(fn: () => Promise<T>, ok?: (r: T) => void) {
    startTransition(async () => {
      try { const r = await fn(); ok?.(r); atualizar(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Operação falhou."); }
    });
  }

  // ── Pluggy — LOTE B (25/10): Client ID/Secret ficam só em Configurações › Integrações. ──
  function importarItem(itemId: string) {
    executar(async () => exigirResultado(await importarItemPluggy({ itemId, dataInicial: null })), (r) => {
      toast.success(`${r.encontradas} conta(s) encontrada(s), ${r.criadas} cadastrada(s).`);
    });
  }
  async function conectarMeuPluggy() {
    try {
      const { accessToken } = exigirResultado(await tokenConexaoPluggy());
      const { PluggyConnect } = await import("pluggy-connect-sdk");
      const pc = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: false,
        onSuccess: ({ item }) => importarItem(item.id),
        onError: (e) => { toast.error(e.message); },
      });
      await pc.init();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a Pluggy.");
    }
  }

  // ── Nova conta (Asaas ou importação) ──
  const vazio = { provedor: "asaas" as "asaas" | "manual", banco: "Asaas", conta: "", descricao: "", dataInicial: "" };
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState(vazio);
  const [pedidoAtendido, setPedidoAtendido] = useState(abrirNovaConta);
  if (abrirNovaConta !== pedidoAtendido) { setPedidoAtendido(abrirNovaConta); setNovaOpen(true); }

  // ── Ajustar data inicial (a chave do Asaas é a central, em Integrações) ──
  const [edit, setEdit] = useState<{ id: string; dataInicial: string } | null>(null);
  // Lote 3, item 13B: prévia completa e confirmação digitando EXCLUIR (antes era prompt com o nome da conta).
  const [limpeza, setLimpeza] = useState<PreviaLimpezaBpo | null>(null);
  const [confirmacaoLimpeza, setConfirmacaoLimpeza] = useState("");

  // ── Movimentações ──
  const [verConta, setVerConta] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  async function carregarTransacoes(contaId: string) {
    try { setTransacoes(exigirResultado(await listarTransacoesConta(contaId))); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao ler as movimentações."); }
  }
  /** LOTE C: categoria / cliente BPO da movimentação (atualiza o lançamento vinculado). */
  function classificar(contaId: string, t: Transacao, input: { categoria?: string; clienteId?: string | null }) {
    setTransacoes((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...input } : x)));
    executar(async () => exigirResultado(await classificarTransacaoAcao(t.id, input)), () => void carregarTransacoes(contaId));
  }
  function alternarMovimentacoes(contaId: string) {
    if (verConta === contaId) { setVerConta(null); return; }
    setVerConta(contaId); setTransacoes([]); void carregarTransacoes(contaId);
  }

  // ── Importação ──
  const [imp, setImp] = useState<{ contaId: string; nome: string } | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [anoPadrao, setAnoPadrao] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  function fecharImportacao() { setImp(null); setArquivo(null); setPrevia(null); setAnoPadrao(""); }
  function lerArquivo() {
    if (!imp || !arquivo) return;
    if (arquivo.size > LIMITE_ENVIO) { toast.error("Arquivo acima de 4 MB. Exporte um período menor (ou prefira OFX/CSV)."); return; }
    const fd = new FormData();
    fd.set("contaId", imp.contaId);
    fd.set("arquivo", arquivo);
    if (anoPadrao) fd.set("anoPadrao", anoPadrao);
    startTransition(async () => {
      try { setPrevia(exigirResultado(await previaImportacaoExtrato(fd))); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
    });
  }
  const novas = previa?.linhas.filter((l) => !l.jaImportada).length ?? 0;

  return (
    <div className="space-y-5">
      <Toaster richColors position="top-right" />

      {/* Contas */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">Contas Bancárias ({contas.length})</h2>
        <div className="flex gap-2 flex-wrap">
          {/* LOTE C: gera no BPO os lançamentos que faltam (sem duplicar) e recalcula os saldos. */}
          <button className={botaoSec} disabled={ocupado}
            onClick={() => executar(async () => exigirResultado(await reprocessarMovimentacoesAcao()), (r) => {
              toast.success(`${r.criados} lançamento(s) gerado(s) no BPO; ${r.categorizadas} movimentação(ões) categorizada(s).`);
              if (verConta) void carregarTransacoes(verConta);
            })}>
            <RefreshCw size={11} /> Reprocessar movimentações
          </button>
          <button onClick={() => setNovaOpen(true)} className={botaoPri}><Plus size={12} /> Conta Bancária</button>
        </div>
      </div>

      {contas.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 p-12 text-center">
          <Building2 size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-800 font-medium">Nenhuma conta bancária cadastrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contas.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--brand-dark)] text-sm">
                    {c.banco}{c.descricao ? ` — ${c.descricao}` : ""}{c.conta && c.conta !== "—" ? ` • ${c.conta}` : ""}
                  </p>
                  <p className="text-xs text-gray-700">
                    {PROVEDOR[c.provedor] ?? c.provedor} • a partir de {dataBR(c.dataInicial)}
                    {c.ultimaSincronizacao ? ` • última sinc. ${new Date(c.ultimaSincronizacao).toLocaleString("pt-BR")}` : ""}
                  </p>
                  {c.ultimoErro && <p className="text-xs text-red-700 font-medium mt-1">Último erro: {c.ultimoErro}</p>}
                </div>
                <div className="text-right">
                  <span className={`font-black text-lg leading-none ${c.saldoAtual >= 0 ? "text-[var(--brand-dark)]" : "text-red-700"}`}>{formatCurrency(c.saldoAtual)}</span>
                  {c.provedor === "manual" && (
                    <p className="text-[10px] text-gray-700 mt-0.5">
                      {c.saldoExtratoData ? `saldo do extrato em ${dataBR(c.saldoExtratoData)} + movimentações seguintes` : "soma das movimentações importadas"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(c.provedor === "asaas" || c.provedor === "pluggy") && (
                  <button className={botaoSec} disabled={ocupado}
                    onClick={() => executar(async () => exigirResultado(await sincronizarContaBancaria(c.id)), (r) => {
                      if (r.ok) toast.success(r.mensagem); else toast.error(r.mensagem);
                      if (verConta === c.id) void carregarTransacoes(c.id);
                    })}>
                    <RefreshCw size={11} className={ocupado ? "animate-spin" : ""} /> Sincronizar
                  </button>
                )}
                <button className={botaoSec} onClick={() => setImp({ contaId: c.id, nome: c.descricao || c.banco })}><FileUp size={11} /> Importar extrato</button>
                <button className={botaoSec} onClick={() => alternarMovimentacoes(c.id)}><ListOrdered size={11} /> {verConta === c.id ? "Ocultar" : "Movimentações"}</button>
                <button className={botaoSec} onClick={() => setEdit({ id: c.id, dataInicial: c.dataInicial ?? "" })}>
                  Data inicial
                </button>
                <button className="inline-flex items-center gap-1 text-xs font-bold border border-red-300 text-red-700 px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50" disabled={ocupado}
                  onClick={() => executar(async () => exigirResultado(await previaLimpezaContaBancaria(c.id)), (p) => { setLimpeza(p); setConfirmacaoLimpeza(""); })}>
                  <Trash2 size={11} /> Remover
                </button>
              </div>
              {verConta === c.id && (
                <div className="max-h-80 overflow-y-auto border-t border-gray-200 pt-2">
                  {transacoes.length === 0 ? <p className="text-xs text-gray-700">Nenhuma movimentação.</p> : (
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        {transacoes.map((t) => (
                          <tr key={t.id}>
                            <td className="py-1.5 pr-2 text-gray-700 whitespace-nowrap">{new Date(t.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                            <td className="py-1.5 pr-2 text-[var(--brand-dark)]">
                              <span className="block">{t.descricao}</span>
                              {t.titular && <span className="block text-[10px] font-bold text-gray-600">Titular: {t.titular}</span>}
                            </td>
                            <td className="py-1.5 pr-2">
                              <select aria-label="Categoria" value={t.categoria ?? ""} disabled={ocupado}
                                onChange={(e) => classificar(c.id, t, { categoria: e.target.value })}
                                className="border border-gray-300 px-1.5 py-1 text-[11px] text-[var(--brand-dark)] bg-white max-w-[150px]">
                                {!t.categoria && <option value="">Categoria…</option>}
                                {CATEGORIAS_BPO.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select aria-label="Cliente BPO" value={t.clienteId ?? ""} disabled={ocupado}
                                onChange={(e) => classificar(c.id, t, { clienteId: e.target.value || null })}
                                className="border border-gray-300 px-1.5 py-1 text-[11px] text-[var(--brand-dark)] bg-white max-w-[150px]">
                                <option value="">Sem cliente</option>
                                {clientes.map((cl) => <option key={cl.id} value={cl.id}>{cl.razaoSocial}</option>)}
                              </select>
                            </td>
                            <td className={`py-1.5 pr-2 text-right whitespace-nowrap font-bold ${t.tipo === "credito" ? "text-green-700" : "text-red-700"}`}>
                              {t.tipo === "debito" ? "-" : ""}{formatCurrency(t.valor)}
                            </td>
                            <td className="py-1.5 text-right whitespace-nowrap">
                              {t.status === "pendente" ? (
                                <span className="inline-flex gap-1">
                                  <button className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-800 border border-green-300 hover:bg-green-100"
                                    onClick={() => executar(() => atualizarStatusTransacao(t.id, "conciliado"), () => void carregarTransacoes(c.id))}>Conciliar</button>
                                  <button className="text-[10px] font-bold px-2 py-0.5 bg-white text-gray-800 border border-gray-300 hover:bg-gray-50"
                                    onClick={() => executar(() => atualizarStatusTransacao(t.id, "ignorado"), () => void carregarTransacoes(c.id))}>Ignorar</button>
                                </span>
                              ) : (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 uppercase ${t.status === "conciliado" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{t.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pluggy */}
      <div className="bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">Pluggy — contas conectadas pelo Meu Pluggy (gratuito)</h2>
        <p className="text-sm text-gray-800">
          {pluggy.configured ? "Client ID e Client Secret configurados em " : "Client ID e Client Secret ainda não configurados — informe em "}
          <Link href="/admin/integracoes" className="underline font-bold text-[var(--brand-dark)]">Configurações › Integrações</Link>.
          {" "}As contas conectadas no Meu Pluggy são lidas sem custo e sincronizadas todo dia.
        </p>
        {pluggy.configured && (
          <div className="border-t border-gray-200 pt-4">
            <button className={botaoSec} disabled={ocupado} onClick={conectarMeuPluggy}><Link2 size={11} /> Conectar conta Pluggy</button>
          </div>
        )}
      </div>

      {/* Nova conta */}
      {novaOpen && (
        <Modal titulo="Nova conta bancária" onClose={() => setNovaOpen(false)}>
          <div>
            <label className={rotulo}>Como as movimentações chegam</label>
            <select value={nova.provedor} onChange={(e) => { const v = e.target.value as "asaas" | "manual"; setNova((n) => ({ ...n, provedor: v, banco: v === "asaas" ? "Asaas" : "" })); }} className={campo}>
              <option value="asaas">API do Asaas (automático)</option>
              <option value="manual">Importação de extrato (Cora, C6, Inter ou outro)</option>
            </select>
            <p className={ajuda}>Contas do Meu Pluggy entram pelo quadro &quot;Pluggy&quot; abaixo.</p>
          </div>
          <div><label className={rotulo}>Banco *</label><input value={nova.banco} onChange={(e) => setNova((n) => ({ ...n, banco: e.target.value }))} className={campo} placeholder="ex.: Cora" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={rotulo}>Conta</label><input value={nova.conta} onChange={(e) => setNova((n) => ({ ...n, conta: e.target.value }))} className={campo} /></div>
            <div><label className={rotulo}>Descrição</label><input value={nova.descricao} onChange={(e) => setNova((n) => ({ ...n, descricao: e.target.value }))} className={campo} placeholder="ex.: Conta PJ" /></div>
          </div>
          {nova.provedor === "asaas" && (
            <p className={ajuda}>
              Usa a chave do Asaas configurada em <Link href="/admin/integracoes" className="underline font-bold">Configurações › Integrações</Link>.
            </p>
          )}
          <div>
            <label className={rotulo}>Considerar movimentações a partir de</label>
            <input type="date" value={nova.dataInicial} onChange={(e) => setNova((n) => ({ ...n, dataInicial: e.target.value }))} className={campo} />
            <p className={ajuda}>Movimentações anteriores a esta data não são gravadas (não pertencem a esta empresa).</p>
          </div>
          <button className={`${botaoPri} w-full`} disabled={ocupado || !nova.banco}
            onClick={() => executar(async () => exigirResultado(await criarContaBancaria({
              provedor: nova.provedor, banco: nova.banco, conta: nova.conta || undefined, descricao: nova.descricao || undefined,
              dataInicial: nova.dataInicial || null,
            })), () => { toast.success("Conta cadastrada."); setNovaOpen(false); setNova(vazio); })}>
            {ocupado ? "Validando..." : "Cadastrar conta"}
          </button>
        </Modal>
      )}

      {/* Excluir conta (13B) */}
      {limpeza && (
        <Modal titulo="Excluir conta e dados importados" onClose={() => setLimpeza(null)}>
          <p className="text-sm">Conta: <strong>{limpeza.rotulo}</strong></p>
          <div className="space-y-1 border border-gray-200 p-3 text-sm">
            <p><strong>{limpeza.transacoes}</strong> movimentação(ões) bancária(s) serão removidas</p>
            <p><strong>{limpeza.lancamentosRemovidos}</strong> lançamento(s) exclusivamente importado(s) do extrato serão removidos</p>
            <p><strong>{limpeza.lancamentosPreservados}</strong> lançamento(s) serão preservados (Asaas, manuais ou usados em Obras/Regularizações) — apenas desconciliados</p>
            <p><strong>{limpeza.vinculosOperacionais}</strong> vínculo(s) com Obras/Regularizações serão mantidos</p>
          </div>
          <p className={ajuda}>Antes de remover, é gravado um backup (conta, movimentações e lançamentos) com o seu usuário e a data, para auditoria e recuperação. A credencial da conta não entra no backup; a conta fica inativa.</p>
          <div>
            <label className={rotulo}>Para confirmar, digite {CONFIRMACAO_EXCLUSAO}</label>
            <input value={confirmacaoLimpeza} onChange={(e) => setConfirmacaoLimpeza(e.target.value)} autoComplete="off" className={campo} />
          </div>
          <button className="w-full bg-red-700 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50" disabled={ocupado || !confirmacaoExclusaoValida(confirmacaoLimpeza)}
            onClick={() => executar(async () => exigirResultado(await excluirContaBancaria(limpeza.contaId, confirmacaoLimpeza)), (r) => {
              toast.success(`Conta excluída. Backup ${r.backupId} registrado por ${r.excluidaPor} em ${new Date(r.excluidaEm).toLocaleString("pt-BR")}; ${r.lancamentosPreservados} lançamento(s) preservado(s).`);
              setLimpeza(null);
            })}>{ocupado ? "Criando backup e excluindo..." : "Excluir conta com backup"}</button>
        </Modal>
      )}

      {/* Ajustar conta */}
      {edit && (
        <Modal titulo="Ajustar conta" onClose={() => setEdit(null)}>
          <div>
            <label className={rotulo}>Considerar movimentações a partir de</label>
            <input type="date" value={edit.dataInicial} onChange={(e) => setEdit({ ...edit, dataInicial: e.target.value })} className={campo} />
            <p className={ajuda}>Vale para as próximas sincronizações e importações. O que já foi gravado continua.</p>
          </div>
          <button className={`${botaoPri} w-full`} disabled={ocupado}
            onClick={() => executar(async () => exigirResultado(await atualizarContaBancaria({ id: edit.id, dataInicial: edit.dataInicial || null })),
              () => { toast.success("Conta atualizada."); setEdit(null); })}>Salvar</button>
        </Modal>
      )}

      {/* Importação */}
      {imp && (
        <Modal titulo={`Importar extrato — ${imp.nome}`} onClose={fecharImportacao} largo>
          {!previa ? (
            <>
              <p className="text-sm text-gray-800">Aceita planilha (CSV, Excel), OFX ou PDF. Prefira OFX ou CSV quando o banco oferecer: a leitura é mais precisa que a do PDF.</p>
              <input type="file" accept=".csv,.txt,.xlsx,.xls,.ofx,.pdf" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); }} className={campo} />
              {arquivo?.name.toLowerCase().endsWith(".pdf") && (
                <div><label className={rotulo}>Ano do extrato (se as datas do PDF vierem sem ano)</label><input type="number" value={anoPadrao} onChange={(e) => setAnoPadrao(e.target.value)} className={campo} placeholder={String(new Date().getFullYear())} /></div>
              )}
              <button className={botaoPri} disabled={!arquivo || ocupado} onClick={lerArquivo}>{ocupado ? "Lendo..." : "Ler arquivo e mostrar prévia"}</button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-800">
                {previa.formato}: <b>{novas}</b> lançamento(s) novo(s){previa.linhas.length - novas ? `, ${previa.linhas.length - novas} já importado(s)` : ""}
                {previa.antesDaDataInicial ? `, ${previa.antesDaDataInicial} anterior(es) a ${dataBR(previa.dataInicial)} (descartados)` : ""}
                {previa.ignoradas ? `, ${previa.ignoradas} linha(s) não reconhecida(s)` : ""}.
                {previa.saldo ? ` Saldo informado no arquivo: ${formatCurrency(previa.saldo.valor)}${previa.saldo.data ? ` em ${dataBR(previa.saldo.data)}` : ""}.` : " O arquivo não traz saldo: o saldo da conta será a soma das movimentações."}
              </p>
              <div className="max-h-96 overflow-y-auto border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--brand-dark)]">
                    <tr className="text-white"><th className="text-left p-2">Data</th><th className="text-left p-2">Descrição</th><th className="text-right p-2">Valor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previa.linhas.slice(0, 500).map((l, i) => (
                      <tr key={i} className={l.jaImportada ? "bg-gray-100" : ""}>
                        <td className="p-2 whitespace-nowrap text-gray-800">{dataBR(l.data)}</td>
                        <td className="p-2 text-[var(--brand-dark)]">{l.descricao}{l.jaImportada ? <span className="text-gray-700 italic"> (já importado)</span> : ""}</td>
                        <td className={`p-2 text-right whitespace-nowrap font-bold ${l.tipo === "credito" ? "text-green-700" : "text-red-700"}`}>{l.tipo === "debito" ? "-" : ""}{formatCurrency(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previa.linhas.length > 500 && <p className="text-xs text-gray-700">Mostrando 500 de {previa.linhas.length}; todos serão importados.</p>}
              <div className="flex gap-2 flex-wrap">
                <button className={botaoSec} onClick={() => setPrevia(null)}>Escolher outro arquivo</button>
                <button className={botaoPri} disabled={!novas || ocupado}
                  onClick={() => executar(
                    async () => exigirResultado(await confirmarImportacaoExtrato(imp.contaId, previa.linhas.map((l) => ({ data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo })), previa.saldo)),
                    (r) => {
                      toast.success(`${r.novos} lançamento(s) importado(s).${r.recebidos - r.novos > 0 ? ` ${r.recebidos - r.novos} já existiam.` : ""}`);
                      if (verConta === imp.contaId) void carregarTransacoes(imp.contaId);
                      fecharImportacao();
                    },
                  )}>
                  {ocupado ? "Importando..." : `Importar ${novas} lançamento(s)`}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
