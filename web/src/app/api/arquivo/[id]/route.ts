import { NextRequest, NextResponse } from "next/server";
import { obterItemDocumento } from "@/lib/documentos-cliente";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { lerDocumentoRegistro } from "@/lib/incorporacao/registro-drive";

export const runtime = "nodejs";

// Serve um arquivo armazenado no banco. Exige sessão autenticada (qualquer papel
// logado — inclui o cliente do portal, que baixa seus contratos). O id é um cuid
// não-adivinhável, então mesmo entre usuários logados o acesso é por posse do id.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const arquivo = await prisma.arquivo.findUnique({ where: { id } });
  if (!arquivo) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  // Documentos de checklist exigem vínculo e visibilidade também pela URL legada.
  // Lote 23/10, etapa 6: o mesmo arquivo pode estar no lead original e no duplicado;
  // basta o usuário ter acesso a um dos documentos que o usam.
  const [pessoais, financiamento, historico] = await Promise.all([
    prisma.documentoCliente.findMany({where:{arquivoId:id},select:{id:true}}),
    prisma.checklistItem.findFirst({where:{arquivoId:id},select:{id:true}}),
    prisma.documentoClienteVersao.findUnique({where:{arquivoId:id}}),
  ]);
  const candidatos: Array<["crm" | "financiamento", string]> = [
    ...pessoais.map((p): ["crm", string] => ["crm", p.id]),
    ...(financiamento ? [["financiamento", financiamento.id] as ["financiamento", string]] : []),
    ...(historico ? [[historico.tipoChecklist === "crm" ? "crm" : "financiamento", historico.itemId] as ["crm" | "financiamento", string]] : []),
  ];
  if (candidatos.length) {
    let autorizado = false;
    for (const [tipo, itemId] of candidatos) {
      try { await obterItemDocumento(tipo, itemId); autorizado = true; break; } catch { /* tenta o próximo vínculo */ }
    }
    if (!autorizado) return NextResponse.json({error:"Documento não disponível."},{status:403});
  }

  // Bytes no banco servem o app (pedido de 29/10: o Drive guarda uma cópia
  // organizada); contratos gravados só no Google Drive são lidos de lá.
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = arquivo.dados ? new Uint8Array(arquivo.dados)
      : arquivo.driveFileId ? new Uint8Array(await lerDocumentoRegistro(arquivo.driveFileId)) : new Uint8Array();
  } catch {
    return NextResponse.json({ error: "Arquivo indisponível no Google Drive no momento." }, { status: 502 });
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": arquivo.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(arquivo.nome)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
