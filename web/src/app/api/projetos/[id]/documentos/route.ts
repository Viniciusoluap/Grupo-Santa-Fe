import { NextRequest, NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo } from "@/lib/segredo";
import { iniciarUploadProjetoDrive, enviarParteProjetoDrive } from "@/lib/incorporacao/registro-drive";
import { projectChecklist, validateProjectUpload, PROJECT_CHUNK_SIZE, type ProjectCheck } from "@/lib/projeto-documentos";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
export const runtime = "nodejs";
type Session = { uid: string; projectId: string; revisionId?: string; itemId: string; kind: "editable" | "pdf"; name: string; mime: string; size: number; location: string; expires: number };
const parseArray = <T,>(value: string | null): T[] => { try { const x = JSON.parse(value || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirModuloAcao("projetos", { somenteEquipe: true });
    const { id: projectId } = await params;
    const project = await prisma.projeto.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    const body = await req.json();
    if (body.action === "start" && body.revisionId != null) {
      // Lote 23/10, etapa 2C: versão revisada entregue no próprio card do pedido.
      validateProjectUpload(body.name, body.size, body.kind);
      const revisionId = String(body.revisionId).slice(0, 40);
      const pedido = await prisma.projetoRevisao.findFirst({ where: { id: revisionId, projetoId: projectId }, select: { id: true } });
      if (!pedido) return NextResponse.json({ error: "Pedido de revisão não encontrado neste projeto." }, { status: 404 });
      const mime = body.kind === "pdf" ? "application/pdf" : String(body.mime || "application/octet-stream").slice(0, 150);
      const itemId = `revisao-${revisionId}`;
      const location = await iniciarUploadProjetoDrive({ projectId, clientId: project.leadId || `projeto-${projectId}`, clientName: project.clienteNome, projectName: project.nome, itemId, itemName: `Revisão ${revisionId}`, kind: body.kind, name: body.name, mime, size: body.size });
      const session: Session = { uid: user.id, projectId, revisionId, itemId, kind: body.kind, name: body.name, mime, size: body.size, location, expires: Date.now() + 24 * 60 * 60 * 1000 };
      return NextResponse.json({ session: criptografarSegredo(JSON.stringify(session)), offset: 0 });
    }
    if (body.action === "start") {
      validateProjectUpload(body.name, body.size, body.kind);
      const existing = parseArray<{id: string; texto: string; feito: boolean}>(project.checklist).map(c => ({ id: c.id, text: c.texto, done: c.feito }));
      let types = parseArray<string>(project.tipo); if (!types.length && project.tipo) types = [project.tipo];
      const checks = projectChecklist(types, existing, Object.fromEntries(Object.entries(PROJETO_TIPO_CONFIG).map(([k,v]) => [k,v.label])));
      const item = checks.find(c => c.id === body.itemId);
      if (!item) return NextResponse.json({ error: "Salve o item do checklist antes de enviar o arquivo." }, { status: 400 });
      const mime = body.kind === "pdf" ? "application/pdf" : String(body.mime || "application/octet-stream").slice(0, 150);
      const location = await iniciarUploadProjetoDrive({ projectId, clientId: project.leadId || `projeto-${projectId}`, clientName: project.clienteNome, projectName: project.nome, itemId: item.id!, itemName: item.text, kind: body.kind, name: body.name, mime, size: body.size });
      const session: Session = { uid: user.id, projectId, itemId: item.id!, kind: body.kind, name: body.name, mime, size: body.size, location, expires: Date.now() + 24 * 60 * 60 * 1000 };
      return NextResponse.json({ session: criptografarSegredo(JSON.stringify(session)), offset: 0 });
    }
    const session = JSON.parse(descriptografarSegredo(String(body.session || ""))) as Session;
    if (session.uid !== user.id || session.projectId !== projectId || session.expires < Date.now()) return NextResponse.json({ error: "Envio expirado. Selecione o arquivo novamente." }, { status: 400 });
    const start = Number(body.offset);
    const bytes = Buffer.from(String(body.chunk || ""), "base64");
    if (!Number.isSafeInteger(start) || start < 0 || bytes.length > PROJECT_CHUNK_SIZE || start + bytes.length > session.size || (bytes.length && start % (256 * 1024) !== 0)) return NextResponse.json({ error: "Parte de arquivo inválida." }, { status: 400 });
    const result = await enviarParteProjetoDrive(session.location, start, session.size, session.mime, bytes);
    if (!result.driveFileId) return NextResponse.json(result);
    if (session.revisionId) {
      const entrega = { nome: session.name, url: `https://drive.google.com/file/d/${result.driveFileId}/view`, driveFileId: result.driveFileId, tipo: session.kind, enviadoEm: new Date().toISOString(), enviadoPor: user.nome || `Usuário ${user.id}` };
      // Acrescenta (nunca sobrescreve) e marca o pedido como entregue; idempotente por driveFileId.
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM projeto_revisoes WHERE id = ${session.revisionId} FOR UPDATE`;
        const atual = await tx.projetoRevisao.findFirstOrThrow({ where: { id: session.revisionId, projetoId: projectId } });
        const entregas = parseArray<{ driveFileId?: string }>(atual.entregas);
        if (!entregas.some(f => f.driveFileId === result.driveFileId)) await tx.projetoRevisao.update({ where: { id: atual.id }, data: { entregas: JSON.stringify([...entregas, entrega]), status: "entregue", entregueEm: new Date(), entreguePorId: user.id } });
      });
      return NextResponse.json({ ...result, entrega });
    }
    const file = { nome: session.name, url: `https://drive.google.com/file/d/${result.driveFileId}/view`, itemId: session.itemId, kind: session.kind, driveFileId: result.driveFileId, data: new Date().toISOString() };
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projetos WHERE id = ${projectId} FOR UPDATE`;
      const current = await tx.projeto.findUniqueOrThrow({ where: { id: projectId } });
      const files = parseArray<{driveFileId?: string}>(current.arquivos);
      if (!files.some(f => f.driveFileId === result.driveFileId)) await tx.projeto.update({ where: { id: projectId }, data: { arquivos: JSON.stringify([...files, file]) } });
    });
    return NextResponse.json({ ...result, file });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o arquivo ao Drive." }, { status: 400 });
  }
}
