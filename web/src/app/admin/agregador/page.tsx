import { prisma } from "@/lib/db";
import { AgregadorClient } from "./_components/agregador-client";

export default async function AgregadorPage() {
  const listings = await prisma.agregadorImovel.findMany({
    orderBy: { criadoEm: "desc" },
  });
  return <AgregadorClient initialListings={listings} />;
}
