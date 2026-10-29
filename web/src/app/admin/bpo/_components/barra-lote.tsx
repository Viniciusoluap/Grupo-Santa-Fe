"use client";
// Lote 3, item 16: ações em lote de Cobranças/Despesas (gêmeo de Prospecta client/src/components/bpo/LoteLancamentos.tsx).
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { combinarPagamentos, excluirLancamentosEmLote, previaCombinacao, previaExclusaoLote, type AbaLote } from "@/lib/actions/bpo-lote";
import { CONFIRMACAO_EXCLUSAO, ROTULOS_PROTECAO, confirmacaoExclusaoValida, type FiltrosLote, type MotivoProtecao, type ResumoExclusao } from "@/lib/bpo-lote";

const botao = "border border-gray-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const perigo = "border border-red-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50";

export function BarraLote({ aba, visiveis, selecionados, setSelecionados, filtros, onSugerirVinculos, onMensagem }: {
  aba: AbaLote; visiveis: string[]; selecionados: string[]; setSelecionados: (ids: string[]) => void;
  filtros: FiltrosLote; onSugerirVinculos: () => void; onMensagem: (m: string) => void;
}) {
  const [exclusao, setExclusao] = useState<null | "selecionados" | "tudo">(null);
  const [combinando, setCombinando] = useState(false);
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
      </div>
      {exclusao && <ExcluirLoteModal aba={aba} modo={exclusao} ids={selecionados} filtros={filtros} onFechar={(m) => { setExclusao(null); if (m) { setSelecionados([]); onMensagem(m); } }} />}
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
