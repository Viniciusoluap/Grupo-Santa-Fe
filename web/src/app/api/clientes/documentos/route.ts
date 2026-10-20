import { NextRequest,NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { autorizarClienteDocumentos,garantirDocumentosCliente,obterItemDocumento,solicitarItemDocumento,type TipoChecklist } from "@/lib/documentos-cliente";
import { DOCUMENTOS_CLIENTE,ordenarDocumentosFinanciamento } from "@/lib/documentos-cliente-padrao";
import { atualizarChecklistFinanciamento } from "@/lib/crm/vinculo-lead";
import { uploadDocumentoCliente } from "@/lib/incorporacao/registro-drive";
export const runtime="nodejs";
export const maxDuration=60;
const tipoReq=(req:NextRequest):TipoChecklist=>req.nextUrl.searchParams.get("tipo")==="financiamento"?"financiamento":"crm";
export async function GET(req:NextRequest) {
  try {
    const tipo=tipoReq(req),id=req.nextUrl.searchParams.get("id")||"";
    const {u,lead}=await autorizarClienteDocumentos(tipo,id);
    if(tipo==="crm") {
      await garantirDocumentosCliente(lead.id);
      const docs=await prisma.documentoCliente.findMany({where:{leadId:lead.id,...(u.perfil==="cliente"?{visivelCliente:true}:{})}});
      return NextResponse.json({items:DOCUMENTOS_CLIENTE.flatMap(d=>{const row=docs.find(x=>x.tipo===d.chave);return row?[{...row,nome:d.nome}]:[]}),interno:u.perfil!=="cliente"});
    }
    await atualizarChecklistFinanciamento(id);
    const docs=await prisma.checklistItem.findMany({where:{financiamentoId:id,legado:false,...(u.perfil==="cliente"?{visivelCliente:true}:{})}});
    return NextResponse.json({items:ordenarDocumentosFinanciamento(docs).map(d=>({...d,nome:d.item})),interno:u.perfil!=="cliente"});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao ler documentos."},{status:403});}
}
export async function POST(req:NextRequest) {
  try {
    const tipo=tipoReq(req);
    if(req.headers.get("content-type")?.includes("application/json")) {
      const b=await req.json();
      const {item,u}=await obterItemDocumento(tipo,String(b.itemId??""));
      if(u.perfil==="cliente") throw new Error("Somente a equipe configura documentos.");
      if(b.acao==="visibilidade") {
        if(typeof b.visivel!=="boolean") throw new Error("Visibilidade inválida.");
        if(tipo==="crm") await prisma.documentoCliente.update({where:{id:item.id},data:{visivelCliente:b.visivel}});
        else await prisma.checklistItem.update({where:{id:item.id},data:{visivelCliente:b.visivel}});
        return NextResponse.json({ok:true});
      }
      if(b.acao!=="solicitar") throw new Error("Ação inválida.");
      return NextResponse.json(await solicitarItemDocumento(tipo,item.id));
    }
    const dados=await req.formData();
    const {item,u,lead,nome,financiamentoId}=await obterItemDocumento(tipo,String(dados.get("itemId")??""));
    if ("legado" in item && item.legado) throw new Error("Documento anterior disponível somente para leitura.");
    const file=dados.get("arquivo");
    if(!(file instanceof File)||!file.size||file.size>3*1024*1024) throw new Error("Envie um arquivo de até 3 MB.");
    if(u.perfil==="cliente" && !item.solicitadoEm) throw new Error("Este documento ainda não foi solicitado.");
    const ext=file.name.split(".").pop()?.toLowerCase();
    const mime:Record<string,string>={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
    if(!ext||!mime[ext]) throw new Error("Envie PDF, JPG, PNG, XLS ou XLSX.");
    const bytes=Buffer.from(await file.arrayBuffer());
    if((ext==="pdf"&&bytes.subarray(0,4).toString()!=="%PDF")||((ext==="jpg"||ext==="jpeg")&&!(bytes[0]===255&&bytes[1]===216))||(ext==="png"&&!bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])))) throw new Error("Arquivo não corresponde ao formato informado.");
    const driveFileId=await uploadDocumentoCliente({leadId:lead.id,area:tipo==="crm"?"atendimento":"financiamento",rotulo:financiamentoId?`${financiamentoId} — ${nome}`:nome,nomeOriginal:file.name,mime:mime[ext],bytes});
    await prisma.$transaction(async tx=>{
      const arquivo=await tx.arquivo.create({data:{nome:file.name.slice(0,200),mime:mime[ext],tamanho:bytes.length,driveFileId}});
      await tx.documentoClienteVersao.create({data:{leadId:lead.id,tipoChecklist:tipo,itemId:item.id,arquivoId:arquivo.id}});
      if(item.arquivoId) await tx.documentoClienteVersao.upsert({where:{arquivoId:item.arquivoId},create:{leadId:lead.id,tipoChecklist:tipo,itemId:item.id,arquivoId:item.arquivoId},update:{}});
      const data={arquivoId:arquivo.id,enviadoEm:new Date()};
      if(tipo==="crm") await tx.documentoCliente.update({where:{id:item.id},data});
      else await tx.checklistItem.update({where:{id:item.id},data:{...data,concluido:false}});
    });
    revalidatePath("/portal/documentos");revalidatePath("/portal/financiamento");revalidatePath(`/admin/leads/${lead.id}`);
    if(financiamentoId)revalidatePath(`/admin/financiamentos/${financiamentoId}`);
    return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao enviar documento."},{status:400});}
}
