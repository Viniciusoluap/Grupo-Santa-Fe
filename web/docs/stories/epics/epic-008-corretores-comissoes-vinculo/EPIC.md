# EPIC-008: Corretores & Comissões — vínculos reais

**Owner:** Claude (AIOX)
**Status:** InReview (PR aberto — aguardando merge por outra sessão)
**Paridade:** mesma regra de negócio implementada em paralelo no Prospecta.

## Diagnóstico no Grupo Santa Fé

O módulo de Comissões do Santa Fé (`src/app/admin/comissoes/*`, `src/lib/actions/comissoes.ts`,
model `Comissao`) **já estava mais avançado** que o do Prospecta (ver também EPIC-005):
o campo Corretor já listava corretores reais, o "Imóvel/negócio" já era um seletor de registros
pré-cadastrados na **criação** e "Comissão por Obra" já vinculava uma obra cadastrada. As lacunas
reais eram: edição voltava a ser texto livre, valor 100% manual, e "Especialidades" no cadastro de
corretor. Nenhum módulo novo foi criado.

## Stories

| Story | Escopo | Status |
|---|---|---|
| [S-01](S-01-cadastro-corretor-campos.md) | Corretor: remover "URL HTTPS da foto" e "Especialidades" | InReview |
| [S-02](S-02-comissoes-corretores-reais.md) | Comissões: corretores reais | InReview (já atendia) |
| [S-03](S-03-comissoes-seletor-imovel.md) | Comissões: "Imóvel/negócio" por seletor | InReview |
| [S-04](S-04-comissoes-valor-auto.md) | Comissões: valor = percentual × valor do negócio | InReview |
| [S-05](S-05-comissoes-obra.md) | Comissões: "Construção" → "Obra" vinculada | InReview |

## Decisão de modelagem

Sem migration: `Comissao.imovel` continua guardando o rótulo do negócio (formato histórico
`"<título> [<tipo>]"`) e o formulário reencontra o registro pelo rótulo na edição
(`encontrarNegocio`). Adicionar FKs (`imovelId`/`obraId`) foi avaliado e adiado para não exigir
mais uma migration em produção nesta entrega — registrar como melhoria se o dono quiser
relatórios por imóvel.
