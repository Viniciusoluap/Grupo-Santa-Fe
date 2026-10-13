import { exigirModuloPagina } from "@/lib/auth/modulos";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BackButton } from "@/components/ui/back-button";
import { IncorporacaoDetail } from "../_components/incorporacao-detail";
import { VersoesEstudo } from "../_components/versoes-estudo";

export default async function EstudoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirModuloPagina("incorporacao");

  const { id } = await params;
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id } });
  if (!estudo) notFound();
  const versoes = await prisma.estudoIncorporacaoVersao.findMany({
    where: { estudoId: id }, orderBy: { numero: "desc" }, take: 20,
    select: { numero: true, criadoEm: true },
  });
  const colaboradores = await prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["admin", "colaborador"] } },
    select: { id: true, nome: true }, orderBy: { nome: "asc" },
  });

  // Serializa apenas os campos usados no client (evita passar Date cru sem controle).
  const data = {
    id: estudo.id,
    nome: estudo.nome,
    municipio: estudo.municipio,
    estado: estudo.estado,
    status: estudo.status,
    tipoIncorporacao: estudo.tipoIncorporacao,
    dueDiligenceJson: estudo.dueDiligenceJson,
    responsavel: estudo.responsavel,
    versaoNumero: versoes[0]?.numero ?? null,
    colaboradores,
    matriculaImovel: estudo.matriculaImovel,
    carRegistro: estudo.carRegistro,
    zoneamentoOficial: estudo.zoneamentoOficial,
    zoneamentoFonte: estudo.zoneamentoFonte,
    kmlUrl: estudo.kmlUrl,
    geojson: estudo.geojson,
    areaM2: estudo.areaM2,
    perimetroM: estudo.perimetroM,
    centroLat: estudo.centroLat,
    centroLng: estudo.centroLng,
    appAreaM2: estudo.appAreaM2,
    appLarguraM: estudo.appLarguraM,
    appOrigem: estudo.appOrigem,
    elevacaoJson: estudo.elevacaoJson,
    levantamentoUrl: estudo.levantamentoUrl,
    parametrosJson: estudo.parametrosJson,
    potencialJson: estudo.potencialJson,
    urbanismoParecer: estudo.urbanismoParecer,
    pesquisaCidadeJson: estudo.pesquisaCidadeJson,
    estudoMercadoJson: estudo.estudoMercadoJson,
    precificacaoComparaveisJson: estudo.precificacaoComparaveisJson,
    pesquisaPrimariaJson: estudo.pesquisaPrimariaJson,
    quadroAreasJson: estudo.quadroAreasJson,
    orcamentoParametrizadoJson: estudo.orcamentoParametrizadoJson,
    businessPlanJson: estudo.businessPlanJson,
    negociacaoTerrenoJson: estudo.negociacaoTerrenoJson,
    projetistasJson: estudo.projetistasJson,
    aprovacaoProjetoJson: estudo.aprovacaoProjetoJson,
    registroIncorporacaoJson: estudo.registroIncorporacaoJson,
    orcamentoPreliminarJson: estudo.orcamentoPreliminarJson,
    planejamentoLancamentoJson: estudo.planejamentoLancamentoJson,
    fornecedoresLancamentoJson: estudo.fornecedoresLancamentoJson,
    materialPublicitarioJson: estudo.materialPublicitarioJson,
    lancamentoImobiliarioJson: estudo.lancamentoImobiliarioJson,
    projetosExecutivosJson: estudo.projetosExecutivosJson,
    orcamentoObraJson: estudo.orcamentoObraJson,
    cronogramaObraJson: estudo.cronogramaObraJson,
    atendimentoClientesJson: estudo.atendimentoClientesJson,
    massaCenariosJson: estudo.massaCenariosJson,
    cenarioEscolhidoId: estudo.cenarioEscolhidoId,
    mixJson: estudo.mixJson,
    viabilidadeJson: estudo.viabilidadeJson,
    parecerIa: estudo.parecerIa,
    loteamentoJson: estudo.loteamentoJson,
    relatorios: estudo.relatorios,
  };

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">{estudo.nome}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{estudo.municipio}/{estudo.estado}</p>
      </div>
      <IncorporacaoDetail estudo={data} />
      <VersoesEstudo estudoId={id} versoes={versoes.map((v) => ({ numero: v.numero, criadoEm: v.criadoEm.toISOString() }))} />
    </div>
  );
}
