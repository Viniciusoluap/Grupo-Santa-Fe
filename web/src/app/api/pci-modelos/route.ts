// Lote 2, correção 03 (AD-06): Integrações › "Sub PCI atual" — envio do modelo oficial
// da PCI em partes de 1 MB (mesma tabela de partes do envio de PCI da obra, escopo
// "pci-modelo"). Só admin. Gêmeo de POST /api/pci-modelos do Prospecta.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";
import { MENSAGEM_XLSB_SO_LEITURA, validarNomeModeloPci } from "@/lib/pci-gerador";
import { PARTE_PCI_BYTES, validarMontagemPci, validarPartePci } from "@/lib/obras/pci-validacao";
import { ErroGeradorPci, MENSAGEM_CONFIRMAR_CRITICA_PCI, gravarModeloPci, podeGerenciarModelosPci } from "@/lib/obras/pci-gerador-dados";
export const runtime = "nodejs";

const ESCOPO = "pci-modelo";
const nomeSeguro = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "modelo";

export async function POST(req: NextRequest) {
  try {
    const u = await usuarioAtual();
    if (!u || !u.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    if (!podeGerenciarModelosPci(u)) return NextResponse.json({ error: "Só o administrador envia o modelo da PCI." }, { status: 403 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
    if (body.finalizar === true) {
      if (typeof body.uploadId !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(body.uploadId)) return NextResponse.json({ error: "Identificador de envio inválido." }, { status: 400 });
      const partes = await prisma.$queryRaw<{ chunk_index: number; total_chunks: number; file_name: string; b64: string }[]>`SELECT chunk_index, total_chunks, file_name, encode(data,'base64') AS b64 FROM pci_upload_chunks WHERE upload_id = ${body.uploadId} AND user_id = ${u.id} AND project_id = ${ESCOPO} AND created_at > now() - interval '30 minutes' ORDER BY chunk_index`;
      let nome: string;
      try { nome = nomeSeguro(validarNomeModeloPci(validarMontagemPci(partes))); }
      catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Envio incompleto." }, { status: 400 }); }
      const bytes = new Uint8Array(Buffer.concat(partes.map((p) => Buffer.from(p.b64, "base64"))));
      const observacao = typeof body.observacao === "string" && body.observacao.trim() ? body.observacao.trim().slice(0, 500) : null;
      try {
        const r = await gravarModeloPci(nome, bytes, u.id, observacao);
        return NextResponse.json({ ...r, aviso: r.aguardandoConfirmacao ? MENSAGEM_CONFIRMAR_CRITICA_PCI : r.formato === "xlsb" ? MENSAGEM_XLSB_SO_LEITURA : null });
      } catch (e) {
        if (e instanceof ErroGeradorPci) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
      } finally {
        await prisma.$executeRaw`DELETE FROM pci_upload_chunks WHERE upload_id = ${body.uploadId} AND user_id = ${u.id} AND project_id = ${ESCOPO}`;
      }
    }
    let parte;
    try {
      const nome = validarNomeModeloPci(body.nome);
      // validarPartePci só aceita .xls/.xlsb no nome; a extensão já foi conferida acima.
      parte = { ...validarPartePci({ ...body, nome: "modelo.xls" }), nome };
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message.replace("da PCI", "do modelo") : "Parte inválida." }, { status: 400 }); }
    const data = Buffer.from(parte.chunk, "base64");
    if (!data.length || data.length > PARTE_PCI_BYTES) return NextResponse.json({ error: "Parte do modelo maior que 1 MB." }, { status: 400 });
    await prisma.$executeRaw`DELETE FROM pci_upload_chunks WHERE created_at <= now() - interval '30 minutes'`;
    const inserida = await prisma.$queryRaw<unknown[]>`INSERT INTO pci_upload_chunks(upload_id, chunk_index, total_chunks, user_id, project_id, file_name, data) VALUES (${parte.uploadId}, ${parte.chunkIndex}, ${parte.totalChunks}, ${u.id}, ${ESCOPO}, ${parte.nome}, decode(${parte.chunk}, 'base64')) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET data = EXCLUDED.data WHERE pci_upload_chunks.user_id = EXCLUDED.user_id AND pci_upload_chunks.project_id = EXCLUDED.project_id AND pci_upload_chunks.total_chunks = EXCLUDED.total_chunks AND pci_upload_chunks.file_name = EXCLUDED.file_name RETURNING chunk_index`;
    if (!inserida.length) return NextResponse.json({ error: "Envio inconsistente. Selecione novamente o modelo." }, { status: 409 });
    return NextResponse.json({ recebida: parte.chunkIndex });
  } catch (e) {
    console.error("[pci-gerador] envio do modelo:", e instanceof Error ? e.message : "erro");
    return NextResponse.json({ error: "Erro ao gravar o modelo. Tente novamente." }, { status: 500 });
  }
}
