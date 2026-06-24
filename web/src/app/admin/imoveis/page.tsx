import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { ImovelAcoes } from "./_components/imovel-acoes";
import { AgregarImoveisBtn } from "./_components/agregar-imoveis-btn";
import { auth } from "@/auth";

const typeLabel: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  lote: "Lote",
  terreno: "Terreno",
  comercial: "Comercial",
  chacara: "Chácara",
};

const statusColor: Record<string, string> = {
  venda: "bg-green-100 text-green-700",
  locacao: "bg-blue-100 text-blue-700",
  lancamento: "bg-[var(--brand-yellow)] text-[var(--brand-dark)]",
  vendido: "bg-gray-100 text-gray-500",
  locado: "bg-gray-100 text-gray-500",
};

type SessionUser = { role?: string; corretorId?: string };

export default async function AdminImoveisPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const imoveis = await prisma.imovel.findMany({
    where: isCorretor && corretorId ? { corretorId } : {},
    orderBy: { criadoEm: "desc" },
    include: { corretor: true },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Imóveis
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {imoveis.length} imóveis cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AgregarImoveisBtn />
          <Link
            href="/admin/imoveis/novo"
            className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
          >
            <Plus size={14} />
            Novo Imóvel
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border border-gray-100 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, bairro ou tipo..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
        </div>
        <select className="py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none">
          <option value="">Todos os tipos</option>
          {Object.entries(typeLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none">
          <option value="">Todas as situações</option>
          <option value="venda">Venda</option>
          <option value="locacao">Locação</option>
          <option value="lancamento">Lançamento</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide">
                  Ref
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide">
                  Imóvel
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">
                  Localização
                </th>
                <th className="px-4 py-3 text-right font-bold text-gray-400 uppercase tracking-wide">
                  Preço
                </th>
                <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                  Situação
                </th>
                <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {imoveis.map((imovel) => (
                <tr key={imovel.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    GSF-{imovel.id.slice(-4).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--brand-dark)] leading-tight">
                      {imovel.titulo}
                    </p>
                    {imovel.badge && (
                      <span className="text-[10px] bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold px-1.5 py-0.5 uppercase">
                        {imovel.badge}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-500">
                      {typeLabel[imovel.tipo] ?? imovel.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500">
                      {imovel.bairro}, {imovel.cidade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)]">
                    {formatCurrency(imovel.preco)}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${statusColor[imovel.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {imovel.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ImovelAcoes id={imovel.id} titulo={imovel.titulo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
