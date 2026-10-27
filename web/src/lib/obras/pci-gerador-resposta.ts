// Lote 2, correção 03: resposta de download do Gerador de PCI — arquivo inteiro
// ou, com ?parte=N, partes de 1 MB (limite de resposta da Vercel). Mesmo contrato
// das rotas do Prospecta (server/pci-gerador.ts): X-Arquivo-Partes / X-Arquivo-Versao.
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { arquivoResposta } from "@/lib/obras/medicao-arquivo";
import { PARTE_PCI_BYTES } from "@/lib/obras/pci-validacao";

export function respostaArquivoEmPartes(req: NextRequest, bytes: Uint8Array, nome: string, mime: string) {
  if (!req.nextUrl.searchParams.has("parte")) return arquivoResposta(bytes, nome, mime);
  const parte = Number(req.nextUrl.searchParams.get("parte"));
  const total = Math.max(1, Math.ceil(bytes.length / PARTE_PCI_BYTES));
  const versao = createHash("sha256").update(bytes).digest("hex");
  if (!Number.isInteger(parte) || parte < 0 || parte >= total) return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
  const esperada = req.nextUrl.searchParams.get("versao");
  if (esperada && esperada !== versao) return NextResponse.json({ error: "O arquivo foi alterado durante o download. Tente novamente." }, { status: 409 });
  const resposta = arquivoResposta(bytes.slice(parte * PARTE_PCI_BYTES, (parte + 1) * PARTE_PCI_BYTES), nome, mime);
  resposta.headers.set("X-Arquivo-Partes", String(total));
  resposta.headers.set("X-Arquivo-Versao", versao);
  return resposta;
}
