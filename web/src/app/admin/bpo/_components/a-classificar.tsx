"use client";
// Paridade BPO (13/11): aba "A classificar" (gêmeo de Prospecta client/src/components/bpo/AClassificar.tsx).
// Nada do banco entra em Cobranças/Despesas/DRE sem o dono classificar, exceto o que o sistema já liga com segurança
// (Asaas conhecido, Conta Azul pago, regra por titular).
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/lib/utils";
import { exigirResultado } from "@/lib/acao-resultado";
import { CATEGORIAS_BPO, TRANSFERENCIA_INTERNA, ehDespesa, normalizarTitular } from "@/lib/bpo-categorias";
import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida, type ResumoExclusao } from "@/lib/bpo-lote";
import { abertosParaBaixaAcao, confirmarAClassificar, criarLancamentosAClassificar, darBaixaAcao, ignorarAClassificar } from "@/lib/actions/bpo-paridade";
import { excluirLancamentosEmLote, previaExclusaoLote } from "@/lib/actions/bpo-lote";
import { CampoCentroCusto, type CentroCustoOpcao } from "./centros-custo";

const CATEGORIAS = CATEGORIAS_BPO.filter((c) => c !== TRANSFERENCIA_INTERNA);
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const cls = "mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 normal-case";
const botao = "border border-gray-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const perigo = "border border-red-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50";
const principal = "w-full bg-[var(--brand-yellow)] py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-dark)] disabled:opacity-50";

type Cliente = { id: string; razaoSocial: string };
export type MovimentacaoAClassificar = {
  id: string; data: string; descricao: string; valor: number; tipo: string; categoria: string | null;
  titular: string | null; bpoClienteId: string | null; conta: string;
};
export type LancamentoAClassificar = {
  id: string; tipo: string; descricao: string; valor: number; valorRecebido: number; vencimento: string; competencia: string;
  pago: boolean; categoria: string | null; centroCustos: string | null; clienteNome: string | null; clienteId: string | null;
  asaasPaymentId: string | null; transacaoId: string | null; version: number;
};

export function AClassificarPanel({ movimentacoes, lancamentos, totalMovs, totalLancs, clientes, centros, onReceber, onMarcarPago, onMensagem }: {
  /** Já filtradas pela tela (os totais mostram quantas existem). */
  movimentacoes: MovimentacaoAClassificar[]; lancamentos: LancamentoAClassificar[]; totalMovs: number; totalLancs: number;
  clientes: Cliente[]; centros: CentroCustoOpcao[];
  onReceber: (l: LancamentoAClassificar) => void; onMarcarPago: (id: string) => void; onMensagem: (m: string) => void;
}) {
  const router = useRouter();
  const [selMovs, setSelMovs] = useState<string[]>([]);
  const [selLancs, setSelLancs] = useState<string[]>([]);
  const [criando, setCriando] = useState<string[] | null>(null);
  const [cancelando, setCancelando] = useState<string[] | null>(null);
  const [baixando, setBaixando] = useState<MovimentacaoAClassificar | null>(null);
  const [pendente, iniciar] = useTransition();
  // Só age sobre o que está visível (o filtro esconde o resto).
  const visMovs = new Set(movimentacoes.map((m) => m.id));
  const visLancs = new Set(lancamentos.map((l) => l.id));
  const movsSel = selMovs.filter((id) => visMovs.has(id));
  const lancsSel = selLancs.filter((id) => visLancs.has(id));
  const executar = (fn: () => Promise<string>, depois?: () => void) => iniciar(async () => {
    try { onMensagem(await fn()); depois?.(); router.refresh(); }
    catch (e) { onMensagem(e instanceof Error ? e.message : "Falha na operação."); }
  });
  const ignorar = (ids: string[]) => executar(async () => `${exigirResultado(await ignorarAClassificar(ids)).ignoradas} movimentação(ões) marcada(s) como transferência interna.`, () => setSelMovs([]));
  const confirmar = (ids: string[]) => executar(async () => `${exigirResultado(await confirmarAClassificar(ids)).confirmados} lançamento(s) confirmado(s) — agora em Cobranças/Despesas.`, () => setSelLancs([]));
  const liquido = (xs: { valor: number; tipo: string }[]) => xs.reduce((t, x) => t + (x.tipo === "debito" || ehDespesa(x.tipo) ? -1 : 1) * Math.round(x.valor * 100), 0) / 100;

  return (
    <div className="space-y-6">
      <section className="space-y-3 border border-gray-100 bg-white p-4">
        <h2 className="font-black uppercase text-[var(--brand-dark)]">Movimentações do banco ({movimentacoes.length}{movimentacoes.length !== totalMovs ? ` de ${totalMovs}` : ""})</h2>
        <p className="text-xs text-gray-500">Chegaram do banco sem correspondência segura. Só entram em Cobranças, Despesas e DRE quando você criar o lançamento ou der baixa. Saldo líquido das visíveis: {formatCurrency(liquido(movimentacoes))}.</p>
        <div className="flex flex-wrap items-center gap-2 border border-gray-100 bg-gray-50 p-2 text-xs">
          <label className="flex items-center gap-2 font-bold text-gray-600">
            <input type="checkbox" aria-label="Selecionar todas as movimentações visíveis" checked={movimentacoes.length > 0 && movimentacoes.every((m) => selMovs.includes(m.id))}
              onChange={(e) => setSelMovs(e.target.checked ? movimentacoes.map((m) => m.id) : [])} />
            Selecionar todas ({movimentacoes.length})
          </label>
          <span className="text-gray-500">{movsSel.length} selecionada(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={botao} disabled={!movsSel.length} onClick={() => setCriando(movsSel)}>Criar lançamento</button>
            <button type="button" className={botao} disabled={!movsSel.length || pendente} onClick={() => ignorar(movsSel)}>Transferência interna / ignorar</button>
          </div>
        </div>
        {movimentacoes.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhuma movimentação esperando classificação.</p> : (
          <ul className="space-y-2">
            {movimentacoes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 border border-gray-100 p-3">
                <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`Selecionar ${m.descricao}`} checked={selMovs.includes(m.id)}
                  onChange={(e) => setSelMovs(e.target.checked ? [...selMovs, m.id] : selMovs.filter((x) => x !== m.id))} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words font-medium text-[var(--brand-dark)]">{m.titular ? `${m.titular} — ` : ""}{m.descricao}</p>
                  <p className="text-xs text-gray-500">{dataBR(m.data)} • {m.conta} • {m.tipo === "credito" ? "entrada" : "saída"}{m.categoria ? ` • sugestão: ${m.categoria}` : ""}</p>
                </div>
                <span className={`font-bold ${m.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>{m.tipo === "credito" ? "" : "−"}{formatCurrency(m.valor)}</span>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button type="button" className={botao} onClick={() => setCriando([m.id])}>Criar lançamento</button>
                  <button type="button" className={botao} onClick={() => setBaixando(m)}>Dar baixa / dividir</button>
                  <button type="button" className={botao} disabled={pendente} onClick={() => ignorar([m.id])}>Transferência interna / ignorar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border border-gray-100 bg-white p-4">
        <h2 className="font-black uppercase text-[var(--brand-dark)]">Lançamentos em aberto a classificar ({lancamentos.length}{lancamentos.length !== totalLancs ? ` de ${totalLancs}` : ""})</h2>
        <p className="text-xs text-gray-500">Em aberto que vieram de fora (ex.: backup do Conta Azul). Ficam fora de Cobranças, Despesas, DRE e totais até você confirmar. Total visível: {formatCurrency(liquido(lancamentos))}.</p>
        <div className="flex flex-wrap items-center gap-2 border border-gray-100 bg-gray-50 p-2 text-xs">
          <label className="flex items-center gap-2 font-bold text-gray-600">
            <input type="checkbox" aria-label="Selecionar todos os lançamentos visíveis" checked={lancamentos.length > 0 && lancamentos.every((l) => selLancs.includes(l.id))}
              onChange={(e) => setSelLancs(e.target.checked ? lancamentos.map((l) => l.id) : [])} />
            Selecionar todos ({lancamentos.length})
          </label>
          <span className="text-gray-500">{lancsSel.length} selecionado(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={botao} disabled={!lancsSel.length || pendente} onClick={() => confirmar(lancsSel)}>Confirmar</button>
            <button type="button" className={perigo} disabled={!lancsSel.length} onClick={() => setCancelando(lancsSel)}>Cancelar</button>
          </div>
        </div>
        {lancamentos.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum lançamento esperando classificação.</p> : (
          <ul className="space-y-2">
            {lancamentos.map((l) => {
              const saldo = (Math.round(l.valor * 100) - Math.round(l.valorRecebido * 100)) / 100;
              const recebivel = !l.asaasPaymentId && !l.transacaoId;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 border border-gray-100 p-3">
                  <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`Selecionar ${l.descricao}`} checked={selLancs.includes(l.id)}
                    onChange={(e) => setSelLancs(e.target.checked ? [...selLancs, l.id] : selLancs.filter((x) => x !== l.id))} />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="break-words font-medium text-[var(--brand-dark)]">{l.descricao}</p>
                    <p className="text-xs text-gray-500">
                      {l.clienteNome || "—"} • {ehDespesa(l.tipo) ? "Despesa" : "Cobrança"} • {l.categoria || "sem categoria"} • vence {dataBR(l.vencimento)} • comp. {l.competencia}
                      {l.centroCustos ? ` • centro de custo: ${l.centroCustos}` : ""}
                    </p>
                    {l.valorRecebido > 0 && <p className="text-xs text-gray-600">{ehDespesa(l.tipo) ? "Pago" : "Recebido"} {formatCurrency(l.valorRecebido)} · Saldo {formatCurrency(saldo)}</p>}
                  </div>
                  <span className={`font-bold ${ehDespesa(l.tipo) ? "text-red-600" : "text-green-600"}`}>{formatCurrency(l.valor)}</span>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button type="button" className={botao} disabled={pendente} onClick={() => confirmar([l.id])}>Confirmar</button>
                    {recebivel
                      ? <button type="button" className={botao} onClick={() => onReceber(l)}>{ehDespesa(l.tipo) ? "Registrar pagamento" : "Registrar recebimento"}</button>
                      : <button type="button" className={botao} disabled={pendente} onClick={() => onMarcarPago(l.id)}>Marcar pago</button>}
                    <button type="button" className={perigo} onClick={() => setCancelando([l.id])}>Cancelar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {criando && <CriarLancamentoModal ids={criando} movs={movimentacoes.filter((m) => criando.includes(m.id))} clientes={clientes} centros={centros}
        onFechar={(m) => { setCriando(null); if (m) { setSelMovs([]); onMensagem(m); router.refresh(); } }} />}
      {baixando && <DarBaixaModal mov={baixando} onFechar={(m) => { setBaixando(null); if (m) { onMensagem(m); router.refresh(); } }} />}
      {cancelando && <CancelarModal ids={cancelando} onFechar={(m) => { setCancelando(null); if (m) { setSelLancs([]); onMensagem(m); router.refresh(); } }} />}
    </div>
  );
}

function CriarLancamentoModal({ ids, movs, clientes, centros, onFechar }: { ids: string[]; movs: MovimentacaoAClassificar[]; clientes: Cliente[]; centros: CentroCustoOpcao[]; onFechar: (m?: string) => void }) {
  const um = movs.length === 1 ? movs[0] : null;
  const sugestao = um && um.categoria && (CATEGORIAS as readonly string[]).includes(um.categoria) ? um.categoria : "";
  const [categoria, setCategoria] = useState<string>(sugestao);
  // "manter" = cada movimentação fica com o cliente que já tinha (sugerido pelo titular).
  const [cliente, setCliente] = useState<string>(um?.bpoClienteId ?? "manter");
  const [centroCustos, setCentroCustos] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const total = movs.reduce((t, m) => t + (m.tipo === "credito" ? 1 : -1) * Math.round(m.valor * 100), 0);
  return (
    <Modal titulo={`Criar lançamento${ids.length > 1 ? ` (${ids.length} movimentações)` : ""}`} onFechar={() => onFechar()} tamanho="md" classeCorpo="space-y-3 text-sm">
      <p className="text-gray-700">{um ? `${dataBR(um.data)} • ${um.titular ? `${um.titular} — ` : ""}${um.descricao}` : `${movs.length} movimentação(ões) selecionada(s)`} • {formatCurrency(Math.abs(total) / 100)}</p>
      <p className="text-xs text-gray-500">Entrada vira cobrança paga; saída vira despesa paga, na data do banco.</p>
      <div className="grid grid-cols-1 gap-3">
        <label className="block text-xs font-bold text-gray-500 uppercase">Categoria *
          <select aria-label="Categoria" className={cls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Escolha…</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-gray-500 uppercase">Cliente BPO
          <select aria-label="Cliente BPO" className={cls} value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="manter">{um ? "Sem alteração" : "Manter o de cada movimentação"}</option>
            <option value="nenhum">Nenhum</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
          </select>
        </label>
        <CampoCentroCusto centros={centros} valor={centroCustos} onChange={setCentroCustos} />
      </div>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      <button type="button" className={principal} disabled={!categoria || pendente} onClick={() => iniciar(async () => {
        try {
          const r = exigirResultado(await criarLancamentosAClassificar({
            ids, categoria,
            ...(cliente === "manter" ? {} : { bpoClienteId: cliente === "nenhum" ? null : cliente }),
            ...(centroCustos ? { centroCustos } : {}),
          }));
          onFechar(`${r.classificadas} lançamento(s) criado(s).`);
        } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao criar."); }
      })}>{pendente ? "Criando…" : "Criar lançamento"}</button>
    </Modal>
  );
}

/** Cancelar = arquivamento reversível (backup + histórico; volta em Exclusões em lote → Restaurar). */
function CancelarModal({ ids, onFechar }: { ids: string[]; onFechar: (m?: string) => void }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [previa, setPrevia] = useState<ResumoExclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const entrada = useMemo(() => ({ aba: "a_classificar" as const, modo: "selecionados" as const, ids, limpezaAjustes: true }), [ids]);
  useEffect(() => {
    let ativa = true;
    previaExclusaoLote(entrada).then((r) => { if (ativa) { if ("erro" in r) setErro(r.erro); else setPrevia(r); } });
    return () => { ativa = false; };
  }, [entrada]);
  return (
    <Modal titulo={`Cancelar ${ids.length} lançamento(s)`} onFechar={() => onFechar()} tamanho="md" classeCorpo="space-y-3 text-sm">
      <p className="text-gray-700">Os lançamentos saem do BPO, mas nada é apagado: fica um backup e o histórico, e dá para restaurar em Cobranças › Exclusões em lote (administrador).</p>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      {!previa && !erro && <p className="text-gray-500">Calculando…</p>}
      {previa && <>
        <p>Serão cancelados: <strong>{previa.excluiveis}</strong></p>
        <label className="block text-xs font-bold text-gray-500 uppercase">Para confirmar, digite {CONFIRMACAO_EXCLUSAO}
          <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className={cls} />
        </label>
        <button type="button" className="w-full bg-red-700 py-2.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          disabled={!previa.excluiveis || !confirmacaoExclusaoValida(confirmacao) || pendente}
          onClick={() => iniciar(async () => {
            const r = await excluirLancamentosEmLote({ ...entrada, confirmacao, previaToken: previa.previaToken });
            if ("erro" in r) { setErro(r.erro ?? "Falha ao cancelar."); return; }
            onFechar(`${r.excluidos} lançamento(s) cancelado(s)${r.backupId ? ` · backup ${r.backupId}` : ""}.`);
          })}>{pendente ? "Cancelando…" : `Cancelar ${previa.excluiveis} lançamento(s)`}</button>
      </>}
    </Modal>
  );
}

type Abertos = Awaited<ReturnType<typeof abertosParaBaixaAcao>>;
type Aberto = Exclude<Abertos, { erroAcao: string }>["abertos"][number];

/**
 * Dar baixa / dividir: a movimentação quita um ou vários lançamentos em aberto do mesmo sentido (crédito ↔ cobrança,
 * débito ↔ despesa). A soma aplicada tem que ser exatamente o valor da movimentação; valor menor que o saldo de um
 * lançamento é baixa parcial (ele só fica pago quando o recebido fecha o valor).
 */
function DarBaixaModal({ mov, onFechar }: { mov: MovimentacaoAClassificar; onFechar: (m?: string) => void }) {
  const [dados, setDados] = useState<{ abertos: Aberto[]; sugeridos: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState("");
  const [requestEmCurso, iniciar] = useTransition();
  useEffect(() => {
    let ativa = true;
    abertosParaBaixaAcao(mov.id).then((r) => { if (!ativa) return; if ("erroAcao" in r) setErro(r.erroAcao); else setDados(r); });
    return () => { ativa = false; };
  }, [mov.id]);
  const cent = (v: number) => Math.round(v * 100);
  const totalMov = cent(mov.valor);
  const escolhidos = Object.entries(valores).filter(([, v]) => v > 0).map(([id, v]) => ({ lancamentoId: id, valor: v }));
  const soma = escolhidos.reduce((t, a) => t + cent(a.valor), 0);
  const abertos = dados?.abertos ?? [];
  const saldoDe = (l: Aberto) => cent(l.valor) - cent(l.valorRecebido);
  const acimaDoSaldo = escolhidos.some((a) => { const l = abertos.find((x) => x.id === a.lancamentoId); return !l || cent(a.valor) > saldoDe(l); });
  const sugeridos = new Set(dados?.sugeridos ?? []);
  const termo = normalizarTitular(busca);
  const lista = [
    ...(dados?.sugeridos ?? []).map((id) => abertos.find((l) => l.id === id)).filter((l): l is Aberto => Boolean(l)),
    ...abertos.filter((l) => !sugeridos.has(l.id) && (valores[l.id] !== undefined || (termo.length >= 2 && normalizarTitular(`${l.descricao} ${l.clienteNome ?? ""} ${l.valor.toFixed(2)}`).includes(termo)))),
  ];
  const marcar = (l: Aberto, on: boolean) => {
    if (!on) { const resto = { ...valores }; delete resto[l.id]; setValores(resto); return; }
    const restante = Math.max(0, totalMov - soma);
    setValores({ ...valores, [l.id]: Math.min(saldoDe(l), restante) / 100 });
  };
  return (
    <Modal titulo="Dar baixa / dividir" onFechar={() => onFechar()} tamanho="lg" classeCorpo="space-y-3 text-sm">
      <p className="text-gray-700">{dataBR(mov.data)} • {mov.titular ? `${mov.titular} — ` : ""}{mov.descricao} • <strong>{formatCurrency(totalMov / 100)}</strong> ({mov.tipo === "credito" ? "entrada: baixa cobranças" : "saída: baixa despesas"})</p>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      {!dados && !erro && <p className="text-gray-500">Buscando lançamentos em aberto…</p>}
      {dados && <>
        <label className="block text-xs font-bold text-gray-500 uppercase">Procurar outro lançamento em aberto
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="cliente, descrição ou valor" className={cls} />
        </label>
        {lista.length === 0 ? <p className="text-gray-500">{abertos.length ? "Nenhuma sugestão. Procure pelo nome, descrição ou valor." : "Não há lançamentos em aberto deste sentido."}</p> : (
          <ul className="divide-y divide-gray-100 border border-gray-200">
            {lista.map((l) => {
              const marcado = valores[l.id] !== undefined;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-2 p-2">
                  <input type="checkbox" className="h-4 w-4" aria-label={`Usar ${l.descricao}`} checked={marcado} onChange={(e) => marcar(l, e.target.checked)} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="break-words">{l.descricao}{sugeridos.has(l.id) && <span className="ml-1 text-xs font-bold text-yellow-700">sugestão</span>}{l.aClassificar && <span className="ml-1 text-xs text-orange-700">a classificar</span>}</p>
                    <p className="text-xs text-gray-500">{l.clienteNome || "—"} • vence {dataBR(l.vencimento)} • saldo {formatCurrency(saldoDe(l) / 100)}{cent(l.valorRecebido) > 0 ? ` de ${formatCurrency(l.valor)}` : ""}</p>
                  </div>
                  {marcado && <div className="w-full sm:w-40"><CurrencyInput value={valores[l.id]} onValueChange={(v) => setValores({ ...valores, [l.id]: v })} className="border border-gray-200 px-2 py-1" /></div>}
                </li>
              );
            })}
          </ul>
        )}
        <div className={`p-2 ${soma === totalMov && !acimaDoSaldo ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
          Aplicado {formatCurrency(soma / 100)} de {formatCurrency(totalMov / 100)}
          {soma < totalMov ? ` — faltam ${formatCurrency((totalMov - soma) / 100)}` : soma > totalMov ? ` — passou ${formatCurrency((soma - totalMov) / 100)}` : ""}
          {acimaDoSaldo ? " — algum valor passa do saldo do lançamento" : ""}
        </div>
        <p className="text-xs text-gray-500">Valor menor que o saldo = baixa parcial (o lançamento fica em aberto com o saldo). A movimentação sai de A classificar e não vira lançamento próprio.</p>
        <button type="button" className={principal} disabled={!escolhidos.length || soma !== totalMov || acimaDoSaldo || requestEmCurso}
          onClick={() => iniciar(async () => {
            try {
              const r = exigirResultado(await darBaixaAcao({ movimentacaoId: mov.id, alocacoes: escolhidos }));
              const quitados = r.alocacoes.filter((a) => a.pago).length;
              onFechar(`Baixa registrada em ${r.alocacoes.length} lançamento(s): ${quitados} quitado(s), ${r.alocacoes.length - quitados} parcial(is).`);
            } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao dar baixa."); }
          })}>{requestEmCurso ? "Registrando…" : "Confirmar baixa"}</button>
      </>}
    </Modal>
  );
}
