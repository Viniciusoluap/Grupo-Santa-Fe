"use client";
import { useState, useTransition } from "react";
import { salvarChecklistProjeto } from "@/lib/actions/projetos";
import { projectChecklist, reconcileProjectChecklist } from "@/lib/projeto-documentos";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { uploadProjectDocument } from "@/lib/project-upload";
type Check = { id: string; texto: string; feito: boolean; type?: string; pdfDone?: boolean; editableDone?: boolean };
type FileItem = { nome: string; nomeOriginal?: string; versao?: number; documentId?: string; url: string; data?: string; itemId?: string; kind?: "editable" | "pdf"; driveFileId?: string };
const parse = <T,>(raw: string): T[] => { try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; } };
export default function ProjetoDetailClient({ projetoId, checklistJson, arquivosJson, tipos = [], readOnly = true }: {
  projetoId: string; checklistJson: string; arquivosJson: string; tipos?: string[]; readOnly?: boolean;
  status?: string; statusConfig?: Record<string,{label:string;bgColor:string;color:string}>;
}) {
  const [checks, setChecks] = useState<Check[]>(() => parse<Check>(checklistJson));
  const [files, setFiles] = useState<FileItem[]>(() => parse<FileItem>(arquivosJson));
  const [novo, setNovo] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const checklist = projectChecklist(tipos, checks.map(c => ({ id:c.id, type:c.type, text:c.texto, done:c.feito, pdfDone:c.pdfDone, editableDone:c.editableDone })), Object.fromEntries(Object.entries(PROJETO_TIPO_CONFIG).map(([k,v]) => [k,v.label]))).map(c => ({id:c.id!, type:c.type, texto:c.text, feito:c.done, pdfDone:c.pdfDone, editableDone:c.editableDone}));
  async function excluirDocumento(file: FileItem) {
    if (!file.documentId) return;
    const response = await fetch(`/api/projetos/${projetoId}/documentos`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", documentId: file.documentId }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível remover o documento.");
    setFiles(result.files); setChecks(result.checklist); setMessage("Documento removido e checklist recalculado.");
  }
  function save(updated: Check[]) { startTransition(async () => { try { await salvarChecklistProjeto(projetoId,JSON.stringify(updated)); setChecks(updated); setMessage("Checklist salvo."); } catch(e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar."); } }); }
  return <section className="space-y-4 rounded border border-gray-200 bg-white p-5 text-gray-900">
    <h2 className="font-bold">Checklist e documentos</h2>
    {message && <p role="status" className="text-sm">{message}</p>}
    {!readOnly && <p className="text-sm text-gray-600">Envie arquivo editável e PDF de até 300 MB por item. Salve os tipos do projeto antes de enviar para itens novos.</p>}
    {checklist.map((item,i) => <div key={item.id} className="space-y-2 rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" aria-label={`Concluído: ${item.texto}`} checked={item.feito} disabled title="Concluído automaticamente quando PDF e editável válidos estão anexados." />
        <span className="font-medium">{item.texto}</span>
        {!readOnly && !item.type && <button type="button" className="ml-auto text-sm underline" disabled={pending || uploading} onClick={() => save(checklist.filter((_,n) => i !== n))}>Remover</button>}
      </div>
      {!readOnly && <div className="flex flex-wrap gap-2">{(["editable","pdf"] as const).map(kind => <label key={kind} className="cursor-pointer rounded border px-3 py-2 text-sm">
        {kind === "pdf" ? "Enviar PDF" : "Enviar arquivo editável"}
        <input type="file" className="hidden" accept={kind === "pdf" ? ".pdf,application/pdf" : undefined} disabled={uploading || pending} onChange={async e => { const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploading(true);setProgress(0);setMessage("");try{const uploaded=await uploadProjectDocument(`/api/projetos/${projetoId}/documentos`,file,item.id,kind,setProgress);setFiles(current => { const next=[...current.filter(existing => !(existing.itemId===uploaded.itemId && existing.kind===uploaded.kind)),uploaded]; setChecks(old => reconcileProjectChecklist(old.map(c=>({id:c.id,type:c.type,text:c.texto,done:c.feito})),next.filter(doc=>doc.itemId&&doc.kind).map(doc=>({itemId:doc.itemId!,kind:doc.kind!}))).map(c=>({id:c.id!,type:c.type,texto:c.text,feito:c.done,pdfDone:c.pdfDone,editableDone:c.editableDone}))); return next; });setMessage("Arquivo salvo no Google Drive.");}catch(error){setMessage(error instanceof Error?error.message:"Falha no envio.");}finally{setUploading(false);} }} />
      </label>)}</div>}
      <div className="flex gap-2 text-xs"><span className={item.pdfDone ? "font-bold text-emerald-700" : "text-gray-500"}>PDF {item.pdfDone ? "✓" : "○"}</span><span className={item.editableDone ? "font-bold text-emerald-700" : "text-gray-500"}>Editável {item.editableDone ? "✓" : "○"}</span></div>
      {files.filter(f => f.itemId === item.id).map(f => <div key={f.url} className="flex flex-wrap items-center gap-2 text-sm"><a className="underline" href={f.url} target="_blank" rel="noopener noreferrer">{f.kind === "pdf" ? "PDF" : "Editável"}: {f.nome}</a>{f.nomeOriginal && <span className="text-xs text-gray-500">original: {f.nomeOriginal}</span>}{!readOnly && f.documentId && <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void excluirDocumento(f)}>Excluir</button>}</div>)}
    </div>)}
    {uploading && <p role="status">Enviando ao Google Drive: {progress}%</p>}
    {!readOnly && <div className="flex flex-wrap gap-2"><input aria-label="Novo item do checklist" className="min-w-0 flex-1 border border-gray-200 px-3 py-2" value={novo} onChange={e=>setNovo(e.target.value)} /><button type="button" disabled={!novo.trim() || pending || uploading} className="rounded border px-3 py-2" onClick={()=>{save([...checklist,{id:crypto.randomUUID(),texto:novo.trim(),feito:false}]);setNovo("");}}>Adicionar item</button></div>}
    {files.filter(f => !f.itemId).length > 0 && <div><h3 className="font-semibold">Documentos anteriores</h3>{files.filter(f => !f.itemId).map(f => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block text-sm underline">{f.nome}</a>)}</div>}
  </section>;
}
