"use server";
// Lote 2, correção 03 (AD-06): Gerador de PCI (Editar Obra) e modelos oficiais
// (Integrações › Sub PCI atual). Envio do modelo e downloads ficam nas rotas
// /api/pci-modelos e /api/obras/[id]/pci-geradas (partes de 1 MB).
// Gêmeo dos routers `pciGerador`/`pciModelos` do Prospecta (server/pci-gerador.ts).
import { usuarioAtual, type UsuarioDaSessao } from "@/lib/auth/modulos";
import { podeAdministrarSeguranca } from "@/lib/perfis-acesso";
import {
  ErroGeradorPci,
  carregarGeradorPci,
  definirModeloAtualPci as definirAtual,
  engenheiroDaPci,
  excluirModeloPci,
  excluirModeloPreenchimentoPci,
  historicoModeloPreenchimentoPci,
  listarModelosPreenchimentoPci,
  obterModeloPreenchimentoPci,
  salvarModeloPreenchimentoPci,
  sugestoesAutomaticasDaObraPci,
  previaExclusaoModeloPci,
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
    const u = await usuarioGerador();
    return { dados: await carregarGeradorPci(obraId, u.id) };
  } catch (e) { return erro(e); }
}

export async function preencherAutomaticoPci(obraId: string) {
  try {
    const u = await usuarioGerador();
    return { formulario: await preenchimentoAutomaticoPci(obraId, u.id) };
  } catch (e) { return erro(e); }
}

// ── Paridade 17/11 (Prospecta EPIC-024 S-09): mesmo acesso do gerador (admin ou colaborador com Obras) ──

const textoId = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : "");

/** CPF, CREA e telefone de UM engenheiro oferecido na lista (o escolhido em RTP/RTE) — a lista não leva CPF. */
export async function engenheiroPciAcao(obraId: string, engenheiroId: string) {
  try {
    const u = await usuarioGerador();
    return { engenheiro: await engenheiroDaPci(textoId(engenheiroId), { usuarioId: u.id, obraId: textoId(obraId) }) };
  } catch (e) { return erro(e); }
}

/** "Dados automáticos" com a fonte de cada valor; a tela compara e confirma conflitos. */
export async function sugestoesAutomaticasPciAcao(obraId: string, ids: { rtpEngenheiroId?: string | null; rteEngenheiroId?: string | null }) {
  try {
    const u = await usuarioGerador();
    return { sugestoes: await sugestoesAutomaticasDaObraPci(textoId(obraId), { rtp: textoId(ids?.rtpEngenheiroId) || null, rte: textoId(ids?.rteEngenheiroId) || null }, u.id) };
  } catch (e) { return erro(e); }
}

export async function listarModelosPreenchimentoPciAcao() {
  try {
    const u = await usuarioGerador();
    return { modelos: await listarModelosPreenchimentoPci(podeAdministrarSeguranca(u)) };
  } catch (e) { return erro(e); }
}

export async function obterModeloPreenchimentoPciAcao(id: string) {
  try {
    const u = await usuarioGerador();
    return { modelo: await obterModeloPreenchimentoPci(textoId(id), podeAdministrarSeguranca(u)) };
  } catch (e) { return erro(e); }
}

export async function historicoModeloPreenchimentoPciAcao(id: string) {
  try {
    const u = await usuarioGerador();
    return { versoes: await historicoModeloPreenchimentoPci(textoId(id), podeAdministrarSeguranca(u)) };
  } catch (e) { return erro(e); }
}

export async function salvarModeloPreenchimentoPciAcao(entrada: { obraId: string; nome: string; formulario: unknown; observacao?: string | null; novaVersaoDe?: string | null }) {
  try {
    const u = await usuarioGerador();
    const r = await salvarModeloPreenchimentoPci({
      obraId: textoId(entrada?.obraId), nome: typeof entrada?.nome === "string" ? entrada.nome.slice(0, 200) : "", formulario: entrada?.formulario,
      observacao: typeof entrada?.observacao === "string" ? entrada.observacao.slice(0, 1000) : null, novaVersaoDe: textoId(entrada?.novaVersaoDe) || null,
    }, u.id);
    return { ok: true as const, ...r };
  } catch (e) { return erro(e); }
}

export async function excluirModeloPreenchimentoPciAcao(id: string, confirmar: boolean) {
  try {
    const u = await usuarioGerador();
    if (confirmar !== true) throw new ErroGeradorPci("Confirme a exclusão.");
    return { ok: true as const, ...(await excluirModeloPreenchimentoPci(textoId(id), { id: u.id, admin: podeAdministrarSeguranca(u) })) };
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

/** Lote 03, correção 10: versão com mudança crítica só vira atual com `confirmarCritica`. */
export async function definirModeloAtualPci(id: string, confirmarCritica = false) {
  try {
    const u = await usuarioAdmin();
    await definirAtual(id, { usuarioId: u.id, confirmarCritica: confirmarCritica === true });
    return { ok: true as const };
  } catch (e) { return erro(e); }
}

/** Lote 03, correção 09b: prévia (nome/versão e PCIs geradas que usam a versão). */
export async function previaExclusaoModeloPciAcao(id: string) {
  try {
    await usuarioAdmin();
    return { previa: await previaExclusaoModeloPci(id) };
  } catch (e) { return erro(e); }
}

/** Lote 03, correção 09b: exclusão lógica (não a atual); o arquivo fica para as PCIs geradas. */
export async function excluirModeloPciAcao(id: string, confirmar: boolean) {
  try {
    const u = await usuarioAdmin();
    if (confirmar !== true) throw new ErroGeradorPci("Confirme a exclusão.");
    const r = await excluirModeloPci(id, u.id);
    return { ok: true as const, versao: r.versao, pcisGeradas: r.pcisGeradas };
  } catch (e) { return erro(e); }
}
