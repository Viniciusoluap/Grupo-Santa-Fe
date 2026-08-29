# Plataforma Grupo Santa Fé

Aplicação web do Grupo Santa Fé para o site institucional, catálogo de imóveis,
CRM, financiamentos, obras, regularização, incorporação, avaliações e operações
administrativas. O projeto usa o App Router do Next.js e concentra a interface
pública, o portal de clientes, o painel administrativo e as APIs no mesmo serviço.

## Tecnologias principais

- Next.js 16 e React 19;
- TypeScript e Tailwind CSS 4;
- Prisma 7 com PostgreSQL e o adaptador `@prisma/adapter-pg`;
- NextAuth para autenticação;
- Vitest para testes unitários;
- ESLint com as regras recomendadas do Next.js;
- integrações opcionais com Anthropic, Evolution API, OpenTopography e Pluggy.

## Pré-requisitos

- Node.js 20.9 ou mais recente, requisito da versão instalada do Next.js;
- npm;
- uma instância PostgreSQL acessível para executar a aplicação e as migrações.

## Instalação

Na raiz do repositório:

```bash
cd web
npm ci
```

O arquivo `package-lock.json` deve permanecer sincronizado com o `package.json`.

## Variáveis de ambiente

Crie um arquivo `.env.local` dentro de `web/`. Arquivos `.env*` são ignorados pelo
Git e não devem conter credenciais versionadas.

### Banco de dados

A aplicação precisa de uma URL PostgreSQL. O runtime usa a primeira variável
disponível nesta ordem:

- `DATABASE_URL`;
- `POSTGRES_PRISMA_URL`;
- `POSTGRES_URL`.

As migrações precisam preferencialmente de uma conexão direta, selecionada nesta
ordem:

- `DIRECT_URL`;
- `POSTGRES_URL_NON_POOLING`;
- `DATABASE_URL` como fallback.

### Integrações opcionais

| Variável | Uso |
| --- | --- |
| `ANTHROPIC_API_KEY` | Sugestões de avaliação, prospecção e recursos de IA da incorporação. |
| `INCORPORACAO_IA_ATIVA` | Habilita as rotas de IA da incorporação quando definida como `1`. |
| `PROSPECCAO_CIDADE` | Sobrescreve a cidade padrão usada na prospecção. |
| `OPENTOPOGRAPHY_API_KEY` | Consulta de elevação no OpenTopography. |
| `PLUGGY_CLIENT_ID` | Identificador da integração bancária Pluggy. |
| `PLUGGY_CLIENT_SECRET` | Segredo da integração bancária Pluggy. |
| `EVOLUTION_API_URL` | Endereço-base da Evolution API. |
| `EVOLUTION_API_KEY` | Chave da Evolution API. |
| `WHATSAPP_WEBHOOK_SECRET` | Segredo usado para validar a assinatura do webhook do WhatsApp. |
| `NEXT_PUBLIC_SITE_URL` | URL pública usada na geração dos feeds de imóveis. |

Não é necessário configurar as integrações que não serão usadas no
ambiente local.

## Banco de dados e Prisma

Gere o Prisma Client depois de instalar as dependências ou alterar o schema:

```bash
npx prisma generate
```

Durante o desenvolvimento, crie e aplique uma migração com:

```bash
npm run db:migrate
```

Para aplicar migrações já versionadas em um ambiente de deploy:

```bash
npm run db:deploy
```

O comando a seguir abre o Prisma Studio usando a configuração do projeto:

```bash
npm run db:studio
```

O script de seed existente usa o adaptador SQLite e grava dados de demonstração em
`prisma/dev.db`; ele é separado do PostgreSQL usado pelo runtime:

```bash
npm run db:seed
```

## Execução local

Com o banco configurado, inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação fica disponível por padrão em <http://localhost:3000>.

## Qualidade e validação

```bash
# Suíte de testes
npm test

# Análise estática
npm run lint

# Verificação de tipos sem emissão de arquivos
npx tsc --noEmit

# Geração do Prisma Client e build de produção
npm run build
```

## Estrutura principal

- `src/app`: rotas do App Router, páginas, layouts, Server Actions e Route Handlers;
- `src/components`: componentes reutilizáveis da interface;
- `src/lib`: regras de negócio, acesso a dados, integrações, tipos e testes;
- `prisma`: schema, migrações, seed e bancos locais de demonstração;
- `docs`: decisões de arquitetura e histórias de implementação.

## Build e deploy

O repositório possui `vercel.json` configurado para o framework Next.js. O comando
de build executa `prisma generate` antes de `next build`:

```bash
npm run build
```

O artefato também pode ser executado como servidor Node.js com os scripts existentes:

```bash
npm run start
```

As URLs do PostgreSQL e as variáveis das integrações utilizadas precisam estar
disponíveis no ambiente de build ou de execução correspondente.
