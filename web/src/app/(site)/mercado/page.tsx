import { Search } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { MercadoClient } from "./mercado-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mercado de Imóveis | Grupo Santa Fé",
  description: "Todos os imóveis disponíveis em Canaã dos Carajás — reunidos de OLX, ZAP, Facebook e anúncios diretos. Verificados pela equipe Grupo Santa Fé.",
};

export default async function MercadoPage() {
  const listings = await prisma.agregadorImovel.findMany({
    where: { status: "verificado" },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[var(--brand-dark)] py-12 px-4">
        <div className="max-w-5xl mx-auto mb-6">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-widest mb-2">
            Canaã dos Carajás — PA
          </p>
          <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-wide mb-3">
            Mercado de Imóveis
          </h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6">
            Todos os imóveis disponíveis na cidade — reunidos de OLX, ZAP, Facebook, Instagram e anúncios diretos. Verificados pela equipe Grupo Santa Fé.
          </p>
          {listings.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Search size={16} />
              Nenhum imóvel verificado no momento. Em breve novos anúncios.
            </div>
          )}
        </div>
      </div>

      <MercadoClient listings={listings} />
    </div>
  );
}
