"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { uploadPublico } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseKmlTerreno } from "@/lib/geo/kml";
import { parseGoogleMapsLatLng } from "@/lib/geo/gmaps";

// Lê os campos de localização do formulário. Aceita um link do Google Maps (ou
// um par "lat,lng" colado) e extrai as coordenadas exatas quando possível.
function lerLocalizacao(formData: FormData): {
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  const endereco = (formData.get("endereco") as string)?.trim() || null;

  // Preferência: lat/lng explícitos vindos do seletor de mapa (clique no ponto).
  const latRaw = (formData.get("latitude") as string)?.trim();
  const lngRaw = (formData.get("longitude") as string)?.trim();
  const lat = latRaw ? Number(latRaw) : NaN;
  const lng = lngRaw ? Number(lngRaw) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { endereco, latitude: lat, longitude: lng };
  }

  // Fallback: par colado / link do Google Maps no campo de texto.
  const localizacao = (formData.get("localizacao") as string)?.trim() || "";
  const coords = localizacao ? parseGoogleMapsLatLng(localizacao) : null;
  return {
    endereco,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}

export async function criarEstudo(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");

  const nome = (formData.get("nome") as string)?.trim();
  const municipio = (formData.get("municipio") as string)?.trim();
  const estado = ((formData.get("estado") as string) || "PA").trim();
  const responsavel = (formData.get("responsavel") as string)?.trim() || null;
  const { endereco, latitude, longitude } = lerLocalizacao(formData);

  // Campos obrigatórios são enforçados no HTML (required); guarda defensiva.
  if (!nome || !municipio) redirect("/admin/incorporacao/novo");

  const estudo = await prisma.estudoIncorporacao.create({
    data: { nome, municipio, estado, responsavel, endereco, latitude, longitude, status: "rascunho" },
  });

  revalidatePath("/admin/incorporacao");
  redirect(`/admin/incorporacao/${estudo.id}`);
}

/** Edita os dados de identificação/localização de um estudo. */
export async function editarEstudo(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");

  const id = (formData.get("id") as string)?.trim();
  const nome = (formData.get("nome") as string)?.trim();
  const municipio = (formData.get("municipio") as string)?.trim();
  const estado = ((formData.get("estado") as string) || "PA").trim();
  const responsavel = (formData.get("responsavel") as string)?.trim() || null;
  const { endereco, latitude, longitude } = lerLocalizacao(formData);

  if (!id || !nome || !municipio) redirect(`/admin/incorporacao/${id}/editar`);

  await prisma.estudoIncorporacao.update({
    where: { id },
    data: { nome, municipio, estado, responsavel, endereco, latitude, longitude },
  });

  revalidatePath("/admin/incorporacao");
  revalidatePath(`/admin/incorporacao/${id}`);
  redirect(`/admin/incorporacao/${id}`);
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

  // O arquivo KML bruto é opcional — a geometria já foi extraída e é persistida
  // abaixo. O upload é best-effort: se o Blob falhar, o estudo funciona mesmo assim.
  const blob = await uploadPublico(
    `incorporacao/${estudoId}/terreno-${Date.now()}.kml`,
    text,
    "application/vnd.google-earth.kml+xml"
  );

  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      kmlUrl: blob.url ?? undefined,
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
  const blob = await uploadPublico(`incorporacao/${estudoId}/levantamento-${Date.now()}-${file.name}`, file);
  if (!blob.url) return { error: blob.erro };
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { levantamentoUrl: blob.url },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva as premissas do estudo de viabilidade determinístico (motor de fórmulas). */
export async function salvarViabilidade(estudoId: string, premissasJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { loteamentoJson: premissasJson, status: "em_estudo" },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/**
 * Salva a área de APP calculada AUTOMATICAMENTE pelo mapa (Overpass + Código
 * Florestal ou largura manual escolhida no seletor) — nunca é preenchida à mão.
 * Chamada pelo próprio componente do mapa assim que o cálculo é concluído, para
 * que a Viabilidade sempre reflita a APP real do terreno sem qualquer ação do
 * usuário.
 */
export async function salvarApp(
  estudoId: string,
  payload: { areaM2: number; larguraM: number | null; origem: string }
) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: {
      appAreaM2: payload.areaM2,
      appLarguraM: payload.larguraM ?? undefined,
      appOrigem: payload.origem,
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

/**
 * Salva a precificação por comparáveis ponderados (atributos, pesos, notas do
 * novo empreendimento e dos concorrentes) — em campo próprio, separado do
 * estudoMercadoJson da IA, para não ser sobrescrito ao refazer a pesquisa.
 */
export async function salvarPrecificacaoComparaveis(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { precificacaoComparaveisJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva a pesquisa primária com compradores (questionário aplicado) — aprimora a 2.2. */
export async function salvarPesquisaPrimaria(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { pesquisaPrimariaJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o Quadro de Áreas (NBR 12721) — etapas 2.3/3.3. */
export async function salvarQuadroAreas(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { quadroAreasJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o Orçamento Parametrizado — etapa 2.4. */
export async function salvarOrcamentoParametrizado(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { orcamentoParametrizadoJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva a lista de projetistas contratados e seus status — etapa 3.1. */
export async function salvarProjetistas(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { projetistasJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva os processos de aprovação do projeto junto aos órgãos competentes — etapa 3.2. */
export async function salvarAprovacaoProjeto(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { aprovacaoProjetoJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o checklist de documentos do registro da incorporação — etapa 3.4. */
export async function salvarRegistroIncorporacao(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { registroIncorporacaoJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o orçamento preliminar de obra por disciplina — etapa 3.5. */
export async function salvarOrcamentoPreliminar(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { orcamentoPreliminarJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o cronograma de marcos do planejamento do lançamento — etapa 4.1. */
export async function salvarPlanejamentoLancamento(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { planejamentoLancamentoJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva os fornecedores contratados para o lançamento — etapa 4.2. */
export async function salvarFornecedoresLancamento(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { fornecedoresLancamentoJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o repositório de peças publicitárias e status de aprovação — etapa 4.3. */
export async function salvarMaterialPublicitario(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { materialPublicitarioJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva as vendas registradas no evento de lançamento — etapa 4.4. */
export async function salvarLancamentoImobiliario(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { lancamentoImobiliarioJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva os projetos executivos liberados para obra — etapa 5.1. */
export async function salvarProjetosExecutivos(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { projetosExecutivosJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva o orçamento executivo real da obra — etapa 5.2. */
export async function salvarOrcamentoObra(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { orcamentoObraJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva as medições do cronograma físico-financeiro da obra — etapa 5.3. */
export async function salvarCronogramaObra(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { cronogramaObraJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva os chamados de atendimento pós-venda — etapa 5.4. */
export async function salvarAtendimentoClientes(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { atendimentoClientesJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva a simulação de captação com fundos/investidores — etapa 2.6. */
export async function salvarBusinessPlan(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { businessPlanJson: dadosJson },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return { ok: true };
}

/** Salva a negociação do terreno (proprietário/terreneiro) — etapa 2.7. */
export async function salvarNegociacaoTerreno(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.estudoIncorporacao.update({
    where: { id: estudoId },
    data: { negociacaoTerrenoJson: dadosJson },
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
