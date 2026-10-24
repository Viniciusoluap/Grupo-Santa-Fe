"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import type {TipoChecklist} from "@/lib/documentos-cliente";
import { LIMITE_DOCUMENTO_BYTES, PARTE_DOCUMENTO_BYTES } from "@/lib/documentos-upload-partes-limites";
type Item={id:string;nome:string;visivelCliente:boolean;solicitadoEm:string|null;emailSolicitadoEm:string|null;arquivoId:string|null;enviadoEm:string|null};
export function ChecklistDocumentos({tipo,id}:{tipo:TipoChecklist;id:string}) {
  const router=useRouter();const[items,setItems]=useState<Item[]>([]);const[anteriores,setAnteriores]=useState<Item[]>([]);const[interno,setInterno]=useState(false);const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);
  const endpoint=`/api/clientes/documentos?tipo=${tipo}&id=${encodeURIComponent(id)}`;
  const load=useCallback(async()=>{const r=await fetch(endpoint,{cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error);setItems(b.items);setAnteriores(b.anteriores??[]);setInterno(b.interno);},[endpoint]);
  useEffect(()=>{load().catch(e=>setMsg(e.message));},[load]);
  async function acao(itemId:string,acao:string,visivel?:boolean){setBusy(true);setMsg("");try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId,acao,visivel})});const b=await r.json();if(!r.ok)throw new Error(b.error);setMsg(b.aviso|| (acao==="solicitar"?"Solicitação registrada e aviso enviado.":acao==="excluir_definitivo"?"Documento excluído definitivamente.":"Visibilidade atualizada."));await load();router.refresh();}catch(e){setMsg(e instanceof Error?e.message:"Falha na operação.");}finally{setBusy(false);}}
  async function upload(itemId:string,file?:File){if(!file)return;if(!file.size||file.size>LIMITE_DOCUMENTO_BYTES){setMsg("Envie um arquivo de até 20 MiB.");return;}setBusy(true);setMsg("");try{
    const uploadId=crypto.randomUUID(),total=Math.ceil(file.size/PARTE_DOCUMENTO_BYTES);
    async function enviar(dados:Record<string,unknown>){const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId,uploadId,...dados})});const b=await r.json();if(!r.ok)throw new Error(b.error||"Falha no envio.");}
    for(let parte=0;parte<total;parte++){
      const slice=file.slice(parte*PARTE_DOCUMENTO_BYTES,(parte+1)*PARTE_DOCUMENTO_BYTES);
      const chunk=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Falha ao ler arquivo."));reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.readAsDataURL(slice);});
      await enviar({acao:"parte",parte,total,nome:file.name,chunk});
      setMsg(`Enviando ${parte+1}/${total} partes…`);
    }
    await enviar({acao:"finalizar"});
    setMsg("Documento salvo no Google Drive.");await load();router.refresh();
  }catch(e){setMsg(e instanceof Error?e.message:"Falha no envio.");}finally{setBusy(false);}}
  async function baixar(item:Item){if(!item.arquivoId)return;setBusy(true);setMsg("");try{
    const partes:Uint8Array[]=[];let offset=0,total=0;do{
      const r=await fetch(`/api/clientes/documentos/${item.arquivoId}?tipo=${tipo}&itemId=${item.id}&offset=${offset}`,{cache:"no-store"});
      if(!r.ok)throw new Error("Falha ao consultar documento.");
      total=Number(r.headers.get("X-Document-Size"));if(!Number.isSafeInteger(total)||total<1||total>LIMITE_DOCUMENTO_BYTES)throw new Error("Arquivo inválido.");
      const bytes=new Uint8Array(await r.arrayBuffer());if(!bytes.length||offset+bytes.length>total)throw new Error("Arquivo incompleto.");
      partes.push(bytes);offset+=bytes.length;
    }while(offset<total);
    const url=URL.createObjectURL(new Blob(partes as BlobPart[]));const link=document.createElement("a");link.href=url;link.download=item.nome;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){setMsg(e instanceof Error?e.message:"Falha ao consultar documento.");}finally{setBusy(false);}}
  return <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-gray-900"><h2 className="font-bold">{tipo==="crm"?"Documentos do cliente":"Documentos do financiamento e imóvel"}</h2><p className="text-sm text-gray-600">Nenhum documento é obrigatório. Arquivos enviados são salvos no Google Drive.</p>{msg&&<p role="status" className="text-sm text-blue-800">{msg}</p>}{items.map(item=><div key={item.id} className="space-y-2 rounded border border-gray-200 p-3"><p className="font-semibold">{item.nome}</p><p className="text-xs text-gray-600">{item.enviadoEm&&(!item.solicitadoEm||new Date(item.enviadoEm)>new Date(item.solicitadoEm))?"Enviado":item.solicitadoEm?"Solicitado":"Disponível"}</p>{interno&&<div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.visivelCliente} disabled={busy} onChange={e=>void acao(item.id,"visibilidade",e.target.checked)}/>Visível ao cliente</label><button type="button" disabled={busy||!item.visivelCliente} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void acao(item.id,"solicitar")}>{item.solicitadoEm&&!item.emailSolicitadoEm?"Tentar aviso novamente":"Solicitar documento"}</button></div>}{item.arquivoId&&<button type="button" disabled={busy} className="block text-sm text-blue-800 underline" onClick={()=>void baixar(item)}>Baixar documento</button>}{(interno||item.solicitadoEm)&&<label className="inline-flex cursor-pointer rounded border border-gray-300 px-3 py-2 text-sm font-semibold">{busy?"Enviando…":"Enviar"}<input type="file" className="sr-only" disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" onChange={e=>{void upload(item.id,e.target.files?.[0]);e.currentTarget.value="";}}/></label>}</div>)}{interno&&anteriores.length>0&&<details className="rounded border border-gray-200 p-3"><summary className="cursor-pointer font-semibold">Documentos anteriores</summary>{anteriores.map(item=><div key={item.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="min-w-0 break-words">{item.nome}</span><div className="flex gap-2">{item.arquivoId&&<button type="button" disabled={busy} className="rounded border px-3 py-1 text-sm" onClick={()=>void baixar(item)}>Consultar</button>}<button type="button" disabled={busy} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={()=>{if(window.confirm(`Excluir definitivamente "${item.nome}"? O registro e o arquivo serão apagados e não poderão ser recuperados pelo sistema.`))void acao(item.id,"excluir_definitivo");}}>Remover</button></div></div>)}</details>}</section>;
}
