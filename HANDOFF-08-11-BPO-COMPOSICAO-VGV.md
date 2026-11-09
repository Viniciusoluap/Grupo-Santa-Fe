# BPO Composição do VGV

## Concluído

- Os cartões de Relatórios se reorganizam em larguras menores e permitem quebra de valores longos dentro do cartão.
- Números de Obra mostra o VGV total simulado separado da pizza. Financiamento, subsídio, entrada e FGTS são as quatro parcelas da mesma base de obras. A entrada é o saldo do VGV após as outras três parcelas, calculado em centavos.
- Obras com parcelas ausentes ou inconsistentes permanecem no VGV total e têm valor e quantidade separados. A pizza usa as obras cuja composição pode ser conferida.

## Validação e próximos passos

- (a) Os testes verificam conciliação em centavos, parcelas explicitamente zeradas e exclusão da pizza de obras incompletas ou com composição inconsistente. TypeScript passou.
- (b) Inspeção do código de layout realizada. A validação visual local ficou pendente porque o Chromium não estava instalado e o pacote recebido pelo instalador era inválido.
- (c) Verificar o build do PR e abrir BPO > Relatórios com o período do print. Conferir os cartões no tablet e comparar as quatro parcelas com o VGV representado na pizza. Confirmar o valor separado das obras ainda sem composição antes de publicar em produção.

Santa Fé: 17 testes direcionados passaram. O teste de integração com banco foi ignorado por falta de banco de teste configurado no runner.
