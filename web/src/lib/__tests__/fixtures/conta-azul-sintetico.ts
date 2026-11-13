// Paridade BPO (13/11): CSVs SINTÉTICOS no formato do backup do Conta Azul Pro (mesmos casos da Prospecta;
// nenhum dado real de cliente no repositório).
export const PESSOAS = [
  "tipo,nome,endereco,tipo_pessoa,fone_comercial,fone_celular,cep,cidade,email,cpf_cnpj,inscricao_estadual,bairro,complemento,numero,isento_icms,razao_social,id_empresa,fl_ativo",
  'Cliente,Maria Teste,"Rua A, 10",F,,99999990000,65900-000,Canaa dos Carajas,maria@exemplo.com,11122233344,,,,,,,1,true',
  "Cliente,Construtora Exemplo,,J,9933330000,,,,,11222333000144,,,,,,Construtora Exemplo LTDA,1,true",
  "Fornecedor,Depósito Exemplo,,J,,,,,,55666777000188,,,,,,,1,true",
  "Vendedor,Vendedor Exemplo,,F,,,,,,,,,,,,,1,true",
].join("\n");

export const CAB_FIN = "id,data,data_de_quitacao,valor,tipo,descricao,status,nome_do_negociador,id_do_evento,data_de_vencimento,data_de_competencia,data_de_pagamento_esperada,id_da_parcela,metodo_de_pagamento,conta_financeira,data_solicitacao_cobranca,categoria,centro_de_custo";
export const FINANCEIRO = [
  CAB_FIN,
  // receita paga
  "aaaaaaaa-0000-0000-0000-000000000001,2026-03-05,2026-03-05,1500.00,REVENUE,\"Honorários março, parcela 1\",ACQUITTED,Maria Teste,e1,2026-03-05,2026-03-01,2026-03-05,p1,INSTANT_PAYMENT,C6 - Conta Corrente,,Receitas de Serviços,Santa Fe Canaa",
  // despesa em aberto de fornecedor
  "aaaaaaaa-0000-0000-0000-000000000002,2026-04-10,,320.50,EXPENSE,Cimento e areia,PENDING,Depósito Exemplo,e2,2026-04-10,2026-04-01,2026-04-10,,,Inter - Conta Corrente,,Materiais de Construção,",
  // mesma linha repetida em dois centros de custo, mesmo valor: entra uma vez
  "aaaaaaaa-0000-0000-0000-000000000003,2026-04-15,2026-04-15,709.00,EXPENSE,Contador,ACQUITTED,,e3,2026-04-15,2026-04-01,2026-04-15,p3,OTHER,C6 - Conta Corrente,,Honorários Contábeis,Santa Fe Canaa",
  "aaaaaaaa-0000-0000-0000-000000000003,2026-04-15,2026-04-15,709.00,EXPENSE,Contador,ACQUITTED,,e3,2026-04-15,2026-04-01,2026-04-15,p3,OTHER,C6 - Conta Corrente,,Honorários Contábeis,Santa Fe Parauapebas",
  // mesmo id com outra categoria e outro valor: é outra parte do lançamento (entra)
  "aaaaaaaa-0000-0000-0000-000000000003,2026-04-15,2026-04-15,90.00,EXPENSE,Contador,ACQUITTED,,e3,2026-04-15,2026-04-01,2026-04-15,p3,OTHER,C6 - Conta Corrente,,Tarifa de Cobrança,",
  // transferência entre empresas do grupo: fora do resultado
  "aaaaaaaa-0000-0000-0000-000000000004,2026-04-20,2026-04-20,5000.00,EXPENSE,Repasse,ACQUITTED,,e4,2026-04-20,2026-04-01,2026-04-20,p4,BANKING_TRANSFER,C6 - Conta Corrente,,(-) Transferência Entre Empresas do Grupo - Grupo,",
  // linha inválida
  "aaaaaaaa-0000-0000-0000-000000000005,2026-04-21,,abc,EXPENSE,Ruim,PENDING,,e5,2026-04-21,2026-04-01,2026-04-21,,,,,Aluguel,",
].join("\r\n");

export const BACKUP = { "pessoas.csv": PESSOAS, "financeiro.csv": FINANCEIRO, "produtos.csv": "nome,codigo\nCasa,1\n" };
