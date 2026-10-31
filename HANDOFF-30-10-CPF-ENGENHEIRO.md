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

## Etapa 2 — implementação e checks
- ADAPT: campo opcional “CPF do engenheiro” na terceira coluna da linha Cidade/UF, com label associado, teclado numérico, máscara `000.000.000-00` e limite de 14 caracteres. O mesmo formulário salva e recarrega o valor.
- ADAPT: validação de CPF somente quando informado, usando dígitos verificadores e rejeitando sequências repetidas; valor vazio explícito limpa para null, campo omitido preserva o CPF previamente gravado.
- REUSE: helper CPF existente da Prospecta, copiado sem alterações para o Santa Fé, que não tinha utilitário equivalente.
- ADAPT: leitura/gravação no perfil profissional, sem alterar identificação do usuário ou copiar dados do CRM; CPF não foi acrescentado às opções/listagens de engenheiros. Permissões administrativas e de leitura própria preservadas.
- CREATE: migração aditiva idempotente, coluna nullable VARCHAR(14), sem backfill; não foi executada migração genérica de todo o projeto.
- AIOX: definições dev disponíveis lidas. Núcleo de tarefas, gotchas e CodeRabbit CLI indisponíveis; revisão direta e checks reais aplicados, sem alegar execução de recursos ausentes.

### Verificações
(a) Automáticos: TypeScript aprovado nos dois sistemas. Prospecta: testes de perfil e CPF 18/18; Santa Fé: perfil 9/9. Prisma Client regenerado localmente, sem tocar banco. `git diff --check` aprovado nos dois. ESLint dos arquivos lógicos e testes Santa Fé aprovado; componente tem um erro preexistente `react-hooks/set-state-in-effect` no carregamento inicial, reproduzido também no HEAD original. Verificação focada do componente sem essa única regra legada passou; não houve supressão em arquivo nem alteração desse fluxo fora de escopo.
(b) Manuais: revisão de acessibilidade, localização, paridade, autorização e comportamento de omissão/limpeza. Não preenchido CPF em cadastro real.
(c) Migrações: arquivo Prospecta testado duas vezes em branch Neon de testes pelo agente principal; arquivo Santa Fé testado duas vezes em Postgres PGlite isolado, confirmando coluna nullable de 14 caracteres e preservação de registro existente sem CPF. O agente principal aplicou e confirmou a coluna nullable de 14 caracteres em produção nas duas aplicações, sem backfill. Validação visual fica com o agente principal/release. Não foi executado teste de persistência com CPF em cadastro real.

### Arquivos principais
- `web/src/app/admin/configuracoes/_components/perfil-engenheiro.tsx`
- `web/src/lib/engenheiro.ts`, `engenheiros.ts`, `actions/engenheiro.ts`, `cpf.ts`, `__tests__/engenheiro.test.ts`
- `web/prisma/schema.prisma`, `web/prisma/migrations/20261030210000_engenheiro_cpf/migration.sql`

### Próximo passo
Com schema de produção aplicado e revisão QA independente sem bloqueantes, publicar PRs, verificar builds, realizar merge e validar campo em produção sem inserir CPF de teste em cadastro real.
