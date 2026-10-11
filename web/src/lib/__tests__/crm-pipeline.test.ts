import { describe, expect, it, vi } from "vitest";
import { LEAD_STAGES, LEAD_STAGE_CONFIG } from "../types/crm";
import { etapaDoLead, isLeadStage, leadNoPipelineAtivo, parseServicosLead } from "../crm/pipeline";
import { registrarMudancaEtapa } from "../crm/pipeline-transicao";
import type { Prisma } from "@/generated/prisma/client";

const snapshot = { id: "L1", status: "proposta", etapaOperacional: null, atualizadoEm: new Date("2026-10-11T10:00:00Z"), arquivadoEm: null, excluidoEm: null };
function transaction(count = 1) {
  return { lead: { updateMany: vi.fn(async () => ({ count })) }, interacao: { create: vi.fn(async () => ({})) } };
}

describe("pipeline operacional Santa Fé", () => {
  it("tem exatamente sete etapas na ordem solicitada", () => {
    expect(LEAD_STAGES.map((s) => LEAD_STAGE_CONFIG[s].label)).toEqual(["NOVO LEAD", "EM ATENDIMENTO", "APROVADO E FOLLOW-UP", "PROJETOS E VISTORIAS", "CONTRATOS E CARTÓRIO", "MEDIÇÕES", "FINALIZADO"]);
    expect(isLeadStage("perdido")).toBe(false);
    expect(isLeadStage("constructor")).toBe(false);
    expect(isLeadStage("__proto__")).toBe(false);
  });
  it("converte somente novo e contato inequívocos, preservando os estados originais", () => {
    expect(etapaDoLead({ status: "novo", etapaOperacional: null })).toBe("novo_lead");
    expect(etapaDoLead({ status: "contato", etapaOperacional: null })).toBe("em_atendimento");
    for (const status of ["proposta", "negociacao", "ganho", "visita_agendada", "perdido", "desconhecido"]) {
      const lead = { status, etapaOperacional: null };
      expect(etapaDoLead(lead)).toBeNull(); expect(lead.status).toBe(status);
    }
    expect(etapaDoLead({ status: "ganho", etapaOperacional: "medicoes" })).toBe("medicoes");
    expect(etapaDoLead({ status: "novo", etapaOperacional: "invalid" })).toBeNull();
  });
  it("mantém perdidos/arquivados/excluídos fora do pipeline mesmo com etapa", () => {
    expect(leadNoPipelineAtivo(snapshot)).toBe(true);
    for (const status of ["perdido", "lost", "arquivado", "archived", "excluido", "deleted"]) expect(leadNoPipelineAtivo({ ...snapshot, status, etapaOperacional: "novo_lead" })).toBe(false);
    expect(leadNoPipelineAtivo({ ...snapshot, arquivadoEm: new Date() })).toBe(false);
    expect(leadNoPipelineAtivo({ ...snapshot, excluidoEm: new Date() })).toBe(false);
  });
  it("lê multisseleção e serviços legados sem falha ou perda", () => {
    expect(parseServicosLead('["Projeto","Obra","Projeto",null,2]')).toEqual(["Projeto", "Obra"]);
    expect(parseServicosLead("Serviço antigo")).toEqual(["Serviço antigo"]);
    expect(parseServicosLead('"Serviço antigo"')).toEqual(["Serviço antigo"]);
    expect(parseServicosLead("[]")).toEqual([]);
  });
});

describe("registro transacional de etapa", () => {
  it("compara versão e etapa, escreve somente nova etapa e registra antes/depois + original", async () => {
    const tx = transaction();
    await registrarMudancaEtapa(tx as unknown as Prisma.TransactionClient, snapshot, "medicoes", "Equipe Santa Fé");
    expect(tx.lead.updateMany).toHaveBeenCalledWith({ where: { id: "L1", status: "proposta", etapaOperacional: null, atualizadoEm: snapshot.atualizadoEm, arquivadoEm: null, excluidoEm: null }, data: { etapaOperacional: "medicoes" } });
    expect(tx.interacao.create).toHaveBeenCalledWith({ data: { leadId: "L1", tipo: "nota", descricao: "Etapa operacional: A CLASSIFICAR → MEDIÇÕES. Status comercial preservado: proposta.", criadoPor: "Equipe Santa Fé" } });
  });
  it("recusa corrida sem registrar histórico falso", async () => {
    const tx = transaction(0);
    await expect(registrarMudancaEtapa(tx as unknown as Prisma.TransactionClient, snapshot, "finalizado", "Equipe")).rejects.toThrow("atualizado por outra pessoa");
    expect(tx.interacao.create).not.toHaveBeenCalled();
  });
  it("recusa estados inválidos e leads inativos antes de escrever", async () => {
    const tx = transaction();
    await expect(registrarMudancaEtapa(tx as unknown as Prisma.TransactionClient, snapshot, "ganho", "Equipe")).rejects.toThrow("inválida");
    await expect(registrarMudancaEtapa(tx as unknown as Prisma.TransactionClient, { ...snapshot, status: "perdido" }, "finalizado", "Equipe")).rejects.toThrow("pipeline ativo");
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
  });
});
