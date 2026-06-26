import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatTelefone } from "@/lib/utils";
import { atualizarStatusAvaliacao } from "@/lib/actions/avaliacoes";
import { ChecklistVistoria } from "./_components/checklist-vistoria";
import { SugestaoAvaliacaoBtn } from "./_components/sugestao-btn";
import { ZapComparaveisBtn } from "./_components/zap-btn";
import { DocumentosAvaliacao } from "./_components/documentos-avaliacao";
import { ValorEstimadoCard } from "./_components/valor-estimado-card";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; order: number }> = {
  solicitada:  { label: "Solicitada",    bg: "bg-gray-100",   text: "text-gray-600",   order: 1 },
  vistoria:    { label: "Vistoria",      bg: "bg-blue-100",   text: "text-blue-700",   order: 2 },
  elaboracao:  { label: "Elaboração",    bg: "bg-yellow-100", text: "text-yellow-700", order: 3 },
  revisao:     { label: "Revisão",       bg: "bg-orange-100", text: "text-orange-700", order: 4 },
  entregue:    { label: "Entregue",      bg: "bg-green-100",  text: "text-green-700",  order: 5 },
  cancelada:   { label: "Cancelada",     bg: "bg-red-100",    text: "text-red-600",    order: 6 },
};

const TIPO_LABELS: Record<string, string> = {
  mercado: "Avaliação de Mercado", locacao: "Avaliação p/ Locação",
  judicial: "Avaliação Judicial", parecer_tecnico: "Parecer Técnico",
};

const FINALIDADE_LABELS: Record<string, string> = {
  compra_venda: "Compra e Venda", locacao: "Locação", judicial: "Processo Judicial",
  garantia: "Garantia Bancária", inventario: "Inventário", seguro: "Seguro",
};

interface PageProps { params: Promise<{ id: string }> }

export default async function AvaliacaoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const a = await prisma.avaliacao.findUnique({ where: { id }, include: { lead: { select: { id: true, nome: true, telefone: true } } } });
  if (!a) notFound();

  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.solicitada;
  const nextStatuses = Object.entries(STATUS_CONFIG)
    .filter(([s]) => s !== a.status && s !== "cancelada")
    .sort(([, x], [, y]) => x.order - y.order);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/avaliacoes" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Avaliações
        </Link>
        <div>
          <span className="text-xs font-mono text-gray-400">{a.numero}</span>
          <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase leading-tight">
            {TIPO_LABELS[a.tipo] ?? a.tipo}
          </h1>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
        <Link
          href={`/admin/avaliacoes/${id}/laudo`}
          target="_blank"
          className="ml-auto flex items-center gap-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-black transition-colors"
        >
          <FileText size={13} /> Gerar Laudo PDF
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="bg-white border border-gray-100 p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Solicitante</p>
            <p className="font-bold text-[var(--brand-dark)]">{a.clienteNome}</p>
            {a.clienteCpf && <p className="text-xs text-gray-500">CPF: {a.clienteCpf}</p>}
            <a href={`tel:${a.clienteTel}`} className="flex items-center gap-2 text-sm text-[var(--brand-dark)] hover:text-[var(--brand-yellow)]">
              <Phone size={13} /> {formatTelefone(a.clienteTel)}
            </a>
            {a.clienteEmail && (
              <a href={`mailto:${a.clienteEmail}`} className="flex items-center gap-2 text-sm text-[var(--brand-dark)] hover:text-[var(--brand-yellow)]">
                <Mail size={13} /> {a.clienteEmail}
              </a>
            )}
            {a.lead && (
              <Link href={`/admin/leads/${a.lead.id}`} className="flex items-center gap-1 text-xs text-[var(--brand-yellow)] hover:underline font-bold mt-1">
                Lead vinculado: {a.lead.nome}
              </Link>
            )}
          </div>

          {/* Imóvel */}
          <div className="bg-white border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Imóvel Avaliado</p>
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-[var(--brand-dark)]">{a.endereco}</p>
                <p className="text-xs text-gray-400">{a.bairro} · {a.cidade}/{a.estado}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              {a.areaConstruida != null && (
                <div className="bg-gray-50 p-2 text-center">
                  <p className="font-black text-[var(--brand-dark)] text-sm">{a.areaConstruida}m²</p>
                  <p className="text-[9px] text-gray-400">Construído</p>
                </div>
              )}
              {a.areaTerreno != null && (
                <div className="bg-gray-50 p-2 text-center">
                  <p className="font-black text-[var(--brand-dark)] text-sm">{a.areaTerreno}m²</p>
                  <p className="text-[9px] text-gray-400">Terreno</p>
                </div>
              )}
              {a.quartos != null && (
                <div className="bg-gray-50 p-2 text-center">
                  <p className="font-black text-[var(--brand-dark)] text-sm">{a.quartos}</p>
                  <p className="text-[9px] text-gray-400">Quartos</p>
                </div>
              )}
            </div>
          </div>

          {/* Avaliação info */}
          <div className="bg-white border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Avaliação</p>
            <p className="text-sm text-gray-600"><span className="text-gray-400">Tipo:</span> {TIPO_LABELS[a.tipo] ?? a.tipo}</p>
            <p className="text-sm text-gray-600"><span className="text-gray-400">Finalidade:</span> {FINALIDADE_LABELS[a.finalidade] ?? a.finalidade}</p>
            <p className="text-sm text-gray-600"><span className="text-gray-400">Metodologia:</span> {a.metodologia}</p>
            <p className="text-sm text-gray-600"><span className="text-gray-400">Avaliador:</span> {a.avaliador}</p>
            {a.dataVistoria && (
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar size={12} className="text-gray-400" />
                Vistoria: {new Date(a.dataVistoria).toLocaleDateString("pt-BR")}
              </p>
            )}
            {a.prazoEntrega && (
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar size={12} className="text-gray-400" />
                Prazo: {new Date(a.prazoEntrega).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Valor estimado */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Valor Estimado</p>
            {a.valorEstimado ? (
              <ValorEstimadoCard
                avaliacaoId={id}
                valorEstimado={a.valorEstimado}
                status={a.status}
                dataEntrega={a.dataEntrega}
              />
            ) : (
              <form id={`form-valor-${id}`} action={atualizarStatusAvaliacao} className="flex gap-3 items-end">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={a.status} />
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Registrar valor (R$)</label>
                  <input name="valorEstimado" type="number" step="0.01" placeholder="Ex: 450000" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <button type="submit" className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors hover:bg-black">
                  Salvar
                </button>
              </form>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <ZapComparaveisBtn
                avaliacaoId={id}
                bairro={a.bairro}
                cidade={a.cidade}
                estado={a.estado}
                tipo={a.tipo}
                areaConstruida={a.areaConstruida}
              />
              <SugestaoAvaliacaoBtn
                avaliacaoId={id}
                endereco={a.endereco}
                bairro={a.bairro}
                cidade={a.cidade}
                estado={a.estado}
                tipo={a.tipo}
                areaConstruida={a.areaConstruida}
                areaTerreno={a.areaTerreno}
                quartos={a.quartos}
                banheiros={a.banheiros ?? null}
                caracteristicas={a.caracteristicas ?? ""}
              />
            </div>
          </div>

          {/* Pipeline */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Avançar Status</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map(([s, c]) => (
                <form key={s} action={atualizarStatusAvaliacao}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <button type="submit" className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${c.bg} ${c.text} hover:opacity-80`}>
                    → {c.label}
                  </button>
                </form>
              ))}
              {a.status !== "cancelada" && (
                <form action={atualizarStatusAvaliacao}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value="cancelada" />
                  <button type="submit" className="px-3 py-1.5 text-xs font-bold uppercase bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    Cancelar
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Documentos */}
          <DocumentosAvaliacao avaliacaoId={id} initialData={a.documentos ?? "[]"} />

          {/* Observações */}
          {a.observacoes && (
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Observações</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{a.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <ChecklistVistoria avaliacaoId={id} initialData={a.caracteristicas ?? ""} />
      </div>
    </div>
  );
}
