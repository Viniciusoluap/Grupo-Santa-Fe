# Session 5 Architecture — Assinatura Gov.br Guiada

**Date:** 2026-07-02  
**Architect:** @architect (Aria)  
**Status:** APPROVED

---

## ADR-10: Fluxo guiado via Assinador gov.br (não API ITI)

**Contexto:** A API de Assinatura Eletrônica Avançada do ITI (`assinatura-api.iti.gov.br`) exige:
- Solicitação de credenciais por um **Gestor Público** via Serviço de Integração gov.br
- Produção restrita a **domínios governamentais** (.gov.br, .mil.br, .jus.br etc.)
- Integração prévia com Login Único

Fonte: manual oficial `manual-integracao-assinatura-eletronica.servicos.gov.br`.

**Conclusão:** Uma empresa privada (Grupo Santa Fé) **não é elegível** para credenciais da API. 

**Decisão:** Implementar fluxo guiado usando o **Assinador gov.br público** (`assinador.iti.br`) — gratuito para qualquer cidadão com conta prata/ouro, mesma validade jurídica (Decreto 10.543/2020):

1. Admin gera o PDF do contrato e clica **"Solicitar gov.br"** → `assinaturaStatus = "solicitado"`
2. Cliente vê no Portal (`/portal/documentos`) um card guiado com 3 passos:
   - Baixar o PDF do contrato
   - Assinar no site oficial `assinador.iti.br` (link direto)
   - Enviar de volta o PDF assinado
3. Upload do cliente cria `ContratoDocumento` (tipo "assinado") e marca `assinaturaStatus = "assinado"`
4. Autenticidade verificável em `validar.iti.gov.br`

**Alternativas rejeitadas:**
- API ITI direta: inviável (elegibilidade)
- Plataformas comerciais (Clicksign, D4Sign, ZapSign): custo mensal + lock-in; podem ser adotadas depois sem retrabalho (o fluxo de upload permanece o mesmo)

## ADR-11: Segurança do upload pelo cliente

Server Action `enviarContratoAssinadoPortal` (em `src/lib/actions/portal.ts`):
- Exige sessão autenticada com `leadId` vinculado
- Valida que `contrato.leadId === session.user.leadId` (isolamento por lead)
- Valida MIME `application/pdf` e tamanho ≤ 10MB
- Actions do jurídico (`gerarPdfContrato`, `uploadContratoAssinado`, `marcarAssinaturaStatus`) agora exigem papel staff (`admin|corretor|colaborador`) — cliente não consegue invocá-las diretamente
