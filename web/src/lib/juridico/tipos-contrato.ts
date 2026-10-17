/** Tipos de contrato do Jurídico (cadastro do Jurídico e contrato criado pelo lead). */
export const TIPOS_CONTRATO = [
  { value: "compra_venda",             label: "Compra e Venda" },
  { value: "locacao",                  label: "Locação" },
  { value: "permuta",                  label: "Permuta" },
  { value: "comodato",                 label: "Comodato" },
  { value: "assessoria_imobiliaria",   label: "Assessoria Imobiliária" },
  { value: "administracao_imovel",     label: "Administração de Imóvel" },
  { value: "avaliacao_imobiliaria",    label: "Avaliação Imobiliária" },
  { value: "regularizacao_imovel",     label: "Regularização de Imóvel" },
  { value: "financiamento_imobiliario",label: "Financiamento Imobiliário" },
  { value: "bpo_financeiro",           label: "BPO Financeiro" },
  { value: "prestacao_servicos",       label: "Prestação de Serviços" },
  { value: "consultoria_juridica",     label: "Consultoria Jurídica" },
  { value: "parceria",                 label: "Parceria" },
  { value: "outro",                    label: "Outro" },
];

export const ROTULO_TIPO_CONTRATO: Record<string, string> = Object.fromEntries(TIPOS_CONTRATO.map((t) => [t.value, t.label]));
