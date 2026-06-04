import { ClientProcess } from "@/lib/types/portal";

export const mockClientProcess: ClientProcess = {
  id: "proc-001",
  clientName: "Carlos Mendes",
  service: "financiamento_mcmv",
  property: "Residencial Jardim Novo — Apto 204, Bloco B",
  currentStage: "documentacao",
  startDate: "2026-01-10",
  estimatedEnd: "2026-06-30",
  corretor: "João Santos",
  corretorPhone: "(62) 9 9999-1111",
  corretorEmail: "joao@gruposantafe.com.br",
  propertyValue: 280000,
  financingValue: 250000,
  progress: 43,
  documents: [
    { id: "d1", name: "RG / CNH", required: true, status: "aprovado", uploadedAt: "2026-01-15" },
    { id: "d2", name: "CPF", required: true, status: "aprovado", uploadedAt: "2026-01-15" },
    { id: "d3", name: "Comprovante de residência", required: true, status: "aprovado", uploadedAt: "2026-01-16" },
    { id: "d4", name: "Certidão de estado civil", required: true, status: "aprovado", uploadedAt: "2026-01-18" },
    { id: "d5", name: "Extratos bancários (3 meses)", required: true, status: "aprovado", uploadedAt: "2026-01-20" },
    { id: "d6", name: "Declaração de IR (último)", required: true, status: "enviado", uploadedAt: "2026-02-01" },
    { id: "d7", name: "Holerite / Comprovante de renda", required: true, status: "enviado", uploadedAt: "2026-02-01" },
    { id: "d8", name: "Extrato do FGTS", required: false, status: "enviado", uploadedAt: "2026-02-05" },
    { id: "d9", name: "Carteira de trabalho", required: true, status: "pendente" },
    { id: "d10", name: "Certidão de matrícula do imóvel", required: true, status: "pendente" },
    { id: "d11", name: "Laudo de avaliação do imóvel", required: true, status: "pendente" },
  ],
  updates: [
    { id: "u1", date: "2026-01-10", stage: "cadastro", message: "Cadastro realizado com sucesso. Seu processo de financiamento foi iniciado.", by: "João Santos" },
    { id: "u2", date: "2026-01-20", stage: "analise", message: "Documentos iniciais recebidos. Iniciando análise de crédito junto à Caixa Econômica Federal.", by: "João Santos" },
    { id: "u3", date: "2026-02-05", stage: "analise", message: "Análise de crédito aprovada! Score positivo. Aguardando complementação de documentos.", by: "Sistema" },
    { id: "u4", date: "2026-02-10", stage: "documentacao", message: "Etapa de documentação iniciada. Por favor envie os documentos pendentes listados abaixo.", by: "João Santos" },
    { id: "u5", date: "2026-03-01", stage: "documentacao", message: "Extrato do FGTS recebido e validado. Continue enviando os demais documentos.", by: "João Santos" },
  ],
};

export function getClientProcess() {
  return mockClientProcess;
}
