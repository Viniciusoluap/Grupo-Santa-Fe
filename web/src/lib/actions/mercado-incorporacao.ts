"use server";
// Inteligência de Mercado com dois motores independentes (paridade Prospecta 13/11 — procedures
// pesquisarDadosPublicos / salvarDadosPublicos / pesquisarMercadoImobiliario /
// aplicarPrecoReferenciaMercado de server/routers.ts). Erros voltam como dado (capturarErroAcao).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { pesquisarDadosPublicos as consultarIbge, type ResultadoDadosPublicos } from "@/lib/incorporacao/dados-publicos";
import { pesquisarMercadoImobiliario as pesquisarAnuncios } from "@/lib/incorporacao/mercado-anuncios";
import { carregarChaveGemini, carregarChaveTavily } from "@/lib/incorporacao/segredos-mercado";
import type { TipologiaImovel } from "@/lib/incorporacao/analise-anuncios";
import { validarDadosPublicos } from "@/lib/incorporacao/validar-dados-publicos";

const TIPOLOGIAS: readonly TipologiaImovel[] = ["lote", "casa", "apartamento", "terreno", "outro"];

function lerJson(json: string | null | undefined): Record<string, unknown> {
  try { const v = json ? JSON.parse(json) : {}; return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}

function exigirMunicipioUf(municipio: unknown, estado: unknown): { municipio: string; estado: string } {
  const m = typeof municipio === "string" ? municipio.trim() : "";
  const e = typeof estado === "string" ? estado.trim() : "";
  if (!m) throw new Error("Município obrigatório.");
  if (e.length !== 2) throw new Error("UF inválida.");
  return { municipio: m, estado: e };
}

/** Motor 1 pelo SERVIDOR (reserva — o IBGE recusa acessos de fora do Brasil). Grava em chave própria. */
export async function pesquisarDadosPublicos(estudoId: string, municipio: string, estado: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    const c = exigirMunicipioUf(municipio, estado);
    const resultado = await consultarIbge(c.municipio, c.estado);
    const atual = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { pesquisaCidadeJson: true } });
    if (!atual) throw new Error("Estudo não encontrado.");
    // grava em chave própria: a pesquisa anterior (e o que o relatório lê) é preservada
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { pesquisaCidadeJson: JSON.stringify({ ...lerJson(atual.pesquisaCidadeJson), dadosPublicos: resultado }) } });
    revalidatePath(`/admin/incorporacao/${estudoId}`);
    return resultado;
  });
}

/** Grava o resultado do motor 1 consultado pelo NAVEGADOR (o IBGE recusa acesso de fora do Brasil). */
export async function salvarDadosPublicos(estudoId: string, dados: ResultadoDadosPublicos) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    const validos = validarDadosPublicos(dados);
    const atual = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { pesquisaCidadeJson: true } });
    if (!atual) throw new Error("Estudo não encontrado.");
    await prisma.estudoIncorporacao.update({
      where: { id: estudoId },
      data: { pesquisaCidadeJson: JSON.stringify({ ...lerJson(atual.pesquisaCidadeJson), dadosPublicos: { ...validos, origemConsulta: "navegador" } }) },
    });
    revalidatePath(`/admin/incorporacao/${estudoId}`);
    return { ok: true as const };
  });
}

/** Motor 2: anúncios + análise. Falha aqui não afeta o motor 1. NÃO altera o preço do lote. */
export async function pesquisarMercadoImobiliario(
  estudoId: string,
  c: { municipio: string; estado: string; bairro?: string; tipologia: TipologiaImovel; areaMinM2?: number; areaMaxM2?: number },
) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("incorporacao");
    const { municipio, estado } = exigirMunicipioUf(c?.municipio, c?.estado);
    if (!TIPOLOGIAS.includes(c.tipologia)) throw new Error("Tipologia inválida.");
    const bairro = typeof c.bairro === "string" ? c.bairro.trim().slice(0, 120) : "";
    const area = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
    // chaves: variável de ambiente ou banco (configuracoes["segredo.*"], criptografadas)
    await Promise.all([carregarChaveTavily(), carregarChaveGemini()]);
    let r;
    try {
      r = await pesquisarAnuncios({ municipio, uf: estado, bairro: bairro || null, tipologia: c.tipologia, areaMinM2: area(c.areaMinM2), areaMaxM2: area(c.areaMaxM2) });
    } catch (e) {
      throw new Error(`Falha na pesquisa de anúncios: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (r.status === "ok") {
      const atual = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { estudoMercadoJson: true } });
      if (!atual) throw new Error("Estudo não encontrado.");
      // NÃO altera precoM2Lote (preço definido pelo usuário): a análise fica em chave própria
      await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { estudoMercadoJson: JSON.stringify({ ...lerJson(atual.estudoMercadoJson), analiseAnuncios: r.analise }) } });
      revalidatePath(`/admin/incorporacao/${estudoId}`);
    }
    return r;
  });
}

/** Aplica, com confirmação explícita do usuário, a mediana analisada como preço de referência do lote. */
export async function aplicarPrecoReferenciaMercado(estudoId: string, precoM2Lote: number) {
  return capturarErroAcao(async () => {
    const u = await exigirModuloAcao("incorporacao");
    if (!(typeof precoM2Lote === "number" && Number.isFinite(precoM2Lote) && precoM2Lote > 0)) throw new Error("Preço inválido.");
    const atual = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { estudoMercadoJson: true } });
    if (!atual) throw new Error("Estudo não encontrado.");
    const anterior = lerJson(atual.estudoMercadoJson);
    await prisma.estudoIncorporacao.update({
      where: { id: estudoId },
      data: {
        estudoMercadoJson: JSON.stringify({
          ...anterior, precoM2Lote,
          precoM2LoteOrigem: { tipo: "analise_anuncios_confirmada", anterior: anterior.precoM2Lote ?? null, por: u.id, em: new Date().toISOString() },
        }),
      },
    });
    revalidatePath(`/admin/incorporacao/${estudoId}`);
    return { ok: true as const };
  });
}
