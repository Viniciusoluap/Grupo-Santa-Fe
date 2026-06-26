import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PrintButton } from "./_components/print-button";

interface PageProps { params: Promise<{ id: string }> }

const TIPO_LABELS: Record<string, string> = {
  mercado: "Avaliação de Mercado",
  locacao: "Avaliação para Locação",
  judicial: "Avaliação Judicial",
  parecer_tecnico: "Parecer Técnico",
};
const FINALIDADE_LABELS: Record<string, string> = {
  compra_venda: "Compra e Venda", locacao: "Locação", judicial: "Processo Judicial",
  garantia: "Garantia Bancária", inventario: "Inventário", seguro: "Seguro Patrimonial",
};
const METODOLOGIA_LABELS: Record<string, string> = {
  comparativo: "Método Comparativo Direto de Dados de Mercado",
  renda: "Método da Renda",
  custo: "Método do Custo",
};
const ESTADO_GERAL_LABELS: Record<string, string> = {
  novo: "Novo / Em construção", otimo: "Ótimo estado", conservado: "Conservado",
  regular: "Regular", reformas_leves: "Necessita reformas leves",
  reformas_importantes: "Necessita reformas importantes", ruim: "Ruim",
};

const CHECKLIST_GROUPS = [
  { id: "localizacao", label: "Localização e Infraestrutura", items: [
    { key: "loc_01", label: "Rede de água encanada" }, { key: "loc_02", label: "Rede de esgoto (ou fossa regularizada)" },
    { key: "loc_03", label: "Energia elétrica disponível" }, { key: "loc_04", label: "Via pública pavimentada" },
    { key: "loc_05", label: "Iluminação pública" }, { key: "loc_06", label: "Transporte público próximo" },
    { key: "loc_07", label: "Comércio e serviços nas proximidades" }, { key: "loc_08", label: "Escola / creche próxima" },
    { key: "loc_09", label: "Unidade de saúde próxima" }, { key: "loc_10", label: "Segurança satisfatória na região" },
  ]},
  { id: "documentacao", label: "Documentação e Situação Legal", items: [
    { key: "doc_01", label: "Matrícula atualizada no cartório" }, { key: "doc_02", label: "Escritura / contrato de compra e venda" },
    { key: "doc_03", label: "Habite-se / alvará de construção" }, { key: "doc_04", label: "Planta da edificação disponível" },
    { key: "doc_05", label: "Sem ônus (hipotecas ou penhoras)" }, { key: "doc_06", label: "IPTU em dia" },
    { key: "doc_07", label: "Sem débitos de condomínio" }, { key: "doc_08", label: "Área conforme consta na matrícula" },
    { key: "doc_09", label: "Construção regularizada perante a prefeitura" }, { key: "doc_10", label: "Conformidade com zoneamento municipal" },
  ]},
  { id: "estrutura", label: "Estrutura e Fundação", items: [
    { key: "est_01", label: "Fundação aparentemente íntegra" }, { key: "est_02", label: "Ausência de recalque ou acomodação" },
    { key: "est_03", label: "Ausência de trincas/fissuras estruturais" }, { key: "est_04", label: "Paredes estruturais em bom estado" },
    { key: "est_05", label: "Laje/teto sem infiltração ou danos estruturais" }, { key: "est_06", label: "Pilares e vigas sem fissuras visíveis" },
  ]},
  { id: "cobertura", label: "Cobertura e Telhado", items: [
    { key: "cob_01", label: "Telhado em bom estado de conservação" }, { key: "cob_02", label: "Ausência de vazamentos / goteiras" },
    { key: "cob_03", label: "Calhas e rufos funcionando" }, { key: "cob_04", label: "Impermeabilização adequada" },
    { key: "cob_05", label: "Forro/laje de teto sem danos" },
  ]},
  { id: "acabamentos", label: "Acabamentos Internos", items: [
    { key: "acb_01", label: "Piso em bom estado" }, { key: "acb_02", label: "Revestimento de paredes em bom estado" },
    { key: "acb_03", label: "Pintura em bom estado" }, { key: "acb_04", label: "Portas em bom estado" },
    { key: "acb_05", label: "Janelas em bom estado" }, { key: "acb_06", label: "Louças sanitárias íntegras" },
    { key: "acb_07", label: "Metais sanitários funcionando" }, { key: "acb_08", label: "Bancada/pia da cozinha em bom estado" },
    { key: "acb_09", label: "Armários embutidos em bom estado" },
  ]},
  { id: "eletrica", label: "Instalação Elétrica", items: [
    { key: "ele_01", label: "Quadro de distribuição adequado" }, { key: "ele_02", label: "Fiação em bom estado" },
    { key: "ele_03", label: "Tomadas e interruptores funcionando" }, { key: "ele_04", label: "Aterramento presente" },
    { key: "ele_05", label: "Iluminação funcionando em todos os cômodos" }, { key: "ele_06", label: "Sem fiação exposta ou improvisada" },
  ]},
  { id: "hidraulica", label: "Instalação Hidráulica e Sanitária", items: [
    { key: "hid_01", label: "Encanamento sem vazamentos visíveis" }, { key: "hid_02", label: "Caixa d'água adequada" },
    { key: "hid_03", label: "Pressão de água satisfatória" }, { key: "hid_04", label: "Esgoto conectado à rede ou fossa regularizada" },
    { key: "hid_05", label: "Banheiros sem infiltração ou mofo" }, { key: "hid_06", label: "Vaso sanitário e chuveiro funcionando" },
    { key: "hid_07", label: "Aquecimento de água funcionando" },
  ]},
  { id: "conservacao", label: "Conservação Geral", items: [
    { key: "con_01", label: "Ausência de umidade ascendente" }, { key: "con_02", label: "Ausência de infiltrações" },
    { key: "con_03", label: "Ausência de mofo / bolor" }, { key: "con_04", label: "Ausência de cupim ou pragas" },
    { key: "con_05", label: "Ausência de odores anormais" }, { key: "con_06", label: "Área externa em bom estado" },
    { key: "con_07", label: "Muros / cercas em bom estado" },
  ]},
  { id: "benfeitorias", label: "Benfeitorias e Dependências", items: [
    { key: "ben_01", label: "Garagem / vaga coberta presente" }, { key: "ben_02", label: "Área de serviço / lavanderia" },
    { key: "ben_03", label: "Varanda / sacada / terraço" }, { key: "ben_04", label: "Piscina (se houver)" },
    { key: "ben_05", label: "Churrasqueira (se houver)" }, { key: "ben_06", label: "Portão elétrico (se houver)" },
    { key: "ben_07", label: "Sistema de câmeras/alarme (se houver)" }, { key: "ben_08", label: "Ar-condicionado (se houver)" },
  ]},
];

type ItemState = { ok: boolean | null; nota: string };
type ChecklistData = { estadoGeral: string; items: Record<string, ItemState>; fotos: string[] };

interface SugestaoResult {
  valorSugerido: number;
  valorMin: number;
  valorMax: number;
  precoPorM2: number;
  estadoGeral?: string;
  comparaveis: Array<{ descricao: string; preco: number; area: number; precoPorM2: number }>;
  fontes: string[];
  metodologia: string;
  confiabilidade: "alta" | "media" | "baixa";
  observacoes: string;
}

interface Documento {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
}

// Robust pt-BR value formatter — no Intl.NumberFormat dependency
function formatValorBR(value: number): string {
  const fixed = value.toFixed(2);
  const [int, dec] = fixed.split(".");
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${intFormatted},${dec}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function parseChecklist(raw: string): ChecklistData {
  try {
    const p = JSON.parse(raw) as Partial<ChecklistData>;
    return { estadoGeral: p.estadoGeral ?? "", items: p.items ?? {}, fotos: p.fotos ?? [] };
  } catch { return { estadoGeral: "", items: {}, fotos: [] }; }
}

function parseSugestao(raw: string | null | undefined): SugestaoResult | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as SugestaoResult; } catch { return null; }
}

function parseDocumentos(raw: string): Documento[] {
  try { return JSON.parse(raw) as Documento[]; } catch { return []; }
}

export default async function LaudoPage({ params }: PageProps) {
  const { id } = await params;
  const a = await prisma.avaliacao.findUnique({ where: { id } });
  if (!a) notFound();

  const checklist = parseChecklist(a.caracteristicas ?? "");
  const sugestao = parseSugestao(a.sugestaoJson);
  const documentos = parseDocumentos(a.documentos ?? "[]");
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const totalItems = CHECKLIST_GROUPS.reduce((acc, g) => acc + g.items.length, 0);
  const checkedItems = Object.values(checklist.items).filter((v) => v.ok !== null).length;
  const conformes = Object.values(checklist.items).filter((v) => v.ok === true).length;
  const naoConformes = Object.values(checklist.items).filter((v) => v.ok === false).length;

  // Build resumo paragraph from available data
  const resumoParts: string[] = [];
  const tipoLabel = TIPO_LABELS[a.tipo] ?? a.tipo;
  const finalidadeLabel = FINALIDADE_LABELS[a.finalidade] ?? a.finalidade;
  resumoParts.push(
    `O presente laudo contempla ${tipoLabel.toLowerCase()} realizada para fins de ${finalidadeLabel.toLowerCase()}, referente ao imóvel localizado em ${a.endereco}, ${a.bairro}, ${a.cidade}/${a.estado}.`
  );
  const detalhes: string[] = [];
  if (a.areaConstruida != null) detalhes.push(`área construída de ${a.areaConstruida} m²`);
  if (a.areaTerreno != null) detalhes.push(`área de terreno de ${a.areaTerreno} m²`);
  if (a.quartos != null) detalhes.push(`${a.quartos} quartos`);
  if (a.banheiros != null) detalhes.push(`${a.banheiros} banheiros`);
  if (detalhes.length > 0) resumoParts.push(`O imóvel possui ${detalhes.join(", ")}.`);
  if (checkedItems > 0) {
    const estadoLabel = checklist.estadoGeral ? (ESTADO_GERAL_LABELS[checklist.estadoGeral] ?? checklist.estadoGeral).toLowerCase() : null;
    resumoParts.push(
      `A vistoria técnica verificou ${checkedItems} itens do checklist ABNT NBR 14653, com ${conformes} conformes e ${naoConformes} não conformes${estadoLabel ? `, indicando estado geral ${estadoLabel}` : ""}.`
    );
  }
  if (a.valorEstimado) {
    const metodoLabel = METODOLOGIA_LABELS[a.metodologia] ?? a.metodologia;
    resumoParts.push(
      `Pelo ${metodoLabel.toLowerCase()}, o valor estimado de mercado é de ${formatValorBR(a.valorEstimado)}${sugestao ? `, com faixa indicativa entre ${formatValorBR(sugestao.valorMin)} e ${formatValorBR(sugestao.valorMax)}` : ""}.`
    );
  }
  const resumo = resumoParts.join(" ");

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm 12mm; }
          .print-break-before { break-before: page; page-break-before: always; }
          .print-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar - hidden when printing */}
      <div className="no-print flex items-center gap-3 mb-6 p-4 bg-white border border-gray-100">
        <Link href={`/admin/avaliacoes/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* Laudo content */}
      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0 print:max-w-none space-y-6 text-sm">

        {/* Header */}
        <div className="border-b-2 border-[#1A1A1A] pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-black uppercase tracking-wide text-[#1A1A1A]">GRUPO SANTA FÉ</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Imóveis · Projetos · Avaliações</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Laudo de Avaliação</p>
            <p className="font-black text-[#1A1A1A] text-lg">{a.numero}</p>
            <p className="text-xs text-gray-500">{hoje}</p>
          </div>
        </div>

        {/* Tipo / Finalidade */}
        <div className="bg-[#1A1A1A] text-white p-4">
          <p className="font-black text-base uppercase">{TIPO_LABELS[a.tipo] ?? a.tipo}</p>
          <p className="text-[#F5C400] text-xs font-bold uppercase mt-0.5">
            {FINALIDADE_LABELS[a.finalidade] ?? a.finalidade}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Solicitante */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">Solicitante</p>
            <p className="font-bold text-[#1A1A1A]">{a.clienteNome}</p>
            {a.clienteCpf && <p className="text-xs text-gray-500 mt-0.5">CPF: {a.clienteCpf}</p>}
            <p className="text-xs text-gray-600 mt-0.5">{a.clienteTel}</p>
            {a.clienteEmail && <p className="text-xs text-gray-600">{a.clienteEmail}</p>}
          </div>

          {/* Avaliador */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">Avaliador Responsável</p>
            <p className="font-bold text-[#1A1A1A]">{a.avaliador}</p>
            <p className="text-xs text-gray-500 mt-0.5">{METODOLOGIA_LABELS[a.metodologia] ?? a.metodologia}</p>
            {a.dataVistoria && <p className="text-xs text-gray-600 mt-0.5">Vistoria: {new Date(a.dataVistoria).toLocaleDateString("pt-BR")}</p>}
            {a.prazoEntrega && <p className="text-xs text-gray-600">Prazo: {new Date(a.prazoEntrega).toLocaleDateString("pt-BR")}</p>}
          </div>
        </div>

        {/* Imóvel */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">Imóvel Avaliado</p>
          <p className="font-bold text-[#1A1A1A]">{a.endereco}</p>
          <p className="text-xs text-gray-500">{a.bairro} · {a.cidade}/{a.estado}</p>
          <div className="flex gap-6 mt-2">
            {a.areaConstruida != null && <span className="text-xs text-gray-600"><strong>{a.areaConstruida} m²</strong> construídos</span>}
            {a.areaTerreno != null && <span className="text-xs text-gray-600"><strong>{a.areaTerreno} m²</strong> terreno</span>}
            {a.quartos != null && <span className="text-xs text-gray-600"><strong>{a.quartos}</strong> quartos</span>}
            {a.banheiros != null && <span className="text-xs text-gray-600"><strong>{a.banheiros}</strong> banheiros</span>}
            {a.vagas != null && <span className="text-xs text-gray-600"><strong>{a.vagas}</strong> vagas</span>}
          </div>
          {checklist.estadoGeral && (
            <p className="text-xs mt-1 text-gray-600">Estado geral: <strong>{ESTADO_GERAL_LABELS[checklist.estadoGeral] ?? checklist.estadoGeral}</strong></p>
          )}
        </div>

        {/* Valor */}
        <div className="bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Valor Estimado de Mercado</p>
          <p className="font-black text-2xl text-[#1A1A1A]">
            {a.valorEstimado ? formatValorBR(a.valorEstimado) : "A definir"}
          </p>
        </div>

        {/* Resumo da Avaliação */}
        <div className="break-inside-avoid">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">Resumo da Avaliação</p>
          <p className="text-sm text-gray-700 leading-relaxed">{resumo}</p>
        </div>

        {/* Resumo checklist */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
            Checklist de Vistoria — ABNT NBR 14653
          </p>
          <div className="flex gap-6 mb-4 text-sm">
            <div className="text-center"><p className="font-black text-xl text-[#1A1A1A]">{checkedItems}/{totalItems}</p><p className="text-[10px] text-gray-400 uppercase">Verificados</p></div>
            <div className="text-center"><p className="font-black text-xl text-green-600">{conformes}</p><p className="text-[10px] text-gray-400 uppercase">Conformes</p></div>
            <div className="text-center"><p className="font-black text-xl text-red-500">{naoConformes}</p><p className="text-[10px] text-gray-400 uppercase">Não conformes</p></div>
          </div>

          {CHECKLIST_GROUPS.map((group) => {
            const groupItems = group.items.map((it) => ({ ...it, state: checklist.items[it.key] ?? { ok: null, nota: "" } }));
            const conformesInGroup = groupItems.filter((it) => it.state.ok === true).length;
            const ncInGroup = groupItems.filter((it) => it.state.ok === false).length;
            const naoVerifInGroup = groupItems.filter((it) => it.state.ok === null).length;
            return (
              <div key={group.id} className="mb-4 break-inside-avoid">
                <div className="flex items-center justify-between bg-gray-100 px-3 py-2 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]">{group.label}</p>
                  <div className="flex items-center gap-2">
                    {conformesInGroup > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 uppercase">{conformesInGroup} C</span>
                    )}
                    {ncInGroup > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 uppercase">{ncInGroup} NC</span>
                    )}
                    {naoVerifInGroup > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 uppercase">{naoVerifInGroup} NV</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  {groupItems.map((it) => {
                    const isConforme = it.state.ok === true;
                    const isNC = it.state.ok === false;
                    return (
                      <div key={it.key} className="flex items-start gap-1.5 py-1 border-b border-gray-50">
                        <span className={`mt-0.5 shrink-0 font-bold text-xs ${isConforme ? "text-green-600" : isNC ? "text-red-500" : "text-gray-300"}`}>
                          {isConforme ? "✓" : isNC ? "✗" : "—"}
                        </span>
                        <div>
                          <p className={`text-xs ${isConforme ? "text-gray-700" : isNC ? "text-red-600" : "text-gray-400"}`}>{it.label}</p>
                          {it.state.nota && <p className="text-[10px] text-gray-400 italic">{it.state.nota}</p>}
                          {it.state.ok === null && <p className="text-[10px] text-gray-300 italic">Não verificado</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Observações */}
        {a.observacoes && (
          <div className="break-inside-avoid">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">Observações</p>
            <p className="text-xs text-gray-600 whitespace-pre-line">{a.observacoes}</p>
          </div>
        )}

        {/* Análise de Mercado (IA) */}
        {sugestao && (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1">
              Análise de Mercado — Referência Comparativa
            </p>

            {/* Metodologia */}
            {sugestao.metodologia && (
              <div className="break-inside-avoid">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Metodologia Aplicada</p>
                <p className="text-sm text-gray-700 leading-relaxed">{sugestao.metodologia}</p>
              </div>
            )}

            {/* Indicadores principais */}
            <div className="break-inside-avoid">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Indicadores de Mercado</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#1A1A1A] text-white p-3 text-center">
                  <p className="text-[9px] text-gray-400 uppercase mb-1">Valor Sugerido</p>
                  <p className="text-sm font-black text-[#F5C400]">{formatValorBR(sugestao.valorSugerido)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 text-center">
                  <p className="text-[9px] text-gray-400 uppercase mb-1">Mínimo</p>
                  <p className="text-sm font-black text-[#1A1A1A]">{formatValorBR(sugestao.valorMin)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 text-center">
                  <p className="text-[9px] text-gray-400 uppercase mb-1">Máximo</p>
                  <p className="text-sm font-black text-[#1A1A1A]">{formatValorBR(sugestao.valorMax)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 text-center">
                  <p className="text-[9px] text-gray-400 uppercase mb-1">Valor/m²</p>
                  <p className="text-sm font-black text-[#1A1A1A]">{formatValorBR(sugestao.precoPorM2)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-gray-500">Confiabilidade da análise:</p>
                <span className={`text-xs font-bold px-2 py-0.5 uppercase ${
                  sugestao.confiabilidade === "alta" ? "bg-green-100 text-green-700" :
                  sugestao.confiabilidade === "media" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-600"
                }`}>
                  {sugestao.confiabilidade === "alta" ? "Alta" : sugestao.confiabilidade === "media" ? "Média" : "Baixa"}
                </span>
              </div>
            </div>

            {/* Imóveis Comparáveis */}
            {sugestao.comparaveis.length > 0 && (
              <div className="break-inside-avoid">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Imóveis Comparáveis Pesquisados ({sugestao.comparaveis.length})
                </p>
                <table className="w-full text-xs border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-3 py-2 font-black text-gray-600 uppercase text-[10px] border border-gray-200">Imóvel Comparável</th>
                      <th className="text-right px-3 py-2 font-black text-gray-600 uppercase text-[10px] border border-gray-200">Área (m²)</th>
                      <th className="text-right px-3 py-2 font-black text-gray-600 uppercase text-[10px] border border-gray-200">Valor de Mercado</th>
                      <th className="text-right px-3 py-2 font-black text-gray-600 uppercase text-[10px] border border-gray-200">R$/m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sugestao.comparaveis.map((c, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-gray-700 border border-gray-200">{c.descricao}</td>
                        <td className="px-3 py-2 text-right text-gray-600 border border-gray-200">{c.area}</td>
                        <td className="px-3 py-2 text-right font-bold text-[#1A1A1A] border border-gray-200">{formatValorBR(c.preco)}</td>
                        <td className="px-3 py-2 text-right text-gray-600 border border-gray-200">{formatValorBR(c.precoPorM2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Observações de mercado */}
            {sugestao.observacoes && (
              <div className="break-inside-avoid">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Análise e Observações</p>
                <p className="text-sm text-gray-700 leading-relaxed">{sugestao.observacoes}</p>
              </div>
            )}

            {/* Fontes consultadas */}
            {sugestao.fontes.length > 0 && (
              <div className="break-inside-avoid">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Fontes Consultadas</p>
                <ul className="space-y-0.5">
                  {sugestao.fontes.map((fonte, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-gray-300 shrink-0 mt-0.5">›</span>
                      {fonte}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Documentos Anexados */}
        {documentos.length > 0 && (
          <div className="break-inside-avoid">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-2">
              Documentos Anexados ({documentos.length})
            </p>
            <div className="space-y-1">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-1 border-b border-gray-50 gap-3">
                  <p className="text-xs text-gray-700 flex-1 min-w-0 truncate">{doc.nome}</p>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatSize(doc.tamanho)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos */}
        {checklist.fotos.length > 0 && (
          <div className="print-break-before">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
              Registro Fotográfico ({checklist.fotos.length} fotos)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {checklist.fotos.map((src, idx) => (
                <div key={idx} className="break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Foto ${idx + 1}`} className="w-full aspect-[4/3] object-cover border border-gray-200" />
                  <p className="text-[9px] text-gray-400 text-center mt-0.5">Foto {idx + 1}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assinatura — sempre em nova página para garantir impressão em iOS */}
        <div className="print-break-before print-break-inside-avoid pt-8 border-t-2 border-[#1A1A1A] mt-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Assinaturas</p>
          <div className="grid grid-cols-2 gap-12">
            <div>
              {/* Espaço para assinatura digital */}
              <div className="border border-dashed border-gray-300 mb-3 h-24 flex items-end justify-center pb-2">
                <span className="text-[9px] text-gray-300 uppercase tracking-widest">Assinar aqui</span>
              </div>
              <div className="border-b border-[#1A1A1A] mb-2" />
              <p className="text-xs font-bold text-[#1A1A1A]">{a.avaliador}</p>
              <p className="text-[10px] text-gray-400">Avaliador Responsável</p>
            </div>
            <div>
              {/* Espaço para assinatura digital */}
              <div className="border border-dashed border-gray-300 mb-3 h-24 flex items-end justify-center pb-2">
                <span className="text-[9px] text-gray-300 uppercase tracking-widest">Assinar aqui</span>
              </div>
              <div className="border-b border-[#1A1A1A] mb-2" />
              <p className="text-xs font-bold text-[#1A1A1A]">{a.clienteNome}</p>
              <p className="text-[10px] text-gray-400">Solicitante</p>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-8">
            Laudo emitido em {hoje} · Grupo Santa Fé · gruposantafee.com.br · {a.numero}
          </p>
        </div>

      </div>
    </>
  );
}
