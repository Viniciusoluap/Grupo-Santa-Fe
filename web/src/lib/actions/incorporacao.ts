"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseKmlTerreno } from "@/lib/geo/kml";
import type { EveResultado } from "@/lib/finance/eve";

export async function criarEstudo(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");

  const nome = (formData.get("nome") as string)?.trim();
  const municipio = (formData.get("municipio") as string)?.trim();
  const estado = ((formData.get("estado") as string) || "PA").trim();
  const responsavel = (formData.get("responsavel") as string)?.trim() || null;

  // Campos obrigatórios são enforçados no HTML (required); guarda defensiva.
  if (!nome || !municipio) redirect("/admin/incorporacao/novo");

  const estudo = await prisma.estudoIncorporacao.create({
    data: { nome, municipio, estado, responsavel, status: "rascunho" },
  });

  revalidatePath("/admin/incorporacao");
  redirect(`/admin/incorporacao/${estudo.id}`);
}

export async function excluirEstudo(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.delete({ where: { id } });
  revalidatePath("/admin/incorporacao");
}

/** Recebe o KML, salva no Blob, extrai o polígono e persiste geometria/métricas. */
export async function uploadKml(estudoId: string, formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");

  const file = formData.get("kml") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo KML." };
  if (file.size > 10 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 10 MB)." };

  const text = await file.text();
  let terreno;
  try {
    terreno = parseKmlTerreno(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KML inválido." };
  }

  const blob = await put(`incorporacao/${estudoId}/terreno-${Date.now()}.kml`, text, {
    access: "public",
    contentType: "application/vnd.google-earth.kml+xml",
  });

  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      kmlUrl: blob.url,
      geojson: JSON.stringify(terreno.feature),
      areaM2: terreno.areaM2,
      perimetroM: terreno.perimetroM,
      centroLng: terreno.centro[0],
      centroLat: terreno.centro[1],
      status: "em_estudo",
    },
  });

  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true, areaM2: terreno.areaM2, perimetroM: terreno.perimetroM };
}

/** Salva o grid de elevação (JSON já calculado no client via API de elevação). */
export async function salvarElevacao(estudoId: string, elevacaoJson: string, corteAterroJson?: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { elevacaoJson, corteAterroJson: corteAterroJson ?? undefined },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Upload de levantamento topográfico próprio (CSV/qualquer). */
export async function uploadLevantamento(estudoId: string, formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo." };
  const blob = await put(`incorporacao/${estudoId}/levantamento-${Date.now()}-${file.name}`, file, {
    access: "public",
  });
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { levantamentoUrl: blob.url },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o resultado do EVE (viabilidade) + inputs + cronograma + parecer. */
export async function salvarViabilidade(
  estudoId: string,
  payload: { inputs: unknown; resultado: EveResultado; cronograma?: unknown; parecerIa?: string }
) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      viabilidadeJson: JSON.stringify({ inputs: payload.inputs, resultado: payload.resultado }),
      cronogramaJson: payload.cronograma ? JSON.stringify(payload.cronograma) : undefined,
      parecerIa: payload.parecerIa ?? undefined,
      status: "concluido",
    },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva parâmetros urbanísticos + potencial construtivo + parecer. */
export async function salvarUrbanistico(
  estudoId: string,
  payload: { parametros: unknown; potencial: unknown; parecer?: string }
) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      parametrosJson: JSON.stringify(payload.parametros),
      potencialJson: JSON.stringify(payload.potencial),
      urbanismoParecer: payload.parecer ?? undefined,
    },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva pesquisa da cidade + estudo de mercado. */
export async function salvarMercado(
  estudoId: string,
  payload: { pesquisaCidade: unknown; estudoMercado: unknown }
) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      pesquisaCidadeJson: JSON.stringify(payload.pesquisaCidade),
      estudoMercadoJson: JSON.stringify(payload.estudoMercado),
    },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva os cenários de massa, o escolhido e (opcional) o mix derivado para o EVE. */
export async function salvarMassa(
  estudoId: string,
  payload: unknown,
  cenarioEscolhidoId?: string | null,
  mix?: unknown
) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      massaCenariosJson: JSON.stringify(payload),
      cenarioEscolhidoId: cenarioEscolhidoId ?? undefined,
      mixJson: mix ? JSON.stringify(mix) : undefined,
    },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Anexa a URL de um relatório PDF gerado. */
export async function anexarRelatorio(estudoId: string, url: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId } });
  if (!estudo) return { error: "Estudo não encontrado." };
  let lista: string[] = [];
  try { lista = JSON.parse(estudo.relatorios) as string[]; } catch { lista = []; }
  lista.unshift(url);
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { relatorios: JSON.stringify(lista.slice(0, 20)) },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}
