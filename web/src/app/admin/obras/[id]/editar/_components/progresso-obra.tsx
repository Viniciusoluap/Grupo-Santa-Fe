"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, History, Save } from "lucide-react";
import { lerPercentualDigitado } from "@/lib/financeiro/obra";
import { SERVICOS_PROGRESSO, calcularProgresso, formatarPercentual } from "@/lib/financeiro/progresso";
import type { ProgressoObraDados } from "@/lib/obras/progresso-dados";
import { salvarProgressoObra } from "@/lib/actions/obra-progresso";

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

export function ProgressoObra({ obraId, dados }: { obraId: string; dados: ProgressoObraDados }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>(dados.itens);
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const calculo = useMemo(() => calcularProgresso(linhas), [linhas]);
  const alterar = (chave: string, campo: "incidencia" | "execucao", v: string) =>
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  const gravar = () =>
    iniciar(async () => {
      setMensagem(null);
      const r = await salvarProgressoObra(obraId, linhas);
      if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else {
        setMensagem({ tipo: "ok", texto: `Medição salva: progresso geral ${formatarPercentual(r.progresso)}.` });
        router.refresh();
      }
    });

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

      <section className="bg-white border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Medição por serviço</h2>
          <p className="text-xs text-gray-500 mt-1">Incidência e Execução do Item são editáveis (até 4 casas decimais). Execução na Obra é automática.</p>
        </div>
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
            <Save size={14} /> {pendente ? "Salvando..." : "Salvar medição"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-100 p-5">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest flex items-center gap-2 mb-3"><History size={14} />Histórico de medições</h2>
        {dados.historico.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma medição salva ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {dados.historico.map((h) => (
              <li key={h.id} className="flex justify-between py-2 text-gray-600">
                <span>{new Date(h.criadoEm).toLocaleString("pt-BR")} — {h.autor ?? "—"}</span>
                <span className="font-bold text-[var(--brand-dark)]">{formatarPercentual(h.progresso)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
