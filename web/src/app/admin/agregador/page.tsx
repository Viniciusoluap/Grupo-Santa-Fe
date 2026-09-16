import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { AgregadorClient } from "./_components/agregador-client";

export default async function AgregadorPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const listings = await prisma.agregadorImovel.findMany({
    orderBy: { criadoEm: "desc" },
  });
  return <AgregadorClient initialListings={listings} />;
}
