// Pedido de 25/10: regra pura de quais dados do lead preenchem cada variável do template.
// O Santa Fé guarda os serviços já com o nome legível ("Financiamento MCMV") em Lead.servico (JSON).
// O lead do Santa Fé não tem endereço próprio: usa o do imóvel (financiamento/interesse) ou o da obra.
import { listaPorExtenso, primeiroNome } from "./variaveis";

export interface LeadParaTemplate {
  nome: string;
  servicos: string[];
  corretor: string | null;
  imovelFinanciamento: string | null;
  imovelInteresse: string | null;
  banco: string | null;
  enderecoImovel: { rua: string | null; bairro: string | null } | null;
  enderecoObra: string | null;
}

export function montarValoresLead(l: LeadParaTemplate, remetente: string | null): Record<string, string> {
  const enderecoImovel = l.enderecoImovel ? [l.enderecoImovel.rua, l.enderecoImovel.bairro].map((x) => x?.trim()).filter(Boolean).join(", ") : "";
  return {
    nome: primeiroNome(l.nome),
    servico: listaPorExtenso(l.servicos),
    corretor: l.corretor ?? remetente ?? "",
    imovel: l.imovelFinanciamento ?? l.imovelInteresse ?? "",
    banco: l.banco ?? "",
    endereco: enderecoImovel || l.enderecoObra || "",
  };
}
