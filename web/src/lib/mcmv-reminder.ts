import { prisma } from "@/lib/db";
import { notifyAdminByEmail } from "@/lib/email";

/**
 * Lembrete periódico por e-mail: não existe API pública oficial da Caixa/MCMV
 * para as faixas de renda, subsídio e taxa de juros usadas no simulador
 * (src/lib/mortgage.ts — MCMV_PROGRAMS, BANK_RATES). A cada 30 dias, avisa o
 * admin por e-mail para conferir a portaria vigente e, se preciso, atualizar
 * os valores manualmente. Sem scraping de fonte não-oficial, sem aviso visual
 * no simulador público — mesma decisão tomada no Prospecta (epic-014).
 */
const CHAVE_CONFIGURACAO = "mcmv_rules_reminder_last_sent_at";
const INTERVALO_DIAS = 30;

export async function checkAndSendReminder(): Promise<void> {
  try {
    const config = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CONFIGURACAO } });
    const ultimoEnvio = config ? new Date(config.valor) : null;
    const vencimento = ultimoEnvio
      ? new Date(ultimoEnvio.getTime() + INTERVALO_DIAS * 24 * 60 * 60 * 1000)
      : new Date();

    if (ultimoEnvio && vencimento > new Date()) {
      return; // ainda não venceu o prazo de 30 dias
    }

    const enviado = await notifyAdminByEmail({
      titulo: "Revisão periódica das regras do MCMV no simulador",
      linhas: [
        {
          label: "O que fazer",
          valor:
            "Conferir a portaria vigente da Caixa/Ministério das Cidades (faixas de renda, subsídio máximo e taxa de juros) e atualizar MCMV_PROGRAMS/BANK_RATES em src/lib/mortgage.ts se houver mudança.",
        },
        { label: "Motivo", valor: "Não existe API pública oficial para essas regras; a atualização é manual." },
        { label: "Periodicidade", valor: `A cada ${INTERVALO_DIAS} dias` },
      ],
    });

    if (enviado) {
      await prisma.configuracao.upsert({
        where: { chave: CHAVE_CONFIGURACAO },
        create: { chave: CHAVE_CONFIGURACAO, valor: new Date().toISOString(), grupo: "simulador" },
        update: { valor: new Date().toISOString() },
      });
    }
  } catch (error) {
    console.error("[McmvRulesReminder] Erro ao verificar/enviar lembrete:", error);
  }
}
