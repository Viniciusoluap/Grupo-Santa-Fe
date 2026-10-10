# S-09 — Fecha a pendência do Blob público em documentos de avaliação

## Contexto

A pendência registrada na S-05 ficava aberta: os documentos de avaliação são enviados ao
Vercel Blob com `access: "public"`, e a URL pública gerada era exibida diretamente na tela
(`<a href={doc.url}>`). Uma vez que alguém obtivesse essa URL — por exemplo inspecionando o
HTML da página ou vendo o link renderizado — o arquivo ficava acessível sem nenhuma sessão,
independente da correção de RBAC já aplicada (que só controla quem acessa a *tela*, não quem
acessa a URL direta do arquivo).

As duas correções avaliadas anteriormente (Blob Store privado via painel da Vercel; migração
para armazenamento no banco) foram descartadas: a primeira exige um passo manual em painel
externo; a segunda esbarra no limite de ~4,5 MB do corpo de requisição de uma função serverless
da Vercel, incompatível com o fluxo atual de upload direto-para-Blob (até 50 MB/5 arquivos).

## Solução aplicada (sem nenhum passo manual)

Em vez de mudar o armazenamento, a correção fecha o vazamento no ponto de *leitura*:

- Nova rota autenticada `GET /api/avaliacoes/[id]/documentos/[docId]`
  (`src/app/api/avaliacoes/[id]/documentos/[docId]/route.ts`): verifica sessão + papel admin
  (mesmo padrão já usado em `/api/avaliacoes/documentos`), busca a avaliação no banco, localiza
  o documento pelo `docId` dentro do JSON armazenado, e então busca o conteúdo do arquivo
  **a partir do servidor** usando a URL real do Blob — que nunca é enviada ao navegador. A
  resposta é devolvida via streaming (`upstream.body` repassado direto como corpo da
  `NextResponse`), para não precisar bufferizar o arquivo inteiro em memória antes de responder.
- `documentos-avaliacao.tsx`: o link exibido na tela trocou de `doc.url` (a URL pública do
  Blob) para `/api/avaliacoes/${avaliacaoId}/documentos/${doc.id}` (a nova rota autenticada).

O upload continua exatamente como era (direto do navegador pro Blob, contornando o limite de
corpo de requisição da função serverless) — só a exibição/leitura passou a ser mediada pelo
servidor. A URL pública do Blob continua salva no banco (precisa continuar lá, é o que o
servidor usa para buscar o conteúdo), mas deixa de ser exposta a qualquer cliente.

## O que isso resolve e o que não resolve

- **Resolve:** a URL do arquivo não aparece mais em nenhuma resposta HTML/JSON enviada ao
  navegador — fecha o caminho de vazamento que existia até aqui.
- **Não resolve:** a URL do Blob em si continua tecnicamente pública (qualquer um que já tenha
  uma URL antiga, salva de antes desta correção, ainda consegue acessá-la diretamente, já que o
  Vercel Blob não tem um mecanismo de revogação de URLs antigas sem recriar o blob). Isso só
  afeta URLs que já tenham sido expostas antes desta correção — a partir daqui, nenhuma URL nova
  é exposta ao cliente.

## Gates executados

- `npx tsc --noEmit` → limpo.
- `npx vitest run` → 299/299 testes passando (32 arquivos), zero regressão.
- `npx eslint .` → 39 problemas (17 erros, 22 avisos), idêntico ao baseline pré-existente.

## Status

Correção implementada e testada localmente. O limite de tamanho de resposta em streaming só
pode ser validado de fato com um arquivo grande em produção real (não há credencial de Blob
real neste ambiente) — isso fica registrado como validação pendente pós-deploy, não como motivo
para não mergear.
