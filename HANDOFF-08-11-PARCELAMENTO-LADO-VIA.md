# Handoff — Trocar rua de lado no Estudo de Massa

## Concluído

- Em Rua Simples com traçado pela divisa, a caixa “Trocar rua de lado” gera os cenários na divisa oposta à do primeiro cenário automático.
- O motor recalcula o sistema viário, os lotes, as áreas, o aproveitamento e o VGV a partir da geometria. Quando não há cenário válido na divisa oposta, o formulário informa a inviabilidade.
- O estudo salvo guarda a escolha junto aos parâmetros e cenários. Estudos antigos assumem o lado automático.
- Rua Simples usa o mesmo motor geométrico da Prospecta. Grade e Cul-de-sac seguem pelo motor que já atendia essas tipologias.
## Validação

- (a) TypeScript e 46 testes de regressão de geração de cenários passaram.
- (b) O teste com poligonal sintética confirmou a mudança de lado e a coerência entre áreas e VGV.
- (c) Pendente a conferência no ambiente publicado após a integração.

## Próximo passo

Revisar o PR da branch `codex/parcelamento-trocar-lado-via-20261109` e conferir a caixa e o desenho após a publicação.
