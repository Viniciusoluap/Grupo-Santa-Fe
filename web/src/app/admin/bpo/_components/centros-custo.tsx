"use client";
// Paridade BPO (13/11): cadastro de centros de custo e campo "Centro de custo" dos lançamentos.
// Gêmeo de Prospecta client/src/components/bpo/CentrosCusto.tsx (regras em src/lib/financeiro/centros-custo.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { exigirResultado } from "@/lib/acao-resultado";
import { ativarCentroCustoAcao, criarCentroCustoAcao, renomearCentroCustoAcao } from "@/lib/actions/bpo-paridade";
import { chaveCentro } from "@/lib/financeiro/centros-custo";

export type CentroCustoOpcao = { id: string; nome: string; ativo: boolean; lancamentos?: number };

const cls = "mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 normal-case";

/**
 * Campo opcional com os centros ativos; um valor gravado fora da lista (ex.: "A / B" do Conta Azul) continua como
 * opção. Sem `onChange` é um campo de formulário comum (name = "centroCustos").
 */
export function CampoCentroCusto({ centros, valor, onChange, defaultValue, name = "centroCustos", className = "" }: {
  centros: CentroCustoOpcao[]; valor?: string | null; onChange?: (v: string | null) => void; defaultValue?: string | null; name?: string; className?: string;
}) {
  const ativos = centros.filter((c) => c.ativo);
  const atual = (onChange ? valor : defaultValue) ?? "";
  const foraDaLista = atual && !ativos.some((c) => chaveCentro(c.nome) === chaveCentro(atual));
  const opcoes = <>
    <option value="">Nenhum</option>
    {foraDaLista && <option value={atual}>{atual}</option>}
    {ativos.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
  </>;
  return (
    <label className={`block min-w-0 text-xs font-bold text-gray-500 uppercase ${className}`}>Centro de custo
      {onChange
        ? <select aria-label="Centro de custo" name={name} value={atual} onChange={(e) => onChange(e.target.value || null)} className={cls}>{opcoes}</select>
        : <select aria-label="Centro de custo" name={name} defaultValue={atual} className={cls}>{opcoes}</select>}
    </label>
  );
}

const botao = "border border-gray-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50";

export function CentrosCustoModal({ centros, onFechar, onMensagem }: { centros: CentroCustoOpcao[]; onFechar: () => void; onMensagem: (m: string) => void }) {
  const router = useRouter();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const executar = (fn: () => Promise<string | void>) => iniciar(async () => {
    try { const m = await fn(); if (m) onMensagem(m); router.refresh(); }
    catch (e) { onMensagem(e instanceof Error ? e.message : "Falha ao salvar o centro de custo."); }
  });
  return (
    <Modal titulo="Centros de custo" onFechar={onFechar} tamanho="lg" classeCorpo="space-y-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-xs font-bold text-gray-500 uppercase">Novo centro de custo
          <input value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={100} className={cls} />
        </label>
        <button type="button" className="bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50" disabled={novo.trim().length < 2 || pendente}
          onClick={() => executar(async () => { exigirResultado(await criarCentroCustoAcao(novo)); setNovo(""); return "Centro de custo criado."; })}>Criar</button>
      </div>
      <p className="text-xs text-gray-500">Renomear atualiza os lançamentos que usam o centro (nos que têm dois centros, &quot;A / B&quot;, só a parte dele). Desativado sai da lista de escolha, mas os lançamentos ficam como estão.</p>
      <ul className="divide-y divide-gray-100 border border-gray-200">
        {centros.length === 0 && <li className="p-3 text-gray-500">Nenhum centro de custo cadastrado.</li>}
        {centros.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 p-2">
            {editando?.id === c.id ? (<>
              <input aria-label="Novo nome" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} maxLength={100} className="min-w-0 flex-1 basis-40 border border-gray-200 px-2 py-1" />
              <button type="button" className={botao} disabled={editando.nome.trim().length < 2 || pendente}
                onClick={() => executar(async () => { const r = exigirResultado(await renomearCentroCustoAcao(editando.id, editando.nome)); setEditando(null); return `Renomeado. ${r.lancamentos} lançamento(s) atualizado(s).`; })}>Salvar</button>
              <button type="button" className={botao} onClick={() => setEditando(null)}>Voltar</button>
            </>) : (<>
              <span className={`min-w-0 flex-1 basis-40 break-words ${c.ativo ? "" : "text-gray-400 line-through"}`}>{c.nome}</span>
              <span className="text-xs text-gray-500">{c.lancamentos ?? 0} lanç.</span>
              <button type="button" className={botao} onClick={() => setEditando({ id: c.id, nome: c.nome })}>Renomear</button>
              <button type="button" className={botao} disabled={pendente} onClick={() => executar(async () => { exigirResultado(await ativarCentroCustoAcao(c.id, !c.ativo)); })}>{c.ativo ? "Desativar" : "Ativar"}</button>
            </>)}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
