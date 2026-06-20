// Connection is managed via the salvarConexaoBusiness server action.
// This route is kept as a stub for future extensibility.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use a aba Conexão para configurar via Business API" }, { status: 400 });
}
