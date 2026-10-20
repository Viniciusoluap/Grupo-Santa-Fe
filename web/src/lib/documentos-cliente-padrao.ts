export const DOCUMENTOS_CLIENTE = [
  { chave: "rg", nome: "RG ou CNH frente e verso" },
  { chave: "address_proof", nome: "Comprovante de endereço atualizado" },
  { chave: "income_proof_formal", nome: "Comprovante de renda atualizado" },
  { chave: "spouse_docs", nome: "RG ou CNH frente e verso (Cônjuge)" },
  { chave: "spouse_income_proof", nome: "Comprovante de renda atualizado (Cônjuge)" },
  { chave: "pis", nome: "PIS" },
  { chave: "fgts", nome: "Extrato do FGTS" },
  { chave: "birth_marriage_certificate", nome: "Certidão de Nascimento ou Casamento" },
  { chave: "other", nome: "Outros" },
] as const;
export const DOCUMENTOS_FINANCIAMENTO = ["Certidão de inteiro teor", "ART", "Alvará", "Memorial descritivo", "Habite-se", "Projeto aprovado", "Conta de água", "PCI em PDF", "PCI em XLS", "PLS", "CNO e CND", "Outros"] as const;
export function ordenarDocumentosFinanciamento<T extends { item: string }>(itens: T[]): T[] {
  return [...itens].sort((a,b) => DOCUMENTOS_FINANCIAMENTO.indexOf(a.item as typeof DOCUMENTOS_FINANCIAMENTO[number]) - DOCUMENTOS_FINANCIAMENTO.indexOf(b.item as typeof DOCUMENTOS_FINANCIAMENTO[number]));
}
