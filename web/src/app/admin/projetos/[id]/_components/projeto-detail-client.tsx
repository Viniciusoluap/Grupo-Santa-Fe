"use client";
import { useState, useTransition } from "react";
import { salvarChecklistProjeto } from "@/lib/actions/projetos";
import { projectChecklist } from "@/lib/projeto-documentos";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { uploadProjectDocument } from "@/lib/project-upload";
type Check = { id: string; texto: string; feito: boolean; type?: string };
type FileItem = { nome: string; url: string; data?: string; itemId?: string; kind?: "editable" | "pdf"; driveFileId?: string };
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
  const checklist = projectChecklist(tipos, checks.map(c => ({ id:c.id, type:c.type, text:c.texto, done:c.feito })), Object.fromEntries(Object.entries(PROJETO_TIPO_CONFIG).map(([k,v]) => [k,v.label]))).map(c => ({id:c.id!, type:c.type, texto:c.text, feito:c.done}));
  function save(updated: Check[]) { startTransition(async () => { try { await salvarChecklistProjeto(projetoId,JSON.stringify(updated)); setChecks(updated); setMessage("Checklist salvo."); } catch(e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar."); } }); }
  return <section className="space-y-4 rounded border border-gray-200 bg-white p-5 text-gray-900">
    <h2 className="font-bold">Checklist e documentos</h2>
    {message && <p role="status" className="text-sm">{message}</p>}
    {!readOnly && <p className="text-sm text-gray-600">Envie arquivo editável e PDF de até 300 MB por item. Salve os tipos do projeto antes de enviar para itens novos.</p>}
    {checklist.map((item,i) => <div key={item.id} className="space-y-2 rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" aria-label={`Concluído: ${item.texto}`} checked={item.feito} disabled={readOnly || pending || uploading} onChange={e => save(checklist.map((c,n) => n === i ? {...c,feito:e.target.checked} : c))} />
        <span className="font-medium">{item.texto}</span>
        {!readOnly && !item.type && <button type="button" className="ml-auto text-sm underline" disabled={pending || uploading} onClick={() => save(checklist.filter((_,n) => i !== n))}>Remover</button>}
      </div>
      {!readOnly && <div className="flex flex-wrap gap-2">{(["editable","pdf"] as const).map(kind => <label key={kind} className="cursor-pointer rounded border px-3 py-2 text-sm">
        {kind === "pdf" ? "Enviar PDF" : "Enviar arquivo editável"}
        <input type="file" className="hidden" accept={kind === "pdf" ? ".pdf,application/pdf" : undefined} disabled={uploading || pending} onChange={async e => { const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploading(true);setProgress(0);setMessage("");try{const uploaded=await uploadProjectDocument(`/api/projetos/${projetoId}/documentos`,file,item.id,kind,setProgress);setFiles(f=>[...f,uploaded]);setMessage("Arquivo salvo no Google Drive.");}catch(error){setMessage(error instanceof Error?error.message:"Falha no envio.");}finally{setUploading(false);} }} />
      </label>)}</div>}
      {files.filter(f => f.itemId === item.id).map(f => <a key={f.url} className="block text-sm underline" href={f.url} target="_blank" rel="noopener noreferrer">{f.kind === "pdf" ? "PDF" : "Editável"}: {f.nome}</a>)}
    </div>)}
    {uploading && <p role="status">Enviando ao Google Drive: {progress}%</p>}
    {!readOnly && <div className="flex flex-wrap gap-2"><input aria-label="Novo item do checklist" className="min-w-0 flex-1 border border-gray-200 px-3 py-2" value={novo} onChange={e=>setNovo(e.target.value)} /><button type="button" disabled={!novo.trim() || pending || uploading} className="rounded border px-3 py-2" onClick={()=>{save([...checklist,{id:crypto.randomUUID(),texto:novo.trim(),feito:false}]);setNovo("");}}>Adicionar item</button></div>}
    {files.filter(f => !f.itemId).length > 0 && <div><h3 className="font-semibold">Documentos anteriores</h3>{files.filter(f => !f.itemId).map(f => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block text-sm underline">{f.nome}</a>)}</div>}
  </section>;
}
