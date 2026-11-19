"use server";
// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-06: ações da proposta formal de aquisição do terreno.
// Erros voltam como dado (`capturarErroAcao`) para a tela mostrar a mensagem.
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { enviarPropostaTerrenoPorEmail, enviosDasPropostasTerreno, pdfDaPropostaTerreno } from "@/lib/incorporacao/proposta-terreno";

export async function pdfPropostaTerreno(estudoId: string, propostaId: string, dataEmissao?: string) {
  return capturarErroAcao(async () => pdfDaPropostaTerreno(estudoId, propostaId, await exigirModuloAcao("incorporacao"), dataEmissao));
}

export async function enviarPropostaTerreno(estudoId: string, propostaId: string, destinatario: string, dataEmissao: string) {
  return capturarErroAcao(async () => enviarPropostaTerrenoPorEmail(estudoId, propostaId, destinatario, await exigirModuloAcao("incorporacao"), dataEmissao));
}

export async function enviosPropostaTerreno(estudoId: string) {
  await exigirModuloAcao("incorporacao");
  return enviosDasPropostasTerreno(estudoId);
}
