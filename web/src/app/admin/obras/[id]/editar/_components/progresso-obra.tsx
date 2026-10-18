"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, History, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { lerPercentualDigitado } from "@/lib/financeiro/obra";
import { SERVICOS_PROGRESSO, calcularProgresso, formatarPercentual } from "@/lib/financeiro/progresso";
import type { ProgressoObraDados } from "@/lib/obras/progresso-dados";
import { confirmarRecebimentoMedicao, editarMedicao, excluirMedicao, salvarProgressoObra, solicitarMedicao } from "@/lib/actions/obra-progresso";

// EPIC-020 Lote 4 (item 27) — progresso físico por incidência, igual à
// Prospecta. O Progresso Geral é somente leitura: soma das Execuções na Obra.

type Linha = { chave: string; incidencia: string; execucao: string };

const canonico = (n: number) => n.toFixed(4).replace(/\.?0+$/, "") || "0";
const exibir = (v: string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function CelulaPercentual({ valor, onChange, rotulo }: { valor: string; onChange: (v: string) => void; rotulo: string }) {
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);
  const invalido = focado && texto.trim() !== "" && lerPercentualDigitado(texto) === null;
  return (
    <input
      aria-label={rotulo}
      inputMode="decimal"
      value={focado ? texto : exibir(valor)}
      onFocus={() => { setTexto(exibir(valor)); setFocado(true); }}
      onBlur={() => setFocado(false)}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = e.target.value.trim() === "" ? 0 : lerPercentualDigitado(e.target.value);
        if (n !== null && Number.isFinite(n)) onChange(canonico(n));
      }}
      className={`w-24 border px-2 py-1 text-sm text-right bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)] ${invalido ? "border-red-500" : "border-gray-200"}`}
    />
  );
}

export function BarraProgresso({ valor }: { valor: number }) {
  const largura = Math.max(0, Math.min(100, valor));
  return (
    <div className="h-4 bg-gray-100 overflow-hidden w-full" role="progressbar" aria-valuenow={Number(valor.toFixed(2))} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full transition-all ${largura >= 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function ProgressoObra({ obraId, dados }: { obraId: string; dados: ProgressoObraDados }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>(dados.itens);
  // Pedido de 18/10: edição de uma medição do histórico (admin, colaborador e empreiteiro).
  const [editando, setEditando] = useState<{ id: string; quando: string } | null>(null);
  // Depois de editar/excluir a medição vigente, a tabela acompanha o que ficou gravado.
  const [itensGravados, setItensGravados] = useState(dados.itens);
  if (itensGravados !== dados.itens) {
    setItensGravados(dados.itens);
    if (!editando) setLinhas(dados.itens);
  }
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const calculo = useMemo(() => calcularProgresso(linhas), [linhas]);
  const alterar = (chave: string, campo: "incidencia" | "execucao", v: string) =>
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  const gravar = () =>
    iniciar(async () => {
      setMensagem(null);
      if (editando) {
        const r = await editarMedicao(editando.id, linhas);
        if (!r.ok) return setMensagem({ tipo: "erro", texto: r.erro });
        setMensagem({ tipo: "ok", texto: `Medição de ${editando.quando} alterada.` });
        setEditando(null);
        router.refresh();
        return;
      }
      const r = await salvarProgressoObra(obraId, linhas);
      if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else {
        setMensagem({ tipo: "ok", texto: `Medição salva: progresso geral ${formatarPercentual(r.progresso)}.` });
        router.refresh();
      }
    });

  const acao = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, sucesso: string) =>
    iniciar(async () => {
      setMensagem(null);
      const r = await fn();
      if (!r.ok) return setMensagem({ tipo: "erro", texto: r.erro });
      setMensagem({ tipo: "ok", texto: sucesso });
      setEditando(null);
      router.refresh();
    });

  const iniciarEdicao = (h: ProgressoObraDados["historico"][number]) => {
    setEditando({ id: h.id, quando: dataHora(h.criadoEm) });
    setLinhas(h.itens);
    setMensagem(null);
    document.getElementById("medicao-por-servico")?.scrollIntoView({ behavior: "smooth" });
  };
  const cancelarEdicao = () => {
    setEditando(null);
    setLinhas(dados.itens);
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Progresso Geral</h2>
        <p className="text-xs text-gray-500">Calculado automaticamente: soma de Incidência × Execução de cada serviço (Mensurado Acumulado Total). Não é editável.</p>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black text-[var(--brand-dark)] min-w-[120px]" data-testid="progresso-geral">{formatarPercentual(calculo.progresso)}</span>
          <BarraProgresso valor={calculo.progresso} />
        </div>
        {!dados.medido && dados.progressoLegado > 0 && (
          <p className="text-xs text-amber-700">Esta obra tinha {dados.progressoLegado}% digitado manualmente. Ao salvar a primeira medição, o progresso passa a ser o calculado acima.</p>
        )}
      </section>

      <section id="medicao-por-servico" className="bg-white border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Medição por serviço</h2>
          <p className="text-xs text-gray-500 mt-1">Incidência e Execução do Item são editáveis (até 4 casas decimais). Execução na Obra é automática.</p>
        </div>
        {editando && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span>Editando a medição de {editando.quando}. Ao salvar, ela é corrigida no histórico.</span>
            <button type="button" onClick={cancelarEdicao} className="inline-flex items-center gap-1 border border-amber-400 px-3 py-1 text-xs font-bold uppercase"><X size={12} />Cancelar edição</button>
          </div>
        )}
        {calculo.erros.length > 0 && (
          <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
            {calculo.erros.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}
        {calculo.avisos.map((a) => (
          <p key={a} className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle size={14} />{a}</p>
        ))}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2">Serviço</th>
                <th className="py-2 px-2 text-right">Incidência (%)</th>
                <th className="py-2 px-2 text-right">Execução do Item (%)</th>
                <th className="py-2 pl-2 text-right">Execução na Obra (%)</th>
              </tr>
            </thead>
            <tbody>
              {SERVICOS_PROGRESSO.map((s) => {
                const linha = linhas.find((l) => l.chave === s.chave)!;
                const item = calculo.itens.find((i) => i.chave === s.chave);
                return (
                  <tr key={s.chave} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2 text-[var(--brand-dark)]">{s.nome}</td>
                    <td className="py-1.5 px-2"><div className="flex justify-end"><CelulaPercentual rotulo={`Incidência ${s.nome}`} valor={linha.incidencia} onChange={(v) => alterar(s.chave, "incidencia", v)} /></div></td>
                    <td className="py-1.5 px-2"><div className="flex justify-end"><CelulaPercentual rotulo={`Execução ${s.nome}`} valor={linha.execucao} onChange={(v) => alterar(s.chave, "execucao", v)} /></div></td>
                    <td className="py-1.5 pl-2 text-right tabular-nums text-gray-700">{item ? formatarPercentual(item.execucaoObra, 4) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold text-[var(--brand-dark)]">
                <td className="py-2 pr-2">Total</td>
                <td className={`py-2 px-2 text-right tabular-nums ${calculo.somaIncidencia > 100 ? "text-red-600" : ""}`}>{formatarPercentual(calculo.somaIncidencia, 2)}</td>
                <td className="py-2 px-2 text-right text-gray-500 font-normal">Mensurado Acumulado Total</td>
                <td className="py-2 pl-2 text-right tabular-nums">{formatarPercentual(calculo.progresso)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {mensagem && (
          <p role={mensagem.tipo === "erro" ? "alert" : "status"} className={`text-sm ${mensagem.tipo === "erro" ? "text-red-700" : "text-green-700"}`}>{mensagem.texto}</p>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={gravar} disabled={pendente || calculo.erros.length > 0}
            className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 disabled:opacity-60">
            <Save size={14} /> {pendente ? "Salvando..." : editando ? "Salvar alterações da medição" : "Salvar medição"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-100 p-5">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest flex items-center gap-2 mb-3"><History size={14} />Histórico de medições</h2>
        {dados.historico.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma medição salva ainda.</p>
        ) : (
          <>
            {/* Pedido de 18/10: valor estimado X = Y × avanço da medição; Y = (financiado + FGTS + subsídio) − terreno. */}
            <p className="mb-3 text-xs text-gray-600">
              {dados.baseMedicao.ok
                ? <>Valor estimado = {reais(dados.baseMedicao.centavos)} (financiado + FGTS + subsídio − terreno) × percentual que a obra avançou na medição.</>
                : <>Valor estimado indisponível — {dados.baseMedicao.motivo}. Preencha em Valores da Operação.</>}
            </p>
            <ul className="divide-y divide-gray-100 text-sm">
              {dados.historico.map((h) => (
                <li key={h.id} className="grid grid-cols-1 items-center gap-2 py-3 text-gray-700 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                  <div className="min-w-0">
                    <p>{dataHora(h.criadoEm)} — {h.autor ?? "—"}</p>
                    {h.editadaEm && <p className="text-xs text-gray-500">Editada em {dataHora(h.editadaEm)}</p>}
                  </div>
                  <div>
                    {h.solicitadaEm ? (
                      <p className="text-xs text-amber-800"><Send size={12} className="mr-1 inline" />Solicitada em {dataHora(h.solicitadaEm)}{h.solicitadaPor ? ` por ${h.solicitadaPor}` : ""}</p>
                    ) : (
                      <button type="button" disabled={pendente} onClick={() => acao(() => solicitarMedicao(h.id), "Medição solicitada.")}
                        className="inline-flex items-center gap-1 border border-[var(--brand-yellow)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-dark)] hover:bg-[var(--brand-yellow)] disabled:opacity-60">
                        <Send size={12} />Solicitar medição
                      </button>
                    )}
                  </div>
                  <div>
                    {h.recebidaEm ? (
                      <p className="text-xs text-green-800"><CheckCircle2 size={12} className="mr-1 inline" />Recebida em {dataHora(h.recebidaEm)}{h.recebidaPor ? ` por ${h.recebidaPor}` : ""}</p>
                    ) : (
                      <button type="button" disabled={pendente || !h.solicitadaEm} title={h.solicitadaEm ? undefined : "Solicite a medição primeiro"}
                        onClick={() => acao(() => confirmarRecebimentoMedicao(h.id), "Recebimento da medição confirmado.")}
                        className="inline-flex items-center gap-1 border border-green-600 px-3 py-1.5 text-xs font-bold uppercase text-green-800 hover:bg-green-50 disabled:opacity-50">
                        <CheckCircle2 size={12} />Confirmar recebimento
                      </button>
                    )}
                  </div>
                  <div className="md:text-right">
                    <p className="text-xs text-gray-500">Valor estimado</p>
                    <p className="font-bold text-[var(--brand-dark)] tabular-nums">{h.estimativa.valorCentavos === null ? "—" : reais(h.estimativa.valorCentavos)}</p>
                    <p className={`text-xs ${h.estimativa.aviso ? "text-amber-700" : "text-gray-500"}`}>
                      {h.estimativa.aviso ?? `${formatarPercentual(h.estimativa.percentualDaMedicao)} nesta medição`}
                    </p>
                  </div>
                  <p className="font-bold text-[var(--brand-dark)] tabular-nums md:text-right">{formatarPercentual(h.progresso)}</p>
                  <div className="flex gap-1 md:justify-end">
                    <button type="button" aria-label={`Editar a medição de ${dataHora(h.criadoEm)}`} disabled={pendente} onClick={() => iniciarEdicao(h)}
                      className="p-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-600"><Pencil size={15} /></button>
                    <button type="button" aria-label={`Excluir a medição de ${dataHora(h.criadoEm)}`} disabled={pendente}
                      onClick={() => { if (confirm(`Excluir definitivamente a medição de ${dataHora(h.criadoEm)}? Esta ação não pode ser desfeita.`)) acao(() => excluirMedicao(h.id), "Medição excluída."); }}
                      className="p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
