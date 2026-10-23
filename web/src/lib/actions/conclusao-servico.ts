"use server";
// Lote 23/10, etapa 4: botão "Concluir" do card "Serviços do Cliente" no CRM.
import { revalidatePath } from "next/cache";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { prisma } from "@/lib/db";
import { PERMISSAO_DO_MODULO, mensagemConclusao, moduloConcluivel } from "@/lib/crm/conclusao-servico";
import { concluirRegistroDoLead } from "@/lib/crm/conclusao-servico-db";
import { MODULO_CONFIG } from "@/lib/crm/servicos-lead";

export async function concluirServicoDoLead(leadId: string, modulo: string, registroId: string) {
  return capturarErroAcao(async () => {
    if (!moduloConcluivel(modulo)) throw new Error("Serviço sem módulo operacional para concluir.");
    await exigirModuloAcao(["leads"], { somenteEquipe: true });
    await exigirModuloAcao(PERMISSAO_DO_MODULO[modulo], { somenteEquipe: true });
    const r = await concluirRegistroDoLead(prisma, leadId, modulo, registroId);
    revalidatePath(`/admin/leads/${leadId}`);
    revalidatePath(MODULO_CONFIG[modulo].rota);
    return { ...r, mensagem: mensagemConclusao(r) };
  });
}
