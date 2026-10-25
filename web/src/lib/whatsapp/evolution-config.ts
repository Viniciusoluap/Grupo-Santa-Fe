import "server-only";
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo, segredoEmTextoPuro } from "@/lib/segredo";
import { normalizarUrlEvolution, type EvolutionConfig } from "@/lib/evolution";

// Pedido de 25/10: servidor da Evolution (QR code) salvo pela tela, na tabela de configurações
// (chave criptografada). Variáveis EVOLUTION_API_URL/KEY ficam como reserva.
// LOTE B (25/10): só Configurações › Integrações grava aqui (salvarConfigEvolution).
// Gêmeo de `configEvolution` em Prospecta/server/whatsapp-router.ts.
const URL_CHAVE = "whatsapp.evolution.url";
const KEY_CHAVE = "whatsapp.evolution.apiKey";

export async function configEvolution(): Promise<(EvolutionConfig & { fonte: "banco" | "env" }) | null> {
  const linhas = await prisma.configuracao.findMany({ where: { chave: { in: [URL_CHAVE, KEY_CHAVE] } } });
  const url = linhas.find((l) => l.chave === URL_CHAVE)?.valor;
  const cifrada = linhas.find((l) => l.chave === KEY_CHAVE)?.valor;
  if (url && cifrada) {
    const apiKey = descriptografarSegredo(cifrada);
    if (segredoEmTextoPuro(cifrada)) {
      await prisma.configuracao.update({ where: { chave: KEY_CHAVE }, data: { valor: criptografarSegredo(apiKey) } });
    }
    return { url: normalizarUrlEvolution(url), apiKey, fonte: "banco" };
  }
  const envUrl = process.env.EVOLUTION_API_URL, envKey = process.env.EVOLUTION_API_KEY;
  return envUrl && envKey ? { url: normalizarUrlEvolution(envUrl), apiKey: envKey, fonte: "env" } : null;
}

export async function urlServidorEvolution(): Promise<string | null> {
  const l = await prisma.configuracao.findUnique({ where: { chave: URL_CHAVE } });
  const url = l?.valor ?? (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY ? process.env.EVOLUTION_API_URL : null);
  return url ? normalizarUrlEvolution(url) : null;
}

export async function salvarConfigEvolution(url: string, apiKey: string): Promise<void> {
  const limpa = normalizarUrlEvolution(url);
  await prisma.$transaction([
    prisma.configuracao.upsert({ where: { chave: URL_CHAVE }, create: { chave: URL_CHAVE, valor: limpa, grupo: "whatsapp" }, update: { valor: limpa } }),
    prisma.configuracao.upsert({
      where: { chave: KEY_CHAVE },
      create: { chave: KEY_CHAVE, valor: criptografarSegredo(apiKey.trim()), grupo: "whatsapp" },
      update: { valor: criptografarSegredo(apiKey.trim()) },
    }),
  ]);
}
