"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { parseNumeroBR, formatArea } from "@/lib/utils";
import {
  ordenarLotesAvulsos, parseLotesAvulsos, resumoLotesAvulsos, serializarLotesAvulsos, validarListaLotesAvulsos,
  type LoteAvulso,
} from "@/lib/incorporacao/lotes-avulsos";
import { salvarLotesAvulsos, salvarSemKml } from "@/lib/actions/estudos-massa";
import { exigirResultado } from "@/lib/acao-resultado";
import type { EstudoData } from "./incorporacao-detail";

// Correção 06 (AD-03): "Este empreendimento não possui KML". Com a marcação,
// os módulos bloqueados só por falta de geometria são liberados e os lotes são
// cadastrados um a um (quadra, lote, área, testada, profundidade). Nenhuma
// medida é estimada. Enviar o KML depois continua possível.

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;
type Rascunho = { quadra: string; lote: string; area: string; testada: string; profundidade: string };
const VAZIO: Rascunho = { quadra: "", lote: "", area: "", testada: "", profundidade: "" };

const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const paraTexto = (v: number | null) => (v === null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }));
const opcional = (t: string) => (t.trim() === "" ? null : parseNumeroBR(t));

export function SemKmlToggle({ estudo }: { estudo: EstudoData }) {
  const [marcado, setMarcado] = useState(!!estudo.semKml);
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  async function alternar(valor: boolean) {
    setBusy(true);
    setMensagem(null);
    const anterior = marcado;
    setMarcado(valor);
    try {
      exigirResultado(await salvarSemKml(estudo.id, valor));
      setMensagem({ tipo: "ok", texto: valor ? "Marcado como empreendimento sem KML — etapas liberadas." : "Fluxo convencional restabelecido (com KML)." });
    } catch (e) {
      setMarcado(anterior);
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 p-4 space-y-2">
      <label className="flex items-start gap-2 text-sm font-bold text-[var(--brand-dark)] cursor-pointer">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={marcado} disabled={busy}
          onChange={(e) => alternar(e.target.checked)} />
        Este empreendimento não possui KML
      </label>
      <p className="text-[11px] text-gray-600">
        Com esta opção, as etapas que dependiam apenas da poligonal ficam liberadas e os lotes são cadastrados manualmente abaixo.
        Funções que exigem geometria indicam que não há poligonal. Não substitui as obrigações documentais. Você ainda pode enviar o KML depois.
      </p>
      {mensagem && <Aviso mensagem={mensagem} />}
      {marcado && <LotesAvulsosEditor estudo={estudo} />}
    </div>
  );
}

function LotesAvulsosEditor({ estudo }: { estudo: EstudoData }) {
  const [lotes, setLotes] = useState<LoteAvulso[]>(() => parseLotesAvulsos(estudo.lotesAvulsosJson));
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const resumo = useMemo(() => resumoLotesAvulsos(lotes), [lotes]);

  function aplicar() {
    const novo: LoteAvulso = {
      id: editando ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      quadra: rascunho.quadra.trim(),
      lote: rascunho.lote.trim(),
      areaM2: parseNumeroBR(rascunho.area),
      testadaM: opcional(rascunho.testada),
      profundidadeM: opcional(rascunho.profundidade),
    };
    const lista = editando ? lotes.map((l) => (l.id === editando ? novo : l)) : [...lotes, novo];
    const erro = validarListaLotesAvulsos(lista);
    if (erro) { setMensagem({ tipo: "erro", texto: erro }); return; }
    setLotes(ordenarLotesAvulsos(lista));
    setRascunho(VAZIO);
    setEditando(null);
    setAlterado(true);
    setMensagem(null);
  }

  function editar(l: LoteAvulso) {
    setEditando(l.id);
    setRascunho({ quadra: l.quadra, lote: l.lote, area: paraTexto(l.areaM2), testada: paraTexto(l.testadaM), profundidade: paraTexto(l.profundidadeM) });
  }

  function remover(l: LoteAvulso) {
    if (!window.confirm(`Remover o lote ${l.lote} da quadra ${l.quadra}? A alteração só é gravada ao clicar em "Salvar lotes".`)) return;
    setLotes((atual) => atual.filter((x) => x.id !== l.id));
    if (editando === l.id) { setEditando(null); setRascunho(VAZIO); }
    setAlterado(true);
  }

  async function salvar() {
    setBusy(true);
    setMensagem(null);
    try {
      exigirResultado(await salvarLotesAvulsos(estudo.id, serializarLotesAvulsos(lotes)));
      setAlterado(false);
      setMensagem({ tipo: "ok", texto: `${lotes.length} lote(s) salvo(s).` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao salvar os lotes." });
    } finally {
      setBusy(false);
    }
  }

  const campo = (k: keyof Rascunho, rotulo: string, numerico = false) => (
    <div className="min-w-0">
      <label htmlFor={`lote-avulso-${k}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{rotulo}</label>
      <input id={`lote-avulso-${k}`} value={rascunho[k]} inputMode={numerico ? "decimal" : undefined} maxLength={40}
        onChange={(e) => setRascunho((r) => ({ ...r, [k]: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicar(); } }}
        className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
    </div>
  );

  return (
    <div className="border-t border-gray-100 pt-3 space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lotes avulsos</p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        {campo("quadra", "Quadra")}
        {campo("lote", "Lote")}
        {campo("area", "Área (m²)", true)}
        {campo("testada", "Testada (m)", true)}
        {campo("profundidade", "Profundidade (m)", true)}
        <div className="flex gap-1">
          <button type="button" onClick={aplicar}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90">
            {editando ? <Save size={12} /> : <Plus size={12} />} {editando ? "Atualizar" : "Adicionar"}
          </button>
          {editando && (
            <button type="button" aria-label="Cancelar edição" onClick={() => { setEditando(null); setRascunho(VAZIO); }}
              className="px-2 py-2 border border-gray-200"><X size={12} /></button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-600">Testada e profundidade são opcionais — informe apenas medidas conhecidas.</p>

      {lotes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100">
                <th className="py-1.5 pr-2">Quadra</th><th className="py-1.5 pr-2">Lote</th>
                <th className="py-1.5 pr-2 text-right">Área (m²)</th><th className="py-1.5 pr-2 text-right">Testada (m)</th>
                <th className="py-1.5 pr-2 text-right">Profundidade (m)</th><th className="py-1.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className={`border-b border-gray-50 ${editando === l.id ? "bg-yellow-50/50" : ""}`}>
                  <td className="py-1.5 pr-2">{l.quadra}</td><td className="py-1.5 pr-2">{l.lote}</td>
                  <td className="py-1.5 pr-2 text-right">{l.areaM2 === null ? "—" : l.areaM2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="py-1.5 pr-2 text-right">{fmt(l.testadaM)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmt(l.profundidadeM)}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => editar(l)} aria-label={`Editar lote ${l.lote} da quadra ${l.quadra}`} className="p-1 hover:text-[var(--brand-dark)]"><Pencil size={13} /></button>
                    <button type="button" onClick={() => remover(l)} aria-label={`Remover lote ${l.lote} da quadra ${l.quadra}`} className="p-1 text-red-600"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Nenhum lote cadastrado.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={salvar} disabled={busy || !alterado}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50">
          <Save size={13} /> {busy ? "Salvando..." : "Salvar lotes"}
        </button>
        <p className="text-[11px] text-gray-600">
          {resumo.total} lote(s) · {resumo.quadras} quadra(s) · {formatArea(resumo.areaTotalM2)} no total{alterado ? " · alterações não salvas" : ""}
        </p>
      </div>
      {mensagem && <Aviso mensagem={mensagem} />}
    </div>
  );
}

function Aviso({ mensagem }: { mensagem: NonNullable<Mensagem> }) {
  return (
    <p role={mensagem.tipo === "erro" ? "alert" : "status"}
      className={`text-xs flex items-start gap-1.5 ${mensagem.tipo === "erro" ? "text-red-700" : "text-green-700"}`}>
      {mensagem.tipo === "erro" ? <AlertTriangle size={13} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
      {mensagem.texto}
    </p>
  );
}
