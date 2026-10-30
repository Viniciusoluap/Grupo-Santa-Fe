# CPF no perfil do engenheiro — 30/10/2026

## Etapa 1 — auditoria e plano
- Branch `codex/cpf-engenheiro-20261030` baseada na main publicada mais recente; histórico anterior preservado.
- Pedido: campo CPF na terceira coluna da linha Cidade/UF dos dados do engenheiro, com máscara brasileira e salvamento/edição/recarga.
- Decisão: CPF opcional no perfil profissional em ambas as aplicações, separado da identificação geral de usuário/CRM; sem preenchimento ou cópia automática de dados pessoais.
- Migração aditiva nullable: coluna `cpf` VARCHAR(14) no perfil profissional. Aplicar antes da publicação do código; nenhum registro existente será preenchido, removido ou reclassificado.
- Reutilizar formulário, autorização administrativa e validador de perfil existentes. CPF informado deve conter 11 dígitos e verificadores válidos; vazio permanece null.
- Preservar leitura restrita ao administrador e ao próprio usuário, sem expor CPF em listas de seleção de engenheiros.

## Verificação
(a) Automáticos: auditoria de formulários, validação, leitura/gravação e schema concluída; implementação pendente.
(b) Manuais: não executados nesta etapa.
(c) Produção: migração e validação visual pendentes; não inserir CPF de teste em cadastros reais.

## Próximo passo
Publicar checkpoint inicial, implementar schema/migração, validação, persistência e campo; executar checks pertinentes e revisão independente; aplicar migração antes do deploy.
