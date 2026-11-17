// Paridade 17/11 bloco 4 — dados da empresa que aparecem no termo de consentimento, iguais aos do rodapé do site
// (src/components/layout/footer.tsx) e da página Contato. Gêmeo de Prospecta/shared/empresa.ts.
// Razão social e CNPJ NÃO existem no repositório (só em Configurações › Dados da Empresa, no banco): o termo usa o nome
// comercial. Quando o dono informar, acrescentar aqui e subir a versão do termo.
export const NOME_DA_EMPRESA = "Grupo Santa Fé";

export const SEDE = { rua: "Rua B, Nº 40 - Ouro Preto", cidade: "Canaã dos Carajás", uf: "PA", cep: "68350-307" } as const;

/** "Rua B, Nº 40 - Ouro Preto, Canaã dos Carajás - PA, 68350-307" */
export const ENDERECO_DA_SEDE = `${SEDE.rua}, ${SEDE.cidade} - ${SEDE.uf}, ${SEDE.cep}`;

/** Contatos públicos do site (rodapé e Contato). */
export const CONTATOS = { email: "comercial@gruposantafee.com.br", telefoneEscritorio: "(94) 99304-4689", telefoneAdministrativo: "(94) 99188-8143" } as const;
