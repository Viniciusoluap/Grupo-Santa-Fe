"use server";
// Lote 2, correção 03 (AD-06): Gerador de PCI (Editar Obra) e modelos oficiais
// (Integrações › Sub PCI atual). Envio do modelo e downloads ficam nas rotas
// /api/pci-modelos e /api/obras/[id]/pci-geradas (partes de 1 MB).
// Gêmeo dos routers `pciGerador`/`pciModelos` do Prospecta (server/pci-gerador.ts).
import { usuarioAtual, type UsuarioDaSessao } from "@/lib/auth/modulos";
import {
  ErroGeradorPci,
  carregarGeradorPci,
  definirModeloAtualPci as definirAtual,
  gerarPciDaObra,
  listarModelosPci,
  podeGerenciarModelosPci,
  podeUsarGeradorPci,
  preenchimentoAutomaticoPci,
  salvarRascunhoPci,
} from "@/lib/obras/pci-gerador-dados";

async function usuarioGerador(): Promise<UsuarioDaSessao> {
  const u = await usuarioAtual();
  if (!u || !u.ativo) throw new ErroGeradorPci("Não autorizado.");
  if (!podeUsarGeradorPci(u)) throw new ErroGeradorPci("Sem permissão para o Gerador de PCI (módulo Obras).");
  return u;
}

async function usuarioAdmin(): Promise<UsuarioDaSessao> {
  const u = await usuarioAtual();
  if (!u || !podeGerenciarModelosPci(u)) throw new ErroGeradorPci("Só o administrador gerencia o modelo da PCI.");
  return u;
}

function erro(e: unknown) {
  if (e instanceof ErroGeradorPci) return { erro: e.message };
  if (e instanceof Error && /imagem de localização/i.test(e.message)) return { erro: e.message };
  console.error("[pci-gerador]", e instanceof Error ? e.message : "erro");
  return { erro: "Não foi possível concluir a operação. Tente novamente." };
}

export async function obterGeradorPci(obraId: string) {
  try {
    await usuarioGerador();
    return { dados: await carregarGeradorPci(obraId) };
  } catch (e) { return erro(e); }
}

export async function preencherAutomaticoPci(obraId: string) {
  try {
    await usuarioGerador();
    return { formulario: await preenchimentoAutomaticoPci(obraId) };
  } catch (e) { return erro(e); }
}

export async function salvarRascunhoGeradorPci(obraId: string, formulario: unknown) {
  try {
    const u = await usuarioGerador();
    const r = await salvarRascunhoPci(obraId, formulario, u.id);
    return { ok: true as const, pendencias: r.pendencias };
  } catch (e) { return erro(e); }
}

export async function gerarPci(obraId: string, formulario: unknown) {
  try {
    const u = await usuarioGerador();
    return { ok: true as const, ...(await gerarPciDaObra(obraId, formulario, { id: u.id, nome: u.nome })) };
  } catch (e) { return erro(e); }
}

export async function listarModelosPciAcao() {
  try {
    await usuarioAdmin();
    return { modelos: (await listarModelosPci()).map((m) => ({ ...m, enviadoEm: m.enviadoEm.toISOString() })) };
  } catch (e) { return erro(e); }
}

export async function definirModeloAtualPci(id: string) {
  try {
    await usuarioAdmin();
    await definirAtual(id);
    return { ok: true as const };
  } catch (e) { return erro(e); }
}
