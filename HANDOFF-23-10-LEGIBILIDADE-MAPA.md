# HANDOFF 23/10 — Legibilidade (fundo escuro) + Mapa Operacional completo

Vale para **Prospecta** e **Grupo Santa Fé** (mesmo arquivo nos dois repositórios).
Branch de trabalho nos dois: `claude/sync-mirrored-repos-bsqnz3`.

## Pedido do dono (resumo fiel)

1. Nenhuma fonte escura em fundo escuro. Exemplos: bloco "Relatório fotográfico" da medição CAIXA
   (legenda, "No relatório executivo", Salvar/Excluir foto) e o título "Painel Administrativo" do /admin.
   Tudo no site precisa ficar legível.
2. O Mapa Operacional mostrava só 1 imóvel, mas o dono cadastrou a localização de 4 (os mesmos 4 das
   medições solicitadas hoje). Achar o motivo e corrigir.
3. Na tabela do mapa: valor = **VGV** da obra (já preenchido); coluna "Localização" passa a **"Endereço"**,
   repetindo o endereço do imóvel/obra; nome do imóvel e coordenadas continuam iguais.
4. Tudo orquestrado pelo AIOX e salvo em handoff.

## Diagnóstico (produção, somente leitura)

- O mapa lia **apenas a tabela de imóveis**. Só 1 obra tinha imóvel vinculado com coordenadas.
- As obras 21, 27 e 28 (e outras) têm a localização **na PCI da CAIXA** (`parsed.identificacao.latitude/longitude`,
  formato compacto tipo `52948 S` / `472641 W`), mas nunca viraram imóvel: o campo "Localização exata"
  exigia clicar em "Marcar" depois de colar — sem clicar, nada era salvo.
- Prospecta: 18 obras com coordenadas legíveis na PCI.
- Contraste (Prospecta): `AdminRoute` liga `html.area-escura` (fundo escuro), mas o tema continua claro,
  então todo texto sem cor explícita herdava `--foreground` (marrom escuro) → escuro sobre escuro.

## O que foi feito

### Regras de negócio (idênticas nos dois repositórios)
- `shared/obra-localizacao.ts` (Prospecta) = `web/src/lib/obra-localizacao.ts` (Santa Fé):
  - `coordenadaPciDecimal` — lê PCI compacta (`52948 S` → -5,4966667), DMS (`5°30'29.0" S`) e decimal;
    S/W/O negativos; minutos/segundos ≥ 60 ou zero → `null` (nunca inventa ponto).
  - `coordenadasDaPci(lat, lng)` e `enderecoCompleto([...])` (junta endereço/cidade/UF sem repetir palavra inteira).
- Mapa = imóveis (exceto vendidos/alugados) + obras sem imóvel vinculado cujo ponto vem da PCI.
  - Imóvel vinculado a obra: valor = VGV da obra → valor aprovado do lead → valor da simulação; endereço = endereço da obra.
  - Obra só com PCI: título "Obra — <nome>", status "Obra (PCI)", link para a obra.
  - Colunas: Imóvel | Endereço | Valor | Status | Coordenadas. Sem valor → "—"/"Valor não informado".
  - Filtro de status: "Todos" (antes aparecia "Não vinculado") + "Obra (localização da PCI)".
- Campo de localização (obra e imóvel) aplica sozinho ao colar coordenada/link válido; link curto é
  resolvido ao sair do campo. Não precisa mais clicar em "Marcar".
- Editar Obra › Informações: sem imóvel vinculado mas com PCI, mostra "Ponto lido da PCI da CAIXA: lat, lng
  (já aparece no Mapa Operacional)".
- Santa Fé: removida a tabela fixa `COORDS_BY_BAIRRO` que **inventava** coordenadas por bairro.

### Arquivos principais
Prospecta:
- `shared/obra-localizacao.ts`, `server/obra-localizacao.ts`, `server/operacional-router.ts` (mapaRouter.list)
- `client/src/pages/admin/AdminMapa.tsx`, `client/src/pages/admin/OperationalUI.tsx` (`Choice.emptyLabel`)
- `client/src/components/CampoLocalizacao.tsx`, `client/src/pages/AdminEditarObra.tsx`
- `server/mapa-operacional.test.ts` (novo, 4 testes)
- Contraste (@ux AIOX): `MedicaoCaixa.tsx`, `ProgressoObraAba.tsx`, `Admin.tsx`, `AdminObras.tsx` e varredura
  `text-gray-100`/`text-white` em ~55 telas escuras (admin, portais, páginas públicas, AdminRoute, ProtectedRoute).
Santa Fé:
- `web/src/lib/obra-localizacao.ts`, `web/src/lib/mapa-operacional.ts` (novo), `web/src/app/admin/mapa/page.tsx`,
  `web/src/app/admin/mapa/_components/mapa-client.tsx`
- `web/src/app/admin/imoveis/_components/localizacao-picker.tsx`, `web/src/components/obras/editar-obra-pagina.tsx`
- `web/src/lib/__tests__/mapa-operacional.db.test.ts` (novo, 2 testes)
- Contraste: `medicao-caixa.tsx` (bloco de fotos), `progresso-obra.tsx`

Sem migração de banco neste lote.

## Testes

(a) Automáticos
- Prospecta: `pnpm check` OK; `vitest` 131 arquivos / **966 testes passando**; `pnpm build` OK.
- Santa Fé: `tsc --noEmit` OK; eslint dos arquivos alterados 0 erros (1 aviso `<img>` pré-existente);
  `vitest` com banco local 806 passando / 10 falhas **pré-existentes** (Drive/migrations do ambiente local,
  mesmas de antes deste lote); `npm run build` OK (com `DATABASE_URL` do banco local).
- Novos: parser PCI (compacto/DMS/decimal/nulos), `enderecoCompleto`, mapa com imóvel + obra-PCI + VGV/endereço.
- Revisão @qa (AIOX): ver seção "QA" abaixo.
- Depois das correções do QA: Prospecta 968 testes passando, check e build OK; Santa Fé tsc OK,
  vitest 806 passando + as mesmas 10 falhas pré-existentes, teste do mapa 3/3, build OK.

(b) Manuais por mim
- Conferência em produção (somente leitura) das obras 18/21/27/28 e das 18 obras com PCI legível.
- Conferência de que os blocos `bg-white` restantes nas telas escuras só contêm QR Code (ComprarBilhete/ComprarUtef).

(c) Pendente de validação em produção (depois do deploy autorizado)
- Abrir /admin/mapa nos dois sites e conferir os 4 pontos (obras 18/21/27/28) com VGV e endereço.
- Abrir uma medição CAIXA › Relatório fotográfico e o /admin: todo texto legível.
- Colar coordenada no campo de localização e ver salvar sem clicar em "Marcar".

## QA (@qa AIOX) — veredito CONCERNS, sem achado alto; corrigido no 2º commit
- Médio: obra com imóvel vinculado **sem coordenadas** ou com imóvel **vendido/alugado** ficava fora do mapa
  → agora usa o ponto da PCI nos dois casos (Prospecta `operacional-router.ts`, Santa Fé `mapa-operacional.ts`).
- Médio: texto de ajuda do Editar Obra afirmava "aparece no mapa" sem ponto e divergia entre os repos
  → condições alinhadas; novo texto "O imóvel vinculado X ainda não tem ponto…".
- Segurança (Santa Fé): popup do mapa (`components/map/property-map.tsx`) montava HTML sem escapar → escapado.
- Baixos corrigidos: `enderecoCompleto` perdia bairro presente no nome da rua (agora só compara com o último
  trecho; produção tem "…, Imperatriz/MA" + cidade/UF); latitude/longitude trocadas viravam ponto no oceano
  (agora lat só N/S e lng só L/E/O/W); formato compacto/DMS sem hemisfério → null; aceita ′ ″;
  link curto resolvido 2× (blur + clique) → trava; `text-muted-foreground` no /admin → `text-gray-300/400`.
- Conferido em produção (leitura): as 18 PCIs (obras 13–36) continuam lidas com o parser novo.
- Débito aceito: carregar o JSON `parsed` inteiro das PCIs no mapa (volume atual pequeno, 18 PCIs).

## Pendências / próximo passo exato
1. Commit + push nos dois repositórios (branch acima) e PRs em rascunho.
2. **Merge e deploy só com autorização expressa do dono.** Sem migração.
3. Depois do deploy: executar a lista (c) acima.
4. Sugestões do @ux ainda não feitas: seções mistas em `ProjetosOrcamentos.tsx`/`Portal.tsx` (Prospecta) e
   `text-gray-400` sobre branco em filtros do Santa Fé (ex.: `corretores-client.tsx:155`).
