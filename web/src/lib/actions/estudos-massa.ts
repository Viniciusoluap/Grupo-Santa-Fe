"use server";
// Estudos de massa salvos (Lote 2, correção 11) e estudo sem KML (correção 06).
// Mesmo contrato das demais ações da incorporação: o erro volta como dado
// (`capturarErroAcao`) e a tela o transforma de volta com `exigirResultado`.
import { sincronizarUnidadesCenario } from "@/lib/incorporacao/unidades-cenario-db";
import { revalidatePath } from "next/cache";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { prepararLotesAvulsosParaGravar } from "@/lib/incorporacao/lotes-avulsos";
import {
  excluirEstudoMassaDb, listarEstudosMassaDb, marcarPrincipalDb, obterCenarioPrincipal, obterEstudoMassaDb, salvarEstudoMassaDb,
} from "@/lib/incorporacao/estudos-massa-db";

export type ModoSalvarEstudoMassa = "novo" | "nova_versao" | "atualizar";
export interface DadosEstudoMassa {
  modo: ModoSalvarEstudoMassa;
  id?: string | null;
  nome: string;
  parametros: unknown;
  cenarios: unknown[];
  cenarioEscolhidoId: string | null;
  principal?: boolean;
}

const caminho = (estudoId: string) => `/admin/incorporacao/${estudoId}`;

async function exigirEstudoExistente(estudoId: string) {
  const e = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true } });
  if (!e) throw new Error("Estudo não encontrado.");
}

/** Correção 06: marca/desmarca "Este empreendimento não possui KML". */
export async function salvarSemKml(estudoId: string, semKml: boolean) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    await exigirEstudoExistente(estudoId);
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { semKml: semKml === true } });
    revalidatePath(caminho(estudoId));
    return { ok: true as const };
  });
}

/** Correção 06: grava a lista de lotes avulsos (validada estritamente). */
export async function salvarLotesAvulsos(estudoId: string, dadosJson: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    await exigirEstudoExistente(estudoId);
    if (typeof dadosJson !== "string" || dadosJson.length > 2_000_000) throw new Error("Lista de lotes grande demais.");
    const preparado = prepararLotesAvulsosParaGravar(dadosJson);
    if (!preparado.ok) throw new Error(preparado.erro);
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { lotesAvulsosJson: preparado.json } });
    revalidatePath(caminho(estudoId));
    return { ok: true as const };
  });
}

export async function listarEstudosMassa(estudoId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    return listarEstudosMassaDb(estudoId);
  });
}

export async function abrirEstudoMassa(estudoId: string, estudoMassaId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    return obterEstudoMassaDb(estudoId, estudoMassaId);
  });
}

export async function salvarEstudoMassa(estudoId: string, d: DadosEstudoMassa) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("incorporacao");
    if (!["novo", "nova_versao", "atualizar"].includes(d?.modo)) throw new Error("Operação inválida.");
    const r = await salvarEstudoMassaDb(estudoId, {
      modo: d.modo, id: d.id ?? null, nome: String(d.nome ?? ""),
      parametrosJson: d.parametros ? JSON.stringify(d.parametros) : null,
      cenariosJson: JSON.stringify(Array.isArray(d.cenarios) ? d.cenarios : []),
      cenarioEscolhidoId: typeof d.cenarioEscolhidoId === "string" ? d.cenarioEscolhidoId.slice(0, 120) : null,
      principal: d.principal === true,
    }, u.id);
    await sincronizarUnidadesCenario(estudoId, u.id);
    revalidatePath(caminho(estudoId));
    return r;
  });
}

export async function marcarEstudoMassaPrincipal(estudoId: string, estudoMassaId: string) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("incorporacao");
    await marcarPrincipalDb(estudoId, estudoMassaId);
    await sincronizarUnidadesCenario(estudoId, u.id);
    revalidatePath(caminho(estudoId));
    return { ok: true as const };
  });
}

export async function excluirEstudoMassa(estudoId: string, estudoMassaId: string) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("incorporacao");
    await excluirEstudoMassaDb(estudoId, estudoMassaId, u.id);
    revalidatePath(caminho(estudoId));
    return { ok: true as const };
  });
}

/** Cenário principal do estudo (lotes + quadro de áreas) para as ondas 12, 15 e 20. */
export async function cenarioPrincipalDoEstudo(estudoId: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    return obterCenarioPrincipal(estudoId);
  });
}
