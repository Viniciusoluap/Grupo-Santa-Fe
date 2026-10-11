# S-09 — (EPIC 3 / story 3.1) Layout quebrado ao "Voltar" na Central Administrativa

**Status:** Não reproduzível no Grupo Santa Fé · **Paridade:** Prospecta story 3.1

## Investigação

- "Central Administrativa" é uma tela **só do Prospecta** (`client/src/pages/admin/AdminAcesso.tsx`,
  tema escuro `#1A2332`). No Santa Fé a home do admin é o "Quadro de serviços"
  (`src/app/admin/page.tsx`) dentro do `AdminShell`, tema claro.
- O "Voltar" do Santa Fé é `src/components/ui/back-button.tsx` (`router.back()`), ou `<Link>`
  para a listagem do módulo — nenhum dos dois mexe em estilo global.
- Procurei manipulação global de DOM/tema que pudesse "vazar" entre telas
  (`document.body/documentElement` `.style/.classList/.className`): só existe em
  `components/layout/navbar.tsx` (site público), com limpeza no unmount.

## Conclusão

Sem tela equivalente e sem mecanismo que produza o sintoma descrito, nenhuma correção foi aplicada
aqui (Art. IV — No Invention). A causa raiz deve ser tratada no Prospecta; se o sintoma aparecer
no Santa Fé, reabrir com o caminho exato de navegação.
