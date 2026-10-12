"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { uploadPublico } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseKmlTerreno } from "@/lib/geo/kml";
import { parseGoogleMapsLatLng } from "@/lib/geo/gmaps";
import { situacaoEstudoValida } from "@/lib/incorporacao/status-estudo";
import { tipoIncorporacaoValido } from "@/lib/incorporacao/tipo-estudo";

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
  const tipoIncorporacao = formData.get("tipoIncorporacao");
  const municipio = (formData.get("municipio") as string)?.trim();
  const estado = ((formData.get("estado") as string) || "PA").trim();
  const responsavel = (formData.get("responsavel") as string)?.trim() || null;
  const matriculaImovel = (formData.get("matriculaImovel") as string)?.trim() || null;
  const carRegistro = (formData.get("carRegistro") as string)?.trim() || null;
  const zoneamentoOficial = (formData.get("zoneamentoOficial") as string)?.trim() || null;
  const zoneamentoFonte = (formData.get("zoneamentoFonte") as string)?.trim() || null;
  const { endereco, latitude, longitude } = lerLocalizacao(formData);

  // Campos obrigatórios são enforçados no HTML (required); guarda defensiva.
  if (!nome || !municipio) redirect("/admin/incorporacao/novo");
  if (!tipoIncorporacaoValido(tipoIncorporacao)) throw new Error("Selecione o tipo de incorporação.");

  const estudo = await prisma.estudoIncorporacao.create({
    data: { nome, municipio, estado, responsavel, matriculaImovel, carRegistro, zoneamentoOficial, zoneamentoFonte, endereco, latitude, longitude, status: "em_estudo", tipoIncorporacao },
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
  const matriculaImovel = (formData.get("matriculaImovel") as string)?.trim() || null;
  const carRegistro = (formData.get("carRegistro") as string)?.trim() || null;
  const zoneamentoOficial = (formData.get("zoneamentoOficial") as string)?.trim() || null;
  const zoneamentoFonte = (formData.get("zoneamentoFonte") as string)?.trim() || null;
  const status = formData.get("status");
  const tipoIncorporacao = formData.get("tipoIncorporacao");
  const { endereco, latitude, longitude } = lerLocalizacao(formData);

  if (!id || !nome || !municipio) redirect(`/admin/incorporacao/${id}/editar`);
  if (!situacaoEstudoValida(status)) throw new Error("Classifique a situação do estudo antes de salvar.");
  if (tipoIncorporacao !== "" && !tipoIncorporacaoValido(tipoIncorporacao)) throw new Error("Tipo de incorporação inválido.");

  await prisma.estudoIncorporacao.update({
    where: { id },
    data: { nome, municipio, estado, responsavel, matriculaImovel, carRegistro, zoneamentoOficial, zoneamentoFonte, endereco, latitude, longitude, status, tipoIncorporacao: tipoIncorporacao || null },
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

/** A leitura de um snapshot antigo exige a mesma permissão administrativa do estudo. */
export async function obterVersaoEstudo(estudoId: string, numero: number) {
  const session = await auth();
  requireActionRole(session, "admin");
  if (!Number.isSafeInteger(numero) || numero < 1) throw new Error("Versão inválida.");
  const versao = await prisma.estudoIncorporacaoVersao.findUnique({
    where: { estudoId_numero: { estudoId, numero } },
    select: { numero: true, criadoEm: true, snapshot: true },
  });
  if (!versao) throw new Error("Versão não encontrada.");
  return { numero: versao.numero, criadoEm: versao.criadoEm.toISOString(), snapshot: versao.snapshot };
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
    data: { loteamentoJson: premissasJson },
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
async function validarResponsaveisCronograma(dadosJson: string, chave: "medicoes" | "marcos") {
  if (dadosJson.length > 150_000) throw new Error("Cronograma excede o tamanho permitido.");
  let dados: Record<string, unknown>;
  try { dados = JSON.parse(dadosJson); } catch { throw new Error("Cronograma inválido."); }
  if (!dados || typeof dados !== "object" || !Array.isArray(dados[chave])) throw new Error("Itens do cronograma inválidos.");
  const itens = dados[chave] as Record<string, unknown>[];
  if (itens.length > 500 || itens.some((i) => !i || typeof i !== "object")) throw new Error("Itens do cronograma inválidos.");
  if (chave === "medicoes" && dados.riscos != null && !Array.isArray(dados.riscos)) throw new Error("Registro de riscos inválido.");
  const riscos = chave === "medicoes" && Array.isArray(dados.riscos) ? dados.riscos as Record<string, unknown>[] : [];
  if (riscos.length > 100 || riscos.some((r) => !r || typeof r.id !== "string" ||
      typeof r.descricao !== "string" || !r.descricao.trim() || r.descricao.length > 1000 ||
      typeof r.mitigacao !== "string" || r.mitigacao.length > 2000 ||
      !["baixo", "medio", "alto"].includes(String(r.impacto)) ||
      !["aberto", "mitigado"].includes(String(r.status)))) throw new Error("Registro de riscos inválido.");
  if ([...itens, ...riscos].some((i) => i.responsavelId != null && typeof i.responsavelId !== "string")) throw new Error("Responsável inválido.");
  const ids = [...new Set([...itens, ...riscos].map((item) => item.responsavelId).filter((id): id is string => typeof id === "string" && !!id))];
  if (ids.length) {
    const usuarios = await prisma.usuario.findMany({ where: { id: { in: ids }, ativo: true, papel: { in: ["admin", "colaborador"] } }, select: { id: true } });
    if (usuarios.length !== ids.length) throw new Error("Responsável não autorizado ou inativo.");
  }
}

export async function salvarPlanejamentoLancamento(estudoId: string, dadosJson: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await validarResponsaveisCronograma(dadosJson, "marcos");
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
  const result = await prisma.estudoIncorporacao.updateMany({
    where: { id: estudoId, OR: [{ tipoIncorporacao: null }, { tipoIncorporacao: { not: "desmembramento_simples" } }] },
    data: { lancamentoImobiliarioJson: dadosJson },
  });
  if (!result.count) throw new Error("Use Unidades à Venda para registrar vendas do desmembramento.");
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
  await validarResponsaveisCronograma(dadosJson, "medicoes");
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
