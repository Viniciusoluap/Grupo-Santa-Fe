import { NextResponse } from "next/server";
export function arquivoResposta(bytes: Uint8Array, nome: string, mime: string) {
  const seguro = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\- ]/g, "").slice(0, 180) || "medicao";
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename="${seguro}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
export function erroAcesso(e: unknown) {
  const mensagem = e instanceof Error ? e.message : "";
  if (/autorizado|permissão|vinculada|acesso/i.test(mensagem)) return NextResponse.json({ error: "Sem permissão para acessar esta obra." }, { status: 403 });
  console.error("[medicao-caixa] falha", e);
  return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 500 });
}
