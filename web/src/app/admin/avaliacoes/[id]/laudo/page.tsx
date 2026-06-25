import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
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

function parseChecklist(raw: string): ChecklistData {
  try {
    const p = JSON.parse(raw) as Partial<ChecklistData>;
    return { estadoGeral: p.estadoGeral ?? "", items: p.items ?? {}, fotos: p.fotos ?? [] };
  } catch { return { estadoGeral: "", items: {}, fotos: [] }; }
}

export default async function LaudoPage({ params }: PageProps) {
  const { id } = await params;
  const a = await prisma.avaliacao.findUnique({ where: { id } });
  if (!a) notFound();

  const checklist = parseChecklist(a.caracteristicas ?? "");
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const totalItems = CHECKLIST_GROUPS.reduce((acc, g) => acc + g.items.length, 0);
  const checkedItems = Object.values(checklist.items).filter((v) => v.ok !== null).length;
  const conformes = Object.values(checklist.items).filter((v) => v.ok === true).length;
  const naoConformes = Object.values(checklist.items).filter((v) => v.ok === false).length;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm 12mm; }
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
            {a.valorEstimado ? formatCurrency(a.valorEstimado) : "A definir"}
          </p>
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
            const verifiedInGroup = groupItems.filter((it) => it.state.ok !== null);
            if (verifiedInGroup.length === 0) return null;
            const ncInGroup = groupItems.filter((it) => it.state.ok === false);
            return (
              <div key={group.id} className="mb-3 break-inside-avoid">
                <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]">{group.label}</p>
                  {ncInGroup.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 uppercase">{ncInGroup.length} NC</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  {groupItems.filter((it) => it.state.ok !== null).map((it) => (
                    <div key={it.key} className="flex items-start gap-1.5 py-0.5 border-b border-gray-50">
                      <span className={`mt-0.5 shrink-0 font-bold text-xs ${it.state.ok ? "text-green-600" : "text-red-500"}`}>
                        {it.state.ok ? "✓" : "✗"}
                      </span>
                      <div>
                        <p className={`text-xs ${it.state.ok ? "text-gray-700" : "text-red-600"}`}>{it.label}</p>
                        {it.state.nota && <p className="text-[10px] text-gray-400 italic">{it.state.nota}</p>}
                      </div>
                    </div>
                  ))}
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

        {/* Fotos */}
        {checklist.fotos.length > 0 && (
          <div className="break-before-page">
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

        {/* Assinatura */}
        <div className="break-inside-avoid pt-8 border-t border-gray-200 mt-8">
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="border-b border-[#1A1A1A] mb-2 pb-6" />
              <p className="text-xs font-bold text-[#1A1A1A]">{a.avaliador}</p>
              <p className="text-[10px] text-gray-400">Avaliador Responsável</p>
            </div>
            <div>
              <div className="border-b border-[#1A1A1A] mb-2 pb-6" />
              <p className="text-xs font-bold text-[#1A1A1A]">{a.clienteNome}</p>
              <p className="text-[10px] text-gray-400">Solicitante</p>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-6">
            Laudo emitido em {hoje} · Grupo Santa Fé · gruposantafee.com.br · {a.numero}
          </p>
        </div>

      </div>
    </>
  );
}
