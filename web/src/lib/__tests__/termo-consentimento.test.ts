// Paridade 17/11 bloco 4 — texto definitivo do termo (gêmeo dos testes de texto de Prospecta/server/consentimento.test.ts).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTATOS, ENDERECO_DA_SEDE, NOME_DA_EMPRESA, SEDE } from "@/lib/empresa";
import { CANAL_DO_TITULAR, FRASE_CURTA_DO_TERMO, HISTORICO_DO_TERMO, ROTA_DO_TERMO, SECOES_DO_TERMO, TITULO_DO_TERMO, VERSAO_DO_TERMO } from "@/lib/termo-consentimento";

const todo = [TITULO_DO_TERMO, FRASE_CURTA_DO_TERMO, ...SECOES_DO_TERMO.flatMap(s => [s.titulo, ...s.paragrafos])].join("\n");
const secao = (n: string) => SECOES_DO_TERMO.find(s => s.titulo.startsWith(`${n}.`))!.paragrafos.join(" ");

describe("termo de consentimento — texto definitivo do Santa Fé", () => {
  it("sem marcador, texto provisório nem pendência", () => {
    expect(todo).not.toMatch(/\[|\]|PREENCHER|provisóri|jurídico|a definir|pendente/i);
  });
  it("dados da empresa iguais aos do rodapé do site; nome comercial (razão social e CNPJ não estão no repositório)", () => {
    const rodape = readFileSync("src/components/layout/footer.tsx", "utf8");
    expect(rodape).toContain("Rua B N° 40 — Ouro Preto");
    expect(rodape).toContain(`CEP ${SEDE.cep} · ${SEDE.cidade}-${SEDE.uf}`);
    expect(rodape).toContain(CONTATOS.email);
    expect(rodape).toContain(CONTATOS.telefoneEscritorio);
    expect(secao("1")).toContain(`Endereço: ${ENDERECO_DA_SEDE}.`);
    expect(secao("1")).toContain(NOME_DA_EMPRESA);
    expect(todo).not.toMatch(/CNPJ \d|LTDA|Prospecta/);
  });
  it("encarregado = canal de atendimento ao titular, com e-mail e telefone", () => {
    expect(secao("1")).toMatch(/Encarregado pelo tratamento de dados pessoais \(LGPD, art\. 41\)/);
    expect(secao("1")).toContain(CANAL_DO_TITULAR.email);
    expect(secao("1")).toContain(CANAL_DO_TITULAR.telefone);
  });
  it("guarda: enquanto durar a relação, prazos legais (5 anos fiscais, prescrição), depois eliminação ou anonimização", () => {
    expect(secao("6")).toMatch(/Enquanto você tiver conta ou relação/);
    expect(secao("6")).toMatch(/5 anos para documentos fiscais e contábeis/);
    expect(secao("6")).toMatch(/prescrição/);
    expect(secao("6")).toMatch(/elimina os dados ou os anonimiza/);
  });
  it("resposta em até 15 dias (art. 19, II); retirada pelo botão da página ou pelos contatos, registrada", () => {
    expect(secao("7")).toMatch(/declaração completa .* em até 15 dias .* \(LGPD, art\. 19, II\)/);
    expect(secao("7")).toMatch(/"Retirar consentimento" no fim desta página/);
    expect(secao("7")).toMatch(/A retirada fica registrada com a data, a hora e quem a registrou/);
    expect(secao("7")).toMatch(/volta a pedir o aceite/);
    expect(secao("7")).toMatch(/ANPD/);
  });
  it("IA: só o que existe no Santa Fé — Central de Vendas no WhatsApp (entra desligada) e análise de mercado sem dado pessoal", () => {
    const ia = secao("4");
    expect(ia).toMatch(/Atendimento inicial pelo WhatsApp/);
    expect(ia).toMatch(/ela vem desligada/);
    expect(ia).toMatch(/passa para alguém da equipe/);
    expect(ia).toMatch(/atualmente a Anthropic/);
    expect(ia).toMatch(/fora do Brasil/);
    expect(ia).toMatch(/Análise de mercado e de imóveis/);
    expect(ia).toMatch(/não envia nome, CPF, telefone nem e-mail/);
    expect(todo).not.toMatch(/maquete|Dolores|apoio à equipe|assistente de inteligência artificial para consultar/i);
    expect(FRASE_CURTA_DO_TERMO).toMatch(/WhatsApp/);
    expect(FRASE_CURTA_DO_TERMO).not.toMatch(/documentos/);
    expect(FRASE_CURTA_DO_TERMO.length).toBeLessThan(160);
  });
  it("versão, histórico e rota pública", () => {
    expect(VERSAO_DO_TERMO).toBe("2026-11-17.1");
    expect(HISTORICO_DO_TERMO[0].versao).toBe(VERSAO_DO_TERMO);
    expect(ROTA_DO_TERMO).toBe("/termo-de-consentimento");
    expect(readFileSync("src/app/(site)/termo-de-consentimento/page.tsx", "utf8")).toContain("TextoDoTermo");
  });
  it("as quatro áreas logadas montam o termo do login", () => {
    for (const area of ["admin", "portal", "corretor", "empreiteiro"]) {
      expect(readFileSync(`src/app/${area}/layout.tsx`, "utf8")).toContain("<ConsentimentoNoLogin usuarioId=");
    }
  });
});
