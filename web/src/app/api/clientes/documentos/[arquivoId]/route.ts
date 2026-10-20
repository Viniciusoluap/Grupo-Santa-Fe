import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {obterItemDocumento,type TipoChecklist} from "@/lib/documentos-cliente";
import {lerDocumentoRegistro} from "@/lib/incorporacao/registro-drive";
export async function GET(req:NextRequest,{params}:{params:Promise<{arquivoId:string}>}){
 try{const {arquivoId}=await params;const tipo:TipoChecklist=req.nextUrl.searchParams.get("tipo")==="financiamento"?"financiamento":"crm";const{item}=await obterItemDocumento(tipo,req.nextUrl.searchParams.get("itemId")||"");if(item.arquivoId!==arquivoId)throw new Error("Documento não encontrado.");const file=await prisma.arquivo.findUniqueOrThrow({where:{id:arquivoId}});const bytes=file.driveFileId?await lerDocumentoRegistro(file.driveFileId):file.dados;if(!bytes)throw new Error("Arquivo indisponível.");return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":file.mime,"Content-Disposition":`inline; filename="${encodeURIComponent(file.nome)}"`,"Cache-Control":"private, no-store"}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Acesso não autorizado."},{status:403});}
}
