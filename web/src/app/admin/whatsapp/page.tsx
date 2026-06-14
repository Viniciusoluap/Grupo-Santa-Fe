import { prisma } from "@/lib/db";
import { WhatsAppClient } from "./_components/whatsapp-client";

export default async function WhatsAppPage() {
  const leads = await prisma.lead.findMany({
    select: { id: true, nome: true, telefone: true, servico: true },
    orderBy: { criadoEm: "desc" },
  });
  return <WhatsAppClient leads={leads} />;
}
