import "server-only";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { baixarMidiaEvolution, LIMITE_MIDIA, mesmoTelefone } from "@/lib/evolution";
import { configEvolution } from "@/lib/whatsapp/evolution-config";
import { chaveTelefone } from "@/lib/whatsapp/conversas";
import { copiarParaDrive, lixeiraDeArquivosSemUso } from "@/lib/drive-organizacao";

export async function guardarMidia(mensagemId: string, base64: string, dados: { mime?: string | null; nome?: string | null }): Promise<boolean> {
  const conteudo = Buffer.from(base64, "base64");
  if (!conteudo.length || conteudo.length > LIMITE_MIDIA) return false;
  const anterior = (await prisma.whatsappMidia.findUnique({ where: { mensagemId }, select: { driveFileId: true } }))?.driveFileId ?? null;
  await prisma.$transaction([
    prisma.whatsappMidia.upsert({ where: { mensagemId }, create: { mensagemId, conteudo }, update: { conteudo, driveFileId: null } }),
    prisma.mensagemWhatsapp.update({ where: { id: mensagemId }, data: {
      midiaTamanho: conteudo.length,
      ...(dados.mime ? { midiaMime: dados.mime } : {}),
      ...(dados.nome ? { midiaNome: dados.nome } : {}),
    } }),
  ]);
  // Pedido de 29/10: cópia em Clientes/<Nome>/Atendimento/WhatsApp ou WhatsApp sem cliente/<número>.
  if (anterior) await lixeiraDeArquivosSemUso([anterior]);
  await copiarParaDrive("whatsapp", mensagemId);
  return true;
}

export async function baixarEGuardarMidia(mensagemId: string, instancia: string, externalId: string, tamanho: number | null): Promise<{ ok: boolean; motivo?: string }> {
  if (tamanho && tamanho > LIMITE_MIDIA) return { ok: false, motivo: "Arquivo maior que 10 MB: fica só o aviso." };
  try {
    const c = await configEvolution();
    if (!c) return { ok: false, motivo: "Servidor do WhatsApp não configurado." };
    const arquivo = await baixarMidiaEvolution(c, instancia, externalId);
    if (!arquivo) return { ok: false, motivo: "A Evolution não entregou o arquivo." };
    if (!(await guardarMidia(mensagemId, arquivo.base64, arquivo))) return { ok: false, motivo: "Arquivo maior que 10 MB: fica só o aviso." };
    return { ok: true };
  } catch (e) {
    console.error("[whatsapp-midia]", e instanceof Error ? e.message : "falha");
    return { ok: false, motivo: e instanceof Error ? e.message : "Falha ao baixar o arquivo." };
  }
}

export async function mensagemWhatsappAcessivel(id: string) {
  const u = await usuarioAtual();
  if (!u?.ativo || !podeAcessarModulo(u, "whatsapp")) return null;
  const dono = await donoDaConexaoWhatsApp(u.id, u.perfil);
  if (!dono) return null;
  const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } });
  if (!conn) return null;
  const msg = await prisma.mensagemWhatsapp.findFirst({ where: { id, conexaoId: conn.id }, include: { midia: true } });
  if (!msg) return null;
  if (u.perfil === "corretor") {
    // Lote 03, correção 02: vínculo manual da conversa primeiro.
    const vinculo = await prisma.whatsappVinculoConversa.findUnique({ where: { conexaoId_chaveTelefone: { conexaoId: conn.id, chaveTelefone: chaveTelefone(msg.destinatario) } }, select: { leadId: true } });
    let leadId = vinculo?.leadId ?? msg.leadId;
    if (!leadId) {
      const todas = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, select: { destinatario: true, leadId: true } });
      leadId = todas.find((m) => m.leadId && mesmoTelefone(m.destinatario, msg.destinatario))?.leadId ?? null;
    }
    if (leadId && !(await prisma.lead.findFirst({ where: { id: leadId, corretorId: u.corretorId }, select: { id: true } }))) return null;
  }
  return { ...msg, instancia: conn.provedor === "evolution" ? conn.instancia : null };
}

export function tipoDeEntrega(mime: string | null, tipo: string | null): { mime: string; inline: boolean } {
  if (mime?.toLowerCase().split(";")[0].trim() === "application/pdf") return { mime: "application/pdf", inline: true };
  const m = (mime ?? "").toLowerCase();
  const seguro = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/[\w.+-]+)$/.test(m);
  return seguro && tipo !== "documento" ? { mime: m, inline: true } : { mime: "application/octet-stream", inline: false };
}
