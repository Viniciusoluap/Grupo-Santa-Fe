import { NextRequest, NextResponse } from "next/server";
import { criarImovelCore, editarImovelCore } from "@/lib/imoveis/salvar";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pedido de 18/10 (item 4): o formulário de imóveis envia por aqui para a tela
// mostrar o progresso real das fotos. Mesmas regras das ações do formulário.
export async function POST(req: NextRequest) {
  try {
    const dados = await req.formData();
    if (dados.get("id")) await editarImovelCore(dados);
    else await criarImovelCore(dados);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao salvar o imóvel.";
    const status = /autoriza|permiss/i.test(mensagem) ? 403 : 400;
    return NextResponse.json({ error: mensagem }, { status });
  }
}
