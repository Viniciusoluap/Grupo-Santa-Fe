import { FileText, Plus, Scale } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { JuridicoNovoContrato } from "./_components/juridico-novo-contrato";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:  { bg: "bg-gray-100",   text: "text-gray-600" },
  ativo:     { bg: "bg-green-100",  text: "text-green-700" },
  vencido:   { bg: "bg-red-100",    text: "text-red-600" },
  cancelado: { bg: "bg-red-50",     text: "text-red-400" },
  concluido: { bg: "bg-blue-100",   text: "text-blue-700" },
};

export default async function JuridicoPage() {
  const [contratos, leads, configsDB] = await Promise.all([
    prisma.contrato.findMany({
      orderBy: { criadoEm: "desc" },
      include: { imovel: true, comissoes: { include: { corretor: true } } },
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
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} · Gestão de contratos e atendimentos jurídicos
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
                  {["Número", "Tipo", "Parte A", "Parte B", "Valor", "Vencimento", "Status"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contratos.map((c) => {
                  const st = STATUS_COLORS[c.status] ?? STATUS_COLORS.rascunho;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.numero}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{c.tipo.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-medium text-[var(--brand-dark)] max-w-[140px] truncate">{c.parteA}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{c.parteB}</td>
                      <td className="px-4 py-3 font-bold text-[var(--brand-dark)]">{formatCurrency(c.valor)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${st.bg} ${st.text}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Future: online services section */}
      <div className="bg-white border border-dashed border-gray-200 p-8 text-center">
        <Scale size={28} className="text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 font-bold text-sm">Atendimentos Online</p>
        <p className="text-gray-400 text-xs mt-1">Em breve — área para agendamento de consultas jurídicas online.</p>
      </div>
    </div>
  );
}
