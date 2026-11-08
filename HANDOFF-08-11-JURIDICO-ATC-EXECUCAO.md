# Jurídico Construção ATC e Execução de Obra

## Concluído

- Formulário de novos contratos com dois modelos e o mesmo fluxo ao entrar pelo Jurídico ou pelo CRM. A obra selecionada fornece os vínculos de cliente e imóvel. A Parte A vem preenchida e é editável no formulário.
- Construção ATC usa o VGV simulado do cliente. Separa o preço do lote e o valor da construção. O preço vem sugerido do custo do terreno da obra e deve ser confirmado como preço negociado. O terrenista de terceiro é qualificado e assina a promessa de compra e venda, com data limite da aquisição.
- Execução de Obra usa o Orçamento Previsto e vincula o empreiteiro escolhido como Parte B. O cliente é identificado como proprietário.
- O corretor fica vinculado ao contrato e assina como interveniente. A cláusula usa o percentual da obra ou o padrão do corretor e o valor calculado sobre o VGV. A empresa repassa após a medição aprovada e o recebimento efetivo da CAIXA. O contrato de execução referencia a mesma intermediação, sem duplicar o pagamento.
- A data estipulada da assinatura tem coluna própria. Descrição, cláusulas e lista de assinaturas são gravadas com o contrato. A equipe gera o PDF e anexa a cópia com todas as assinaturas. Os contratos anteriores conservam o fluxo legado.

## Verificação

- (a) TypeScript e testes direcionados de vínculo, cálculo, montagem de cláusulas e PDF. O SQL aditivo foi executado duas vezes em PostgreSQL local (PGlite), com um registro legado, nova data e exclusão de usuários vinculados. A data de vencimento antiga foi preservada.
- (b) Inspeção local dos PDFs gerados com dados de teste, incluindo paginação, comissão, datas e linhas para os signatários.
- (c) Pendente em ambiente integrado: criação pela tela com obra real, conferência dos dados societários e anexo do PDF completo. A validação das assinaturas do PDF anexado é feita pela equipe.

## Próximo passo

Revisar o PR isolado e o texto contratual antes do uso comercial. Aplicar a migração aditiva primeiro em banco de teste, validar os dois fluxos pelo Jurídico e pelo CRM e conferir a base atual dos trabalhos paralelos antes do merge e do deploy.

O schema fica em `web/prisma/schema.prisma` e a migração em `web/prisma/migrations/20261108110000_juridico_modelos_atc_execucao/migration.sql`. Segue a convenção do repositório de aplicar o SQL versionado no PostgreSQL. O formulário usa razão social, CNPJ válido e endereço das Configurações da empresa. A suíte completa passou com 1.109 testes e 156 ignorados antes da checagem final de validação cadastral.

## Preparação da publicação autorizada em 08/11

- O primeiro preview do PR #249 falhou porque o Turbopack não resolveu imports internos de TypeScript com extensão .js. Os quatro imports de contratos foram alinhados ao padrão do Next.js deste repositório.
- (a) Os quatro testes dos modelos passaram após a correção. A migração no banco de teste Neon dedicado do Santa Fé criou as cinco colunas e três chaves estrangeiras esperadas.
- (b) Na configuração societária de produção, confirmei que há entradas preenchidas para razão social, CNPJ e endereço.
- (c) Pendentes nesta etapa: confirmação do novo build, migração de produção, merge, confirmação do deploy associado ao merge e validação autenticada com uma obra real.

## Produção confirmada em 08/11/2026

- PR #249 integrado à main no commit `e641b9bb174d81e9d484adf682f9772744ffe6c9`. Deploy de produção Vercel `dpl_Euf4aadnGRmikpZXPGs85YzdDifN` READY. Deploy anterior para referência de rollback `dpl_3bpKenzeM8uVr8pPtXrQdh4J1e5K`.
- Migração aditiva confirmada em produção com cinco colunas e três chaves estrangeiras. Nenhum contrato real foi criado durante a publicação.
- (a) TypeScript e 13 testes direcionados passaram. O preview corrigido e o build de produção concluíram. O login no domínio oficial respondeu HTTP 200. A rota de PDF recusou acesso sem sessão com HTTP 403.
- (b) Consultei o cadastro de produção e conferi razão social, endereço e dígitos verificadores do CNPJ. As duas obras têm cliente vinculado, porém nenhuma tem imóvel vinculado.
- (c) Pendente emissão autenticada de um contrato real pelo Jurídico ou CRM. No Santa Fé, vincular o imóvel correto à obra antes de emitir. O fluxo existente em Editar obra permite informar a Localização exata e criar o vínculo. Na validação, gerar o PDF e conferir as partes, comissão, data e anexação do PDF assinado.
