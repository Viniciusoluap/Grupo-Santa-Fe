"use server";
// Paridade 17/11 bloco 4 — ações do termo de consentimento (gêmeo de Prospecta/server/consentimento.ts › consentimentoRouter).
//   - aceitarTermoNoLogin: modal das áreas logadas (conta nova sem aceite, conta que retirou, ou opção ligada);
//   - retirarMeuConsentimento: o próprio titular, logado, na página do termo (canal "conta");
//   - registrarRetiradaPeloAdmin: só admin ativo (Configurações › Termo de consentimento), canal "admin".
// Toda retirada é uma linha nova (tipo "revogacao", quem registrou e quando); nada é alterado nem apagado.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirAdminAtivo, usuarioAtual } from "@/lib/auth/modulos";
import { aceitarNoLogin, aparelhoDoUserAgent, ErroDoTermo, MENSAGEM_FALHA_AO_VERIFICAR, registrarRetirada } from "@/lib/consentimento";
import { ROTA_DO_TERMO } from "@/lib/termo-consentimento";

type Resultado = { ok: true; jaAceito?: boolean } | { error: string };

async function comMensagem(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroDoTermo) return { error: erro.message };
    if (erro instanceof Error && erro.message === "Não autorizado.") return { error: erro.message };
    console.error("[consentimento] falha:", erro);
    return { error: MENSAGEM_FALHA_AO_VERIFICAR };
  }
}

async function usuarioLogado() {
  const u = await usuarioAtual();
  if (!u || !u.ativo) throw new ErroDoTermo("Entre no sistema para continuar.");
  const conta = await prisma.usuario.findUnique({ where: { id: u.id }, select: { id: true, criadoEm: true } });
  if (!conta) throw new ErroDoTermo("Entre no sistema para continuar.");
  return conta;
}

const aparelho = async () => aparelhoDoUserAgent((await headers()).get("user-agent"));

export async function aceitarTermoNoLogin(aceitouTermo: boolean, versaoDoTermo: string): Promise<Resultado> {
  return comMensagem(async () => {
    const conta = await usuarioLogado();
    const r = await aceitarNoLogin(conta, aceitouTermo === true, String(versaoDoTermo ?? "").slice(0, 40), await aparelho());
    return { ok: true, jaAceito: r.jaAceito };
  });
}

export async function retirarMeuConsentimento(confirmar: boolean): Promise<Resultado> {
  return comMensagem(async () => {
    if (confirmar !== true) throw new ErroDoTermo("Confirme a retirada.");
    const conta = await usuarioLogado();
    await registrarRetirada({ usuarioId: conta.id, registradoPor: conta.id, canal: "conta", aparelho: await aparelho() });
    revalidatePath(ROTA_DO_TERMO);
    return { ok: true };
  });
}

export async function registrarRetiradaPeloAdmin(usuarioId: string): Promise<Resultado> {
  return comMensagem(async () => {
    const admin = await exigirAdminAtivo();
    const alvo = await prisma.usuario.findUnique({ where: { id: String(usuarioId ?? "") }, select: { id: true } });
    if (!alvo) throw new ErroDoTermo("Usuário não encontrado.");
    await registrarRetirada({ usuarioId: alvo.id, registradoPor: admin.id, canal: "admin" });
    revalidatePath("/admin/configuracoes");
    return { ok: true };
  });
}
