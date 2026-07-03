import { FileText, Plus, Scale, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { JuridicoNovoContrato } from "./_components/juridico-novo-contrato";
import { ContratoAcoes } from "./_components/contrato-acoes";
import { ContratoDocumentos } from "./_components/contrato-documentos";
import { ChatAdmin } from "./_components/chat-admin";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:  { bg: "bg-gray-100",   text: "text-gray-600" },
  ativo:     { bg: "bg-green-100",  text: "text-green-700" },
  vencido:   { bg: "bg-red-100",    text: "text-red-600" },
  cancelado: { bg: "bg-red-50",     text: "text-red-400" },
  concluido: { bg: "bg-blue-100",   text: "text-blue-700" },
};

const ASSINATURA_BADGE: Record<string, { label: string; dot: string }> = {
  pendente:   { label: "Pendente",   dot: "bg-gray-400" },
  solicitado: { label: "Solicitado", dot: "bg-yellow-400" },
  assinado:   { label: "Assinado",   dot: "bg-green-500" },
  rejeitado:  { label: "Rejeitado",  dot: "bg-red-500" },
};

type Tab = "contratos" | "chat";

export default async function JuridicoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab: Tab = sp.tab === "chat" ? "chat" : "contratos";

  const [contratos, leads, configsDB] = await Promise.all([
    prisma.contrato.findMany({
      orderBy: { criadoEm: "desc" },
      include: {
        imovel: true,
        comissoes: { include: { corretor: true } },
        documentos: { orderBy: { criadoEm: "desc" } },
      },
    }),
    prisma.lead.findMany({
      select: { id: true, nome: true, telefone: true, email: true },
      orderBy: { nome: "asc" },
    }),
    prisma.configuracao.findMany({
      where: { chave: { in: ["razao_social", "cnpj"] } },
    }),
  ]);

  const configMap = Object.fromEntries(configsDB.map((c) => [c.chave, c.valor]));
  const empresa = {
    razaoSocial: configMap["razao_social"] ?? "Grupo Santa Fé",
    cnpj: configMap["cnpj"] ?? "",
  };

  const ativos = contratos.filter((c) => c.status === "ativo").length;
  const rascunhos = contratos.filter((c) => c.status === "rascunho").length;
  const valorTotal = contratos.filter((c) => c.status === "ativo").reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide flex items-center gap-2">
            <Scale size={20} /> Jurídico
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} · Contratos, documentos e atendimento
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: contratos.length, color: "text-[var(--brand-dark)]", bg: "bg-[var(--brand-yellow)]" },
          { label: "Ativos", value: ativos, color: "text-green-700", bg: "bg-green-100" },
          { label: "Rascunhos", value: rascunhos, color: "text-gray-600", bg: "bg-gray-100" },
          { label: "Valor em carteira", value: formatCurrency(valorTotal), color: "text-[var(--brand-dark)]", bg: "bg-blue-100" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <p className={`font-black text-xl leading-none ${color}`}>{value}</p>
            <p className="text-gray-400 text-xs mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(
          [
            { key: "contratos", label: "Contratos", icon: FileText },
            { key: "chat", label: "Chat de Atendimento", icon: MessageSquare },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <a
            key={key}
            href={`/admin/juridico${key === "contratos" ? "" : `?tab=${key}`}`}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === key
                ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon size={14} /> {label}
          </a>
        ))}
      </div>

      {activeTab === "contratos" && (
        <>
          {/* Quick add form */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={12} /> Novo Contrato
            </p>
            <JuridicoNovoContrato leads={leads} empresa={empresa} />
          </div>

          {/* Contracts list */}
          {contratos.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
              <FileText size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum contrato cadastrado</p>
              <p className="text-gray-400 text-sm mt-1">Use o formulário acima para criar o primeiro contrato.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--brand-dark)]">
                    <tr>
                      {["Número", "Tipo", "Parte A", "Parte B", "Valor", "Vencimento", "Assinatura", "Docs", "Status", "Ações"].map((h) => (
                        <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {contratos.map((c) => {
                      const st = STATUS_COLORS[c.status] ?? STATUS_COLORS.rascunho;
                      const assBadge = ASSINATURA_BADGE[c.assinaturaStatus] ?? ASSINATURA_BADGE.pendente;
                      const pdfDoc = c.documentos.find((d) => d.tipo === "contrato_gerado");
                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{c.numero}</td>
                          <td className="px-3 py-3 text-gray-700 capitalize text-xs whitespace-nowrap">{c.tipo.replace(/_/g, " ")}</td>
                          <td className="px-3 py-3 font-medium text-[var(--brand-dark)] max-w-[120px] truncate text-xs">{c.parteA}</td>
                          <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate text-xs">{c.parteB}</td>
                          <td className="px-3 py-3 font-bold text-[var(--brand-dark)] text-xs whitespace-nowrap">{formatCurrency(c.valor)}</td>
                          <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-600 whitespace-nowrap">
                              <span className={`w-1.5 h-1.5 rounded-full ${assBadge.dot}`} />
                              {assBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <ContratoDocumentos
                              contratoNumero={c.numero}
                              documentos={c.documentos}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${st.bg} ${st.text} whitespace-nowrap`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <ContratoAcoes
                              contratoId={c.id}
                              pdfUrl={pdfDoc?.url}
                              assinaturaStatus={c.assinaturaStatus}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "chat" && (
        <ChatAdmin leads={leads} />
      )}
    </div>
  );
}
