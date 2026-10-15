import { NextRequest, NextResponse } from "next/server";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { assinarEstado, origemDaRequisicao, urlAutorizacao } from "@/lib/google-drive-oauth";
import { clienteOAuth, segredoEstado } from "@/lib/google-drive-conexao";
import { voltarConfiguracoes } from "@/lib/google-drive-retorno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conexão do Google Drive com a conta Google do dono (OAuth). Só administrador.
// Mesma rota da Prospecta (server/routes/google-drive.ts).
export async function GET(req: NextRequest) {
  let admin;
  try { admin = await exigirAdminAtivo(); } catch { return voltarConfiguracoes(req, "erro", "Entre como administrador para conectar o Google Drive."); }
  try {
    const origem = origemDaRequisicao(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? undefined);
    const { clientId } = await clienteOAuth();
    return NextResponse.redirect(urlAutorizacao(clientId, origem, assinarEstado(segredoEstado(), admin.id)), 302);
  } catch (erro) {
    return voltarConfiguracoes(req, "erro", erro instanceof Error ? erro.message : "Falha ao iniciar a conexão.");
  }
}
