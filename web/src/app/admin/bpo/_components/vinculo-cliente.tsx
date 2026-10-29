"use client";
// Lote 3, item 17: "Cadastro livre" → cliente do CRM (gêmeo de Prospecta client/src/components/bpo/VinculoClienteLancamento.tsx).
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aplicarVinculosEmMassa, buscarClientesELeadsBpo, previaVinculosEmMassa, sugestoesClienteLancamento, vincularClienteLancamento } from "@/lib/actions/bpo-vinculo";
import type { CandidatoCliente } from "@/lib/bpo-vinculo-cliente";

type Sugestoes = Awaited<ReturnType<typeof sugestoesClienteLancamento>>;
type Previa = Awaited<ReturnType<typeof previaVinculosEmMassa>>;
type Alvo = { clienteId?: string | null; leadId?: string | null };
const alvoDe = (c: CandidatoCliente): Alvo => (c.clienteId ? { clienteId: c.clienteId } : { leadId: c.leadId });

export function VinculoClienteLancamento({ lancamento, onVinculado }: {
  lancamento: { id: string; version: number; clienteNomeLivre: string | null };
  onVinculado: (r: { clienteId: string; version: number }) => void;
}) {
  const [sugestao, setSugestao] = useState<Sugestoes | null>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Awaited<ReturnType<typeof buscarClientesELeadsBpo>>>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => { let vivo = true; sugestoesClienteLancamento(lancamento.id).then((r) => { if (vivo) setSugestao(r); }).catch(() => {}); return () => { vivo = false; }; }, [lancamento.id]);
  useEffect(() => {
    if (busca.trim().length < 2) return;
    const t = setTimeout(() => { buscarClientesELeadsBpo(busca).then(setAchados).catch(() => setAchados([])); }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  const confirmar = (alvo: Alvo, motivo: string) => iniciar(async () => {
    const r = await vincularClienteLancamento({ id: lancamento.id, version: lancamento.version, ...alvo, motivo });
    if ("erro" in r) { setMensagem(r.erro ?? "Falha ao vincular."); return; }
    setMensagem(r.clienteCriado ? "Cliente BPO criado a partir do lead e vinculado." : "Lançamento vinculado ao cliente.");
    onVinculado({ clienteId: r.clienteId, version: r.version });
  });

  return (
    <fieldset className="space-y-2 rounded border border-gray-200 p-3 text-sm">
      <legend className="px-1 text-xs font-bold">Cliente</legend>
      <p>Cadastro livre: <strong>{lancamento.clienteNomeLivre || "sem nome"}</strong></p>
      {sugestao?.sugestoes.length ? (
        <ul className="space-y-1">
          {sugestao.sugestoes.slice(0, 5).map((s) => (
            <li key={s.candidato.chave} className="flex flex-wrap items-center justify-between gap-2">
              <span>Possível cliente: <strong>{s.candidato.nome}</strong> — {s.descricao}
                <span className={`ml-2 px-1.5 text-[10px] font-bold uppercase ${s.grau === "forte" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{s.grau === "forte" ? "forte" : "confirmar"}</span>
                {!s.candidato.clienteId && <span className="ml-1 text-[11px] text-gray-500">(lead sem cliente BPO — será criado)</span>}
              </span>
              <button type="button" disabled={pendente} onClick={() => confirmar(alvoDe(s.candidato), `sugestão (${s.descricao}) confirmada`)} className="border px-2 py-1 text-xs font-bold disabled:opacity-50">Confirmar</button>
            </li>
          ))}
          {sugestao.ambiguo && <li className="text-xs text-orange-700">Há mais de um candidato possível: confirme manualmente o correto.</li>}
        </ul>
      ) : <p className="text-xs text-gray-500">{sugestao ? "Nenhuma sugestão automática encontrada." : "Procurando sugestões…"}</p>}
      <label className="block text-xs font-bold text-gray-500 uppercase">Buscar cliente BPO ou lead do CRM
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" className="mt-1 w-full border px-3 py-2 text-sm normal-case" />
      </label>
      {busca.trim().length >= 2 && achados.length > 0 && <div className="max-h-40 overflow-y-auto border border-gray-200">{achados.map((a) => (
        <button key={`${a.tipo}${a.id}`} type="button" disabled={pendente} onClick={() => confirmar(a.tipo === "cliente" ? { clienteId: a.id } : { leadId: a.id }, `escolhido na busca (${a.tipo === "cliente" ? "cliente BPO" : "lead do CRM"})`)}
          className="block w-full border-b border-gray-50 px-3 py-2 text-left hover:bg-gray-50">{a.nome} <span className="text-xs text-gray-500">{a.detalhe}</span></button>
      ))}</div>}
      {mensagem && <p className="text-xs font-bold">{mensagem}</p>}
    </fieldset>
  );
}

/** Ação em massa opcional: prévia + confirmação; ambíguos ficam sem seleção. */
export function SugerirVinculosModal({ onFechar }: { onFechar: (mensagem?: string) => void }) {
  const router = useRouter();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  useEffect(() => { previaVinculosEmMassa().then(setPrevia).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao analisar.")); }, []);
  const escolhaDe = (i: Previa["itens"][number]) => escolhas[i.lancamentoId] ?? i.automatico?.candidato.chave ?? "";
  const selecionados = (previa?.itens ?? []).flatMap((i) => {
    const c = i.sugestoes.find((s) => s.candidato.chave === escolhaDe(i))?.candidato;
    return c ? [{ id: i.lancamentoId, version: i.version, ...alvoDe(c) }] : [];
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white p-6 space-y-3">
        <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase">Sugerir vínculos com clientes do CRM</h2>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        {!previa && !erro && <p className="text-sm text-gray-500">Analisando lançamentos…</p>}
        {previa && <>
          <p className="text-sm text-gray-600">{previa.analisados} lançamento(s) &quot;Cadastro livre&quot; analisado(s) · {previa.comSugestao} com sugestão · {previa.automaticos} com um único candidato forte (pré-selecionados). Ambíguos ficam sem seleção: escolha manualmente.</p>
          {previa.itens.map((i) => (
            <div key={i.lancamentoId} className="flex flex-col gap-1 border border-gray-100 p-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm"><p className="font-medium">{i.nome}</p><p className="truncate text-xs text-gray-500">{i.descricao}</p></div>
              <select className="w-full border px-2 py-1 text-sm sm:w-80" value={escolhaDe(i)} onChange={(e) => setEscolhas((x) => ({ ...x, [i.lancamentoId]: e.target.value }))}>
                <option value="">Não vincular</option>
                {i.sugestoes.map((s) => <option key={s.candidato.chave} value={s.candidato.chave}>{s.candidato.nome} — {s.descricao} ({s.grau})</option>)}
              </select>
            </div>
          ))}
        </>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onFechar()} className="border px-4 py-2 text-xs font-bold uppercase">Cancelar</button>
          <button type="button" disabled={!selecionados.length || pendente} onClick={() => iniciar(async () => {
            const r = await aplicarVinculosEmMassa(selecionados);
            if ("erro" in r) { setErro(r.erro ?? "Falha."); return; }
            router.refresh();
            onFechar(`${r.vinculados} lançamento(s) vinculado(s).${r.falhas.length ? ` ${r.falhas.length} não puderam ser vinculados (atualize e tente de novo).` : ""}`);
          })} className="bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50">{pendente ? "Vinculando…" : `Confirmar ${selecionados.length} vínculo(s)`}</button>
        </div>
      </div>
    </div>
  );
}
