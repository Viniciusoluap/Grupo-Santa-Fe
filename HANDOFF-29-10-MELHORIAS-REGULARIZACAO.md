# Handoff — Melhorias de Regularização — 29/10/2026

## Requisitos de produto
- Ordenar indicadores: valor contratado, valor já recebido e a receber.
- Calcular a receber pela diferença entre contratado e recebido, reutilizando as regras de cálculo existentes.
- Mostrar a quantidade total dos processos correspondentes ao filtro atual.
- Paginar a lista filtrada em grupos de quatro, com navegação anterior/próximo e indicação da página.
- Ajustar paginação ao mudar filtros ou excluir registros, preservando a visualização dos detalhes.
- Adicionar preenchimento de valores previstos por tabela padrão independente, com edição posterior, sem duplicar itens ou alterar recebimentos.
- Confirmar a substituição de valores previstos existentes.
- Preservar permissões, precisão monetária e responsividade.

## Plano de implementação
Reutilizar componentes e regras existentes; implementar os requisitos, revisar o diff e executar as verificações adequadas. Manter equivalência de comportamento entre os sistemas e preservar suas identidades visuais.

## Validações
(a) Automáticas: whitespace do checkpoint verificado; testes funcionais pendentes.
(b) Manuais: aceite visual e de navegação pendente.
(c) Publicação: pendente de implementação e validação.

## Próximo passo
Concluir implementação e revisão, executar testes, registrar resultados e preparar entrega pelos procedimentos do projeto.
