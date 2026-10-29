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

## Implementação
Indicadores, contagem filtrada, paginação e preenchimento padrão implementados. Valores previstos continuam editáveis; operação preserva recebimentos e evita duplicações. Integração Asaas inclui manutenção administrativa autenticada e validação dos eventos recebidos.

## AIOX
Definições versionadas consultadas e trabalho separado entre desenvolvimento, QA e DevOps. Recursos centrais referenciados pelas definições (core-config, gotchas e technical-preferences) não estavam disponíveis no checkout; sua execução não é afirmada. CodeRabbit CLI indisponível; revisão independente realizada pelos agentes.

## Validações
(a) Automáticas: git diff --check aprovado; revisão independente QA aprovada. Santa Fé: 19 testes de regularização e 25 testes da integração aprovados; TypeScript e ESLint dos arquivos alterados aprovados.
(b) Manuais: aceite visual autenticado e de navegação ainda pendente.
(c) Publicação: PR e build de publicação ainda em preparação.

## Próximo passo
Confirmar checks do PR e builds; efetuar merge autorizado, acompanhar publicação e validar navegação autenticada. Registrar limitações reais sem declarar aceite visual integral antecipadamente.
