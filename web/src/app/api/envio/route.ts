import { NextRequest, NextResponse } from "next/server";
import { enviarDocumentoRegistro } from "@/lib/actions/documentos-registro";
import { uploadKml, uploadLevantamento } from "@/lib/actions/incorporacao";
import { uploadContratoAssinado } from "@/lib/actions/juridico";
import { enviarContratoAssinadoPortal } from "@/lib/actions/portal";
import { salvarArquivosProjeto } from "@/lib/actions/projetos";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pedido de 18/10: todos os envios de arquivo mostram o percentual real. O
// navegador só informa o andamento em requisições comuns (não nas ações do
// servidor), então estes envios passam por aqui e chamam a mesma ação de antes —
// com as mesmas regras de acesso, validações e resultado.
const texto = (dados: FormData, campo: string) => {
  const v = dados.get(campo);
  if (typeof v !== "string" || !v || v.length > 200) throw new Error("Envio inválido.");
  return v;
};

const ACOES: Record<string, (dados: FormData) => Promise<unknown>> = {
  "incorporacao.documento": (d) => {
    const arquivo = d.get("arquivo");
    if (!(arquivo instanceof File)) throw new Error("Selecione um arquivo.");
    return enviarDocumentoRegistro(texto(d, "estudoId"), texto(d, "itemId"), arquivo);
  },
  "incorporacao.kml": (d) => uploadKml(texto(d, "estudoId"), d),
  "incorporacao.levantamento": (d) => uploadLevantamento(texto(d, "estudoId"), d),
  "juridico.contratoAssinado": (d) => uploadContratoAssinado(texto(d, "contratoId"), d),
  "portal.contratoAssinado": (d) => enviarContratoAssinadoPortal(texto(d, "contratoId"), d),
  "projetos.arquivos": (d) => {
    const arquivos = d.get("arquivos");
    if (typeof arquivos !== "string") throw new Error("Envio inválido.");
    return salvarArquivosProjeto(texto(d, "projetoId"), arquivos);
  },
};

export async function POST(req: NextRequest) {
  try {
    const dados = await req.formData();
    const acao = ACOES[String(dados.get("acao") ?? "")];
    if (!acao) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    const resultado = await acao(dados);
    return NextResponse.json({ ok: true, resultado: resultado ?? null });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha no envio.";
    const status = /autoriza|permiss|sess/i.test(mensagem) ? 403 : 400;
    return NextResponse.json({ error: mensagem }, { status });
  }
}
