"use client";

import { useEffect, useState } from "react";
import { salvarDueDiligence } from "@/lib/actions/due-diligence";
import { desvincularDocumentoRegistro, enviarDocumentoRegistro, listarDocumentosRegistro } from "@/lib/actions/documentos-registro";
import { lerDueDiligence, progressoDueDiligence, type DueDiligence } from "@/lib/incorporacao/due-diligence";

type Etapa = DueDiligence["etapas"][number];
const novaEtapa = (): Etapa => ({ id: crypto.randomUUID(), nome: "Nova etapa", procedimentos: "", observacoes: "", tarefas: [], documentos: [] });
const field = "w-full min-w-0 border border-gray-200 bg-white text-[var(--brand-dark)] px-2 py-1.5";

export function DueDiligenceTab({ estudoId, json }: { estudoId: string; json: string | null }) {
  const [salvo, setSalvo] = useState(json);
  const [dados, setDados] = useState<DueDiligence>(() => lerDueDiligence(json));
  const [alterado, setAlterado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState("");
  const [arquivos, setArquivos] = useState<Awaited<ReturnType<typeof listarDocumentosRegistro>>["documentos"]>([]);
  const [driveAtivo, setDriveAtivo] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  useEffect(() => { let ativo = true; listarDocumentosRegistro(estudoId).then((r) => { if (ativo) { setArquivos(r.documentos); setDriveAtivo(r.configurado); } }).catch(() => { if (ativo) setErro("Não foi possível consultar os arquivos."); }); return () => { ativo = false; }; }, [estudoId]);
  function change(fn: (current: DueDiligence) => DueDiligence) { setDados(fn); setAlterado(true); }
  function edit(id: string, fn: (etapa: Etapa) => Etapa) {
    change((current) => ({ ...current, etapas: current.etapas.map((e) => e.id === id ? fn(e) : e) }));
  }
  function move(index: number, offset: number) {
    change((current) => { const etapas = [...current.etapas]; const [etapa] = etapas.splice(index, 1); etapas.splice(index + offset, 0, etapa); return { ...current, etapas }; });
  }
  async function save() {
    setPendente(true); setErro("");
    try {
      const next = { ...dados, versao: dados.versao + 1 };
      const jsonAtual = await salvarDueDiligence(estudoId, salvo, next);
      setSalvo(jsonAtual); setDados(next); setAlterado(false);
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setPendente(false); }
  }
  async function attach(itemId: string, file: File | undefined) {
    if (!file) return;
    if (alterado) { setErro("Salve as etapas antes de anexar arquivos."); return; }
    if (arquivos.some((d) => d.itemId === itemId) && !window.confirm("Substituir o arquivo? O histórico permanece.")) return;
    setBusyItem(itemId); setErro("");
    try { const result = await enviarDocumentoRegistro(estudoId, itemId, file); setArquivos(result.documentos); }
    catch (error) { setErro(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusyItem(null); }
  }
  async function unlink(itemId: string, id: string) {
    if (!window.confirm("Desvincular o arquivo? O histórico permanece.")) return;
    setBusyItem(itemId); setErro("");
    try { const result = await desvincularDocumentoRegistro(estudoId, itemId, id); setArquivos(result.documentos); }
    catch (error) { setErro(error instanceof Error ? error.message : "Falha ao desvincular."); }
    finally { setBusyItem(null); }
  }
  const progresso = progressoDueDiligence(dados);
  return <section className="space-y-4" aria-label="Due Diligence">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-[var(--brand-dark)]">Due Diligence</h2><p className="text-sm text-gray-600">{progresso.concluidos}/{progresso.total} tarefas e documentos concluídos ({progresso.percentual}%).</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => change((d) => ({ ...d, etapas: [...d.etapas, novaEtapa()] }))} className="border border-gray-300 px-3 py-2">Adicionar etapa</button>
        <button type="button" disabled={!alterado || pendente} onClick={() => void save()} className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] px-3 py-2 font-bold disabled:opacity-50">{pendente ? "Salvando..." : "Salvar"}</button></div>
    </div>
    {alterado && <p role="status" className="text-amber-800 text-sm">Há alterações não salvas.</p>}
    {erro && <p role="alert" className="text-red-700 text-sm">{erro}</p>}
    <div aria-label="Fluxograma das etapas" className="space-y-2">
      {dados.etapas.map((etapa, index) => <div key={etapa.id}>
        {index > 0 && <p className="text-center text-[var(--brand-dark)]" aria-hidden="true">↓</p>}
        <article className="border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center"><span className="font-bold">{index + 1}.</span>
            <input aria-label={`Nome da etapa ${index + 1}`} value={etapa.nome} maxLength={180} onChange={(e) => edit(etapa.id, (old) => ({ ...old, nome: e.target.value }))} className={`${field} flex-1`} />
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Mover etapa para cima">↑</button>
            <button type="button" disabled={index === dados.etapas.length - 1} onClick={() => move(index, 1)} aria-label="Mover etapa para baixo">↓</button>
            <button type="button" onClick={() => { if (window.confirm("Excluir esta etapa e seus itens?")) change((d) => ({ ...d, etapas: d.etapas.filter((e) => e.id !== etapa.id) })); }} className="text-red-700">Excluir</button>
          </div>
          <label className="block text-sm">Procedimentos<textarea value={etapa.procedimentos} maxLength={12000} onChange={(e) => edit(etapa.id, (old) => ({ ...old, procedimentos: e.target.value }))} className={`${field} block mt-1`} rows={2} /></label>
          <label className="block text-sm">Observações<textarea value={etapa.observacoes} maxLength={12000} onChange={(e) => edit(etapa.id, (old) => ({ ...old, observacoes: e.target.value }))} className={`${field} block mt-1`} rows={2} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="flex justify-between"><strong>Tarefas</strong><button type="button" onClick={() => edit(etapa.id, (old) => ({ ...old, tarefas: [...old.tarefas, { id: crypto.randomUUID(), titulo: "Nova tarefa", concluida: false }] }))}>+ Tarefa</button></div>
              {etapa.tarefas.map((t) => <div key={t.id} className="flex gap-2 items-center mt-2"><input type="checkbox" checked={t.concluida} aria-label={`Concluir ${t.titulo}`} onChange={(e) => edit(etapa.id, (old) => ({ ...old, tarefas: old.tarefas.map((v) => v.id === t.id ? { ...v, concluida: e.target.checked } : v) }))} /><input value={t.titulo} maxLength={300} aria-label="Tarefa" className={field} onChange={(e) => edit(etapa.id, (old) => ({ ...old, tarefas: old.tarefas.map((v) => v.id === t.id ? { ...v, titulo: e.target.value } : v) }))} /><button type="button" aria-label="Excluir tarefa" onClick={() => edit(etapa.id, (old) => ({ ...old, tarefas: old.tarefas.filter((v) => v.id !== t.id) }))}>×</button></div>)}</div>
            <div><div className="flex justify-between"><strong>Documentos exigidos</strong><button type="button" onClick={() => edit(etapa.id, (old) => ({ ...old, documentos: [...old.documentos, { id: crypto.randomUUID(), nome: "Novo documento", obtido: false }] }))}>+ Documento</button></div>
              {etapa.documentos.map((doc) => { const itemId = `dd_${etapa.id}_${doc.id}`; const current = arquivos.find((a) => a.itemId === itemId); return <div key={doc.id} className="mt-2"><div className="flex gap-2 items-center"><input type="checkbox" checked={doc.obtido} aria-label={`Documento obtido: ${doc.nome}`} onChange={(e) => edit(etapa.id, (old) => ({ ...old, documentos: old.documentos.map((v) => v.id === doc.id ? { ...v, obtido: e.target.checked } : v) }))} /><input value={doc.nome} maxLength={300} aria-label="Documento exigido" className={field} onChange={(e) => edit(etapa.id, (old) => ({ ...old, documentos: old.documentos.map((v) => v.id === doc.id ? { ...v, nome: e.target.value } : v) }))} /><button type="button" aria-label="Excluir documento" onClick={() => edit(etapa.id, (old) => ({ ...old, documentos: old.documentos.filter((v) => v.id !== doc.id) }))}>×</button></div>
                <div className="flex flex-wrap gap-2 text-xs mt-1 pl-6">{current && <a href={`/api/incorporacao/documentos/${encodeURIComponent(current.id)}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{current.nome} ↗</a>}{driveAtivo && <label className="cursor-pointer underline text-blue-700">{current ? "Substituir" : "Anexar"}<input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={alterado || busyItem !== null} onChange={(e) => { void attach(itemId, e.target.files?.[0]); e.target.value = ""; }} /></label>}{current && <button type="button" disabled={busyItem !== null} onClick={() => void unlink(itemId, current.id)} className="text-red-700">Desvincular</button>}</div>
              </div>; })}</div>
          </div>
        </article>
      </div>)}
    </div>
  </section>;
}
