# BPO Composição do VGV

## Concluído

- Os cartões de Relatórios se reorganizam em larguras menores e permitem quebra de valores longos dentro do cartão.
- Números de Obra mostra o VGV total simulado separado da pizza. Financiamento, subsídio, entrada e FGTS são as quatro parcelas da mesma base de obras. A entrada é o saldo do VGV após as outras três parcelas, calculado em centavos.
- Obras com parcelas ausentes ou inconsistentes permanecem no VGV total e têm valor e quantidade separados. A pizza usa as obras cuja composição pode ser conferida.

## Validação e próximos passos

- (a) Os testes verificam conciliação em centavos, parcelas explicitamente zeradas e exclusão da pizza de obras incompletas ou com composição inconsistente. TypeScript passou.
- (b) O layout foi revisado no código. A conferência em navegador passou na Prospecta com o mesmo tratamento do indicador. A verificação visual autenticada do Santa Fé fica pendente.
- (c) Verificar o build do PR e abrir BPO > Relatórios com o período do print. Conferir os cartões no tablet e comparar as quatro parcelas com o VGV representado na pizza. Confirmar o valor separado das obras ainda sem composição antes de publicar em produção.

Santa Fé: 17 testes direcionados passaram. O teste de integração com banco foi ignorado por falta de banco de teste configurado no runner.

## Publicação em produção

- PR #250 incorporado à main no commit `442edf23d2ad045156d55979b42d18f2132a4d7e`. Deploy Vercel `dpl_5eZRuqSQ5qwe8hT3ywHTC5wnoawi` pronto e associado ao domínio oficial. Deploy anterior para referência de rollback `dpl_Euf4aadnGRmikpZXPGs85YzdDifN`.
- (a) Preview e build de produção concluíram. A página de login do domínio oficial respondeu HTTP 200.
- (b) A verificação visual com dados simulados foi feita na Prospecta.
- (c) Próximo passo de aceite: abrir BPO > Relatórios com sessão autenticada e conferir os cartões e a composição do VGV com os dados reais do período.
