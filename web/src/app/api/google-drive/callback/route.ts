import { NextRequest } from "next/server";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { descreverErroDrive } from "@/lib/drive-erro";
import { origemDaRequisicao, verificarEstado } from "@/lib/google-drive-oauth";
import { concluirConexao, segredoEstado } from "@/lib/google-drive-conexao";
import { voltarIntegracoes } from "@/lib/google-drive-retorno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Volta do Google: confere o state assinado (mesmo administrador, até 10 min),
// troca o código pelo token (gravado criptografado) e volta para Integrações.
export async function GET(req: NextRequest) {
  try {
    let admin;
    try { admin = await exigirAdminAtivo(); } catch { admin = null; }
    const p = req.nextUrl.searchParams;
    if (!admin || verificarEstado(segredoEstado(), p.get("state") ?? "") !== admin.id)
      return voltarIntegracoes(req, "erro", "A conexão expirou ou foi iniciada por outro usuário. Clique em Conectar de novo.");
    const erroGoogle = p.get("error");
    if (erroGoogle) return voltarIntegracoes(req, "erro", erroGoogle === "access_denied" ? "Você cancelou a autorização no Google." : `O Google recusou: ${erroGoogle}`);
    const codigo = p.get("code");
    if (!codigo) return voltarIntegracoes(req, "erro", "O Google não devolveu o código de autorização.");
    await concluirConexao(codigo, origemDaRequisicao(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? undefined), admin.id);
    return voltarIntegracoes(req, "ok");
  } catch (erro) {
    // Só a explicação legível: nunca código, token ou segredo no log/URL.
    console.error("[google-drive] conexão falhou:", erro instanceof Error ? erro.message : "erro desconhecido");
    return voltarIntegracoes(req, "erro", erro instanceof Error && !/oauth|Google Drive falhou/i.test(erro.message) ? erro.message : descreverErroDrive(erro));
  }
}
