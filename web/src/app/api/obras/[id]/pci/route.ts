import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import { PARTE_PCI_BYTES, validarPartePci, validarMontagemPci } from "@/lib/obras/pci-validacao";
import { NextRequest, NextResponse } from "next/server";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { gravarPci, mimePci, obterPci, LIMITE_PCI, PciInvalida } from "@/lib/obras/pci";
import { arquivoResposta, erroAcesso } from "@/lib/obras/medicao-arquivo";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const usuarioId = await exigirObraOuEmpreiteiro(id);
    if (!usuarioId) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const body = await req.json().catch(() => null);
    let nome: string;
    let bytes: Uint8Array;
    if (body?.finalizar === true) {
      if (typeof body.uploadId !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(body.uploadId)) return NextResponse.json({error:"Identificador de envio inválido."},{status:400});
      const partes = await prisma.$queryRaw<{chunk_index:number;total_chunks:number;file_name:string;b64:string}[]>`SELECT chunk_index,total_chunks,file_name,encode(data,'base64') AS b64 FROM pci_upload_chunks WHERE upload_id = ${body.uploadId} AND user_id = ${usuarioId} AND project_id = ${id} AND created_at > now() - interval '30 minutes' ORDER BY chunk_index`;
      try { nome = validarMontagemPci(partes); }
      catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : "Envio incompleto."},{status:400}); }
      bytes = new Uint8Array(Buffer.concat(partes.map(p => Buffer.from(p.b64,"base64"))));
    } else if (body?.chunk !== undefined) {
      let parte;
      try { parte = validarPartePci(body); }
      catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : "Parte inválida."},{status:400}); }
      const data = Buffer.from(parte.chunk,"base64");
      if (!data.length || data.length > PARTE_PCI_BYTES) return NextResponse.json({error:"Parte maior que 1 MB."},{status:400});
      await prisma.$executeRaw`DELETE FROM pci_upload_chunks WHERE created_at <= now() - interval '30 minutes'`;
      const existentes = await prisma.$queryRaw<{n:number}[]>`SELECT count(DISTINCT upload_id)::int AS n FROM pci_upload_chunks WHERE user_id = ${usuarioId} AND upload_id <> ${parte.uploadId}`;
      if (existentes[0].n >= 4) return NextResponse.json({error:"Aguarde os envios anteriores terminarem."},{status:429});
      const inserida = await prisma.$queryRaw<unknown[]>`INSERT INTO pci_upload_chunks(upload_id,chunk_index,total_chunks,user_id,project_id,file_name,data) VALUES (${parte.uploadId},${parte.chunkIndex},${parte.totalChunks},${usuarioId},${id},${parte.nome},decode(${parte.chunk},'base64')) ON CONFLICT(upload_id,chunk_index) DO UPDATE SET data = EXCLUDED.data WHERE pci_upload_chunks.user_id = EXCLUDED.user_id AND pci_upload_chunks.project_id = EXCLUDED.project_id AND pci_upload_chunks.total_chunks = EXCLUDED.total_chunks AND pci_upload_chunks.file_name = EXCLUDED.file_name RETURNING chunk_index`;
      if (!inserida.length) return NextResponse.json({error:"Envio inconsistente. Selecione novamente a PCI."},{status:409});
      return NextResponse.json({recebida:parte.chunkIndex});
    } else {
      const b64 = typeof body?.arquivo === "string" ? body.arquivo.replace(/^data:[^,]*,/, "") : "";
      if (!b64 || b64.length > Math.ceil(LIMITE_PCI / 3) * 4 + 16 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return NextResponse.json({ error: "PCI inválida ou maior que 8 MB." }, { status: 400 });
      nome = typeof body?.nome === "string" ? body.nome.slice(0,255) : "pci.xls";
      bytes = new Uint8Array(Buffer.from(b64,"base64"));
    }
    let gravada;
    try { gravada = await gravarPci(id, nome, bytes, usuarioId); }
    catch (e) { if (e instanceof PciInvalida) return NextResponse.json({ error: e.message }, { status: 400 }); throw e; }
    if (body?.finalizar === true) await prisma.$executeRaw`DELETE FROM pci_upload_chunks WHERE upload_id = ${body.uploadId} AND user_id = ${usuarioId} AND project_id = ${id}`;
    const { parsed, drive } = gravada;
    return NextResponse.json({ arquivo: nome, formato: parsed.formato, proponente: parsed.identificacao.proponente, drive });
  } catch (e) { return erroAcesso(e); }
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await exigirObraOuEmpreiteiro(id);
    const pci = await obterPci(id);
    if (!pci) return NextResponse.json({ error: "PCI não encontrada." }, { status: 404 });
    if (_req.nextUrl.searchParams.has("parte")) {
      const parte = Number(_req.nextUrl.searchParams.get("parte"));
      const total = Math.ceil(pci.versao.dados.length / PARTE_PCI_BYTES);
      const versao = createHash("sha256").update(pci.versao.dados).digest("hex");
      if (!Number.isInteger(parte) || parte < 0 || parte >= total) return NextResponse.json({error:"Parte inválida."},{status:400});
      const esperada = _req.nextUrl.searchParams.get("versao");
      if (esperada && esperada !== versao) return NextResponse.json({error:"A PCI foi alterada durante o download. Tente novamente."},{status:409});
      const resposta = arquivoResposta(pci.versao.dados.slice(parte * PARTE_PCI_BYTES,(parte + 1)*PARTE_PCI_BYTES),pci.versao.nome,"application/octet-stream");
      resposta.headers.set("X-PCI-Partes",String(total));
      resposta.headers.set("X-PCI-Versao",versao);
      return resposta;
    }
    return arquivoResposta(pci.versao.dados, pci.versao.nome, mimePci((pci.versao.parsed as { formato?: string } | null)?.formato ?? "xls"));
  } catch (e) { return erroAcesso(e); }
}
