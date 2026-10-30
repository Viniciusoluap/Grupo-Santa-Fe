"use client";
// Lote 3, item 16: ações em lote de Cobranças/Despesas (gêmeo de Prospecta client/src/components/bpo/LoteLancamentos.tsx).
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { combinarPagamentos, excluirLancamentosEmLote, listarExclusoesEmLote, previaCombinacao, previaExclusaoLote, previaRestauracaoExclusao, restaurarExclusaoEmLote, type AbaLote, type ExclusaoEmLoteResumo } from "@/lib/actions/bpo-lote";
import { CONFIRMACAO_RESTAURACAO, confirmacaoRestauracaoValida } from "@/lib/bpo-restauracao";
import { CONFIRMACAO_EXCLUSAO, ROTULOS_PROTECAO, confirmacaoExclusaoValida, type FiltrosLote, type MotivoProtecao, type ResumoExclusao } from "@/lib/bpo-lote";

const botao = "border border-gray-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const perigo = "border border-red-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50";

export function BarraLote({ aba, visiveis, selecionados, setSelecionados, filtros, onSugerirVinculos, onMensagem, podeRestaurar = false }: {
  aba: AbaLote; visiveis: string[]; selecionados: string[]; setSelecionados: (ids: string[]) => void;
  filtros: FiltrosLote; onSugerirVinculos: () => void; onMensagem: (m: string) => void; podeRestaurar?: boolean;
}) {
  const [exclusao, setExclusao] = useState<null | "selecionados" | "tudo">(null);
  const [combinando, setCombinando] = useState(false);
  const [historico, setHistorico] = useState(false);
  const todos = visiveis.length > 0 && visiveis.every((id) => selecionados.includes(id));
  return (
    <div className="flex flex-wrap items-center gap-2 border border-gray-100 bg-white p-2 text-xs">
      <label className="flex items-center gap-2 font-bold text-gray-600">
        <input type="checkbox" checked={todos} aria-label="Selecionar todos da página"
          onChange={(e) => setSelecionados(e.target.checked ? Array.from(new Set([...selecionados, ...visiveis])) : selecionados.filter((id) => !visiveis.includes(id)))} />
        Selecionar todos ({visiveis.length})
      </label>
      <span className="text-gray-500">{selecionados.length} selecionado(s)</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {aba === "cobrancas" && <button type="button" className={botao} disabled={selecionados.length < 2} onClick={() => setCombinando(true)}>Combinar pagamentos</button>}
        <button type="button" className={botao} onClick={onSugerirVinculos}>Sugerir vínculos</button>
        <button type="button" className={perigo} disabled={!selecionados.length} onClick={() => setExclusao("selecionados")}>Excluir</button>
        <button type="button" className={perigo} onClick={() => setExclusao("tudo")}>Excluir tudo</button>
        {podeRestaurar && <button type="button" className={botao} onClick={() => setHistorico(true)}>Exclusões em lote</button>}
      </div>
      {exclusao && <ExcluirLoteModal aba={aba} modo={exclusao} ids={selecionados} filtros={filtros} onFechar={(m) => { setExclusao(null); if (m) { setSelecionados([]); onMensagem(m); } }} />}
      {historico && <ExclusoesEmLoteModal onFechar={(m) => { setHistorico(false); if (m) onMensagem(m); }} />}
      {combinando && <CombinarModal ids={selecionados} onFechar={(m) => { setCombinando(false); if (m) { setSelecionados([]); onMensagem(m); } }} />}
    </div>
  );
}

// Correção 11 (lote 3): usa o modal compartilhado (largura responsiva, rolagem interna, Esc).
function Moldura({ titulo, children, onFechar }: { titulo: string; children: React.ReactNode; onFechar: () => void }) {
  return <Modal titulo={titulo} onFechar={onFechar} tamanho="lg" classeCorpo="space-y-3 text-sm">{children}</Modal>;
}

function ExcluirLoteModal({ aba, modo, ids, filtros, onFechar }: { aba: AbaLote; modo: "selecionados" | "tudo"; ids: string[]; filtros: FiltrosLote; onFechar: (m?: string) => void }) {
  const router = useRouter();
  const [previa, setPrevia] = useState<ResumoExclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [pendente, iniciar] = useTransition();
  const [entrada] = useState(() => ({ aba, modo, ...(modo === "selecionados" ? { ids } : { filtros }) }));
  useEffect(() => { previaExclusaoLote(entrada).then((r) => ("erro" in r ? setErro(r.erro) : setPrevia(r))); }, [entrada]);
  return (
    <Moldura titulo={modo === "tudo" ? `Excluir tudo — ${aba === "cobrancas" ? "Cobranças" : "Despesas"}` : "Excluir selecionados"} onFechar={() => onFechar()}>
      {erro && <p className="text-red-700">{erro}</p>}
      {!previa && !erro && <p className="text-gray-500">Calculando impacto…</p>}
      {previa && <>
        <div className="grid grid-cols-2 gap-2 border border-gray-200 p-3">
          <p>Total da aba: <strong>{previa.totalAba}</strong></p>
          <p>Selecionados: <strong>{previa.selecionados}</strong></p>
          <p>{modo === "tudo" ? "Alcançados pelo filtro" : "Alcançados"}: <strong>{previa.alcancados}</strong></p>
          <p className="text-red-700">Serão excluídos: <strong>{previa.excluiveis}</strong></p>
          <p className="col-span-2 text-orange-700">Protegidos (não serão apagados): <strong>{previa.protegidos}</strong></p>
        </div>
        {previa.protegidos > 0 && <ul className="list-disc pl-5 text-xs text-gray-600">{(Object.entries(previa.porMotivo) as [MotivoProtecao, number][]).map(([m, n]) => <li key={m}>{n} {ROTULOS_PROTECAO[m]}</li>)}</ul>}
        <p className="text-xs text-gray-500">Antes de apagar, é gravado um backup JSON recuperável e o histórico de cada lançamento (usuário e data). Somente administradores.</p>
        <label className="block text-xs font-bold text-gray-500 uppercase">Para confirmar, digite {CONFIRMACAO_EXCLUSAO}
          <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className="mt-1 w-full border px-3 py-2 text-sm normal-case" />
        </label>
        <button type="button" className="w-full bg-red-700 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50" disabled={!previa.excluiveis || !confirmacaoExclusaoValida(confirmacao) || pendente}
          onClick={() => iniciar(async () => {
            const r = await excluirLancamentosEmLote({ ...entrada, confirmacao });
            if ("erro" in r) { setErro(r.erro ?? "Falha ao excluir."); return; }
            router.refresh();
            onFechar(`${r.excluidos} lançamento(s) excluído(s)${r.backupId ? ` · backup ${r.backupId}` : ""}. ${r.protegidos} protegido(s) preservado(s).`);
          })}>{pendente ? "Gravando backup e excluindo…" : `Excluir ${previa.excluiveis} lançamento(s)`}</button>
      </>}
    </Moldura>
  );
}

function CombinarModal({ ids, onFechar }: { ids: string[]; onFechar: (m?: string) => void }) {
  const router = useRouter();
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof previaCombinacao>> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [pendente, iniciar] = useTransition();
  useEffect(() => { previaCombinacao(ids).then(setPrevia); }, [ids]);
  return (
    <Moldura titulo="Combinar pagamentos" onFechar={() => onFechar()}>
      {!previa && <p className="text-gray-500">Validando…</p>}
      {erro && <p className="text-red-700">{erro}</p>}
      {previa && (previa.ok ? <>
        <p>Será criada uma nova cobrança de <strong>{formatCurrency(previa.total)}</strong>, vencendo em <strong>{new Date(previa.vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</strong> (competência {previa.competencia}).</p>
        <p className="text-xs text-gray-600">{previa.descricao}</p>
        <p className="text-xs text-gray-600">As {ids.length} cobranças originais NÃO são apagadas: ficam marcadas como combinadas (rastreáveis no histórico) e saem dos totais para não contar em dobro.</p>
        <button type="button" className="w-full bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50" disabled={pendente}
          onClick={() => iniciar(async () => {
            const r = await combinarPagamentos({ ids, requestKey });
            if ("erro" in r) { setErro(r.erro ?? "Falha ao combinar."); return; }
            router.refresh();
            onFechar(`${r.combinadas} cobranças combinadas (${formatCurrency(r.total)}).`);
          })}>{pendente ? "Combinando…" : "Confirmar combinação"}</button>
      </> : <>
        <p className="text-red-700">Não é possível combinar estas cobranças:</p>
        <ul className="list-disc pl-5 text-xs">{previa.erros.map((e) => <li key={e}>{e}</li>)}{previa.bloqueados.map((b) => <li key={String(b.id)}>Cobrança {b.id}: {b.motivo}</li>)}</ul>
      </>)}
    </Moldura>
  );
}

// Lote 4 (30/10/2026): lista das exclusões em lote com "Restaurar" (só admin), prévia do que volta,
// confirmação forte e aviso dos vínculos que não existem mais. Gêmeo da Prospecta (LoteLancamentos.tsx).
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function ExclusoesEmLoteModal({ onFechar }: { onFechar: (m?: string) => void }) {
  const [lista, setLista] = useState<ExclusaoEmLoteResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  useEffect(() => { listarExclusoesEmLote().then((r) => ("erro" in r ? setErro(r.erro) : setLista(r))); }, []);
  if (restaurando) return <RestaurarModal backupId={restaurando} onFechar={(m) => { setRestaurando(null); if (m) onFechar(m); }} />;
  return (
    <Moldura titulo="Exclusões em lote" onFechar={() => onFechar()}>
      {erro && <p className="text-red-700">{erro}</p>}
      {!lista && !erro && <p className="text-gray-500">Carregando…</p>}
      {lista && !lista.length && <p className="text-gray-500">Nenhuma exclusão em lote registrada.</p>}
      {lista && lista.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left text-gray-500 uppercase">
              <th className="py-1.5 pr-2">Data</th><th className="py-1.5 pr-2">Usuário</th><th className="py-1.5 pr-2">Aba</th>
              <th className="py-1.5 pr-2 text-right">Qtde.</th><th className="py-1.5 pr-2">Situação</th><th className="py-1.5" />
            </tr></thead>
            <tbody>{lista.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-2 whitespace-nowrap">{dataHora(b.criadoEm)}</td>
                <td className="py-1.5 pr-2">{b.usuario ?? "—"}</td>
                <td className="py-1.5 pr-2">{b.aba === "cobrancas" ? "Cobranças" : "Despesas"}{b.modo === "tudo" ? " (Excluir tudo)" : ""}</td>
                <td className="py-1.5 pr-2 text-right">{b.quantidade}</td>
                <td className="py-1.5 pr-2">{b.restauradoEm ? `Restaurada em ${dataHora(b.restauradoEm)}${b.restauradoPor ? ` por ${b.restauradoPor}` : ""}` : "Excluída"}</td>
                <td className="py-1.5 text-right">{!b.restauradoEm && <button type="button" className={botao} onClick={() => setRestaurando(b.id)}>Restaurar</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Moldura>
  );
}

function RestaurarModal({ backupId, onFechar }: { backupId: string; onFechar: (m?: string) => void }) {
  const router = useRouter();
  const [previa, setPrevia] = useState<Exclude<Awaited<ReturnType<typeof previaRestauracaoExclusao>>, { erro: string }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [pendente, iniciar] = useTransition();
  useEffect(() => { previaRestauracaoExclusao(backupId).then((r) => ("erro" in r ? setErro(r.erro ?? "Falha.") : setPrevia(r))); }, [backupId]);
  return (
    <Moldura titulo="Restaurar exclusão em lote" onFechar={() => onFechar()}>
      {erro && <p className="text-red-700">{erro}</p>}
      {!previa && !erro && <p className="text-gray-500">Calculando o que volta…</p>}
      {previa && <>
        <div className="grid grid-cols-3 gap-2 border border-gray-200 p-3">
          <p className="text-green-700">Voltam: <strong>{previa.restaurar}</strong></p>
          <p>Já existem (não duplica): <strong>{previa.jaExistem}</strong></p>
          <p className="text-orange-700">Com aviso: <strong>{previa.comAviso}</strong></p>
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 text-xs">
          {previa.itens.map((i) => (
            <li key={i.id} className="p-2">
              <p className="font-bold">{i.descricao || i.id} · {formatCurrency(i.valor)}{i.vencimento ? ` · vence ${new Date(i.vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}{i.clienteNome ? ` · ${i.clienteNome}` : ""}</p>
              <p className={i.acao === "restaurar" ? "text-green-700" : "text-gray-500"}>{i.acao === "restaurar" ? "Volta para o BPO" : "Não volta"}</p>
              {i.avisos.map((a) => <p key={a} className="text-orange-700">{a}</p>)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">A restauração é feita de uma vez (transação), fica no histórico de cada lançamento e só pode ser feita uma vez por exclusão. Somente administradores.</p>
        <label className="block text-xs font-bold text-gray-500 uppercase">Para confirmar, digite {CONFIRMACAO_RESTAURACAO}
          <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className="mt-1 w-full border px-3 py-2 text-sm normal-case" />
        </label>
        <button type="button" className="w-full bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50"
          disabled={!previa.restaurar || !!previa.restauradoEm || !confirmacaoRestauracaoValida(confirmacao) || pendente}
          onClick={() => iniciar(async () => {
            const r = await restaurarExclusaoEmLote({ backupId, confirmacao });
            if ("erro" in r) { setErro(r.erro ?? "Falha ao restaurar."); return; }
            router.refresh();
            onFechar(`${r.restaurados} lançamento(s) restaurado(s)${r.jaExistiam ? ` · ${r.jaExistiam} já existiam` : ""}.${r.avisos.length ? ` Avisos: ${r.avisos.join(" ")}` : ""}`);
          })}>{pendente ? "Restaurando…" : `Restaurar ${previa.restaurar} lançamento(s)`}</button>
      </>}
    </Moldura>
  );
}
