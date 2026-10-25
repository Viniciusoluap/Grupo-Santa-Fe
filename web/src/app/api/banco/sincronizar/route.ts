import { NextRequest, NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { sincronizarConta } from "@/lib/bancos";

// Pedido de 25/10: a sincronização (Asaas ou Pluggy, com data inicial) fica em @/lib/bancos,
// a mesma usada pela tela do BPO e pelo cron diário. Esta rota continua por compatibilidade.
export async function POST(req: NextRequest) {
  try {
    await exigirModuloAcao("bpo");
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { contaId } = (await req.json().catch(() => ({}))) as { contaId?: string };
  if (!contaId) return NextResponse.json({ error: "Conta não informada" }, { status: 400 });
  try {
    return NextResponse.json(await sincronizarConta(String(contaId)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao sincronizar" }, { status: 404 });
  }
}
