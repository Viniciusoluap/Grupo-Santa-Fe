// Paridade 17/11 (porte de Prospecta/server/pci-s09.test.ts, EPIC-024 S-09; ids de usuário em texto no Santa Fé).
// EPIC-024 S-09: CPF do engenheiro, "Dados automáticos" com fonte e escolhas, modelos de preenchimento (regras puras).
// Inclui os cenários do portão de QA (pessoa nunca misturada) e a varredura de todas as combinações de escolhas.
import { describe, expect, it } from "vitest";
import {
  CAMPOS_COPIAVEIS_MODELO_PCI,
  CAMPOS_PCI,
  CAMPO_POR_ID,
  PESSOAS_PCI,
  aplicarEngenheiroPci,
  aplicarEscolhasPci,
  camposTrocadosPorEngenheiroPci,
  compararPreenchimentoPci,
  confirmarMesmaPessoaPci,
  conferirProcedenciaPci,
  achadosPessoaisNoTextoPci,
  avisosEmpresaNoModeloPci,
  dadosPessoaisNoModeloPci,
  mascararMeioPci,
  dadosPessoaisNoTextoPci,
  definirCampoPci,
  errosPci,
  extrairModeloPreenchimentoPci,
  faltasPerfilEngenheiroPci,
  formularioPciVazio,
  marcaPessoaPci,
  mesmaPessoaPci,
  misturaPessoaPci,
  normalizarFormularioPci,
  preencherPciAutomatico,
  registrarConfirmacoesPci,
  sugestoesAutomaticasPci,
  sugestoesDoModeloPci,
  type FontesPreenchimentoPci,
  type FormularioPci,
  type PessoaPci,
} from "@/lib/pci-gerador";

const RAFAEL = { nome: "Rafael Claudino", email: "rafael@x.y", telefone: "(99) 99111-2222", crea: "1122334455", creaUf: "MA", cpf: "529.982.247-25" };
const ANA = { nome: "Eng. Ana", email: "ana@x.y", telefone: "(86) 3222-1111", crea: "998877", creaUf: "PI", cpf: "111.444.777-35" };
const obra = { titulo: "Obra Y", endereco: "Rua A, 1", cidade: "Imperatriz", uf: "MA", area: 70, valorImovel: 200000, valorTerreno: 50000, valorFinanciado: 150000, inicio: "2026-01-10", termino: "2026-07-05" };
const obraVazia = { titulo: "x", endereco: null, cidade: null, uf: null, area: null, valorImovel: null, valorTerreno: null, valorFinanciado: null, inicio: null, termino: null };
const fontes = (extra: Partial<FontesPreenchimentoPci> = {}): FontesPreenchimentoPci => ({
  obra, cliente: { nome: "Cliente Um", cpf: "123.456.789-09", email: "um@x.y", telefone: "(99) 98888-7777", endereco: null, bairro: "Centro" },
  coordenadas: { lat: -5.5, lng: -47.5 }, pci: null, ...extra,
});
const pciCom = (campos: Record<string, unknown>) => normalizarFormularioPci({ campos });

/** Toda pessoa preenchida tem UMA procedência (o pedido central do portão de QA). */
function semMistura(f: FormularioPci) {
  for (const p of ["proponente", "rtp", "rte"] as PessoaPci[]) {
    const origens = new Set(PESSOAS_PCI[p].chaves.filter((k) => {
      const v = k.endsWith("EngenheiroId") ? f[k as "rtpEngenheiroId"] : f.campos[k];
      return v !== null && v !== undefined && v !== "";
    }).map((k) => f.procedencia?.[k] ?? "(sem procedência)"));
    expect(origens.size, `${p}: ${Array.from(origens).join(" / ")}`).toBeLessThanOrEqual(1);
  }
}

describe("A — CPF do engenheiro no RTP e no RTE", () => {
  it("preenche nome, CPF, e-mail, telefone, CREA e UF; o mesmo profissional pode ser RTP e RTE", () => {
    let f = aplicarEngenheiroPci(formularioPciVazio(), "rtp", "7", RAFAEL);
    f = aplicarEngenheiroPci(f, "rte", "7", RAFAEL);
    for (const p of ["rtp", "rte"]) {
      expect(f.campos).toMatchObject({ [`${p}Nome`]: "Rafael Claudino", [`${p}Cpf`]: "529.982.247-25", [`${p}Email`]: "rafael@x.y", [`${p}Registro`]: "1122334455", [`${p}Uf`]: "MA", [`${p}Ddd`]: 99, [`${p}Telefone`]: "991112222" });
    }
    expect([f.rtpEngenheiroId, f.rteEngenheiroId]).toEqual(["7", "7"]);
    semMistura(f);
    expect(misturaPessoaPci(f)).toEqual([]);
  });
  it("profissionais diferentes; trocar de engenheiro nunca herda o CPF do anterior", () => {
    let f = aplicarEngenheiroPci(formularioPciVazio(), "rtp", "7", RAFAEL);
    f = aplicarEngenheiroPci(f, "rte", "8", ANA);
    expect([f.campos.rtpCpf, f.campos.rteCpf]).toEqual(["529.982.247-25", "111.444.777-35"]);
    f = aplicarEngenheiroPci(f, "rtp", "9", { ...ANA, nome: "Sem CPF", cpf: null, crea: null, creaUf: null });
    expect(f.campos).toMatchObject({ rtpNome: "Sem CPF", rtpCpf: null, rtpRegistro: null, rtpUf: null });
    semMistura(f);
  });
  it("lista o que a escolha trocaria (para confirmar) e o que falta no perfil", () => {
    const f = normalizarFormularioPci({ campos: { rtpNome: "Fulano", rtpCpf: "529.982.247-25" } });
    expect(camposTrocadosPorEngenheiroPci(f, "rtp", RAFAEL)).toEqual(["Nome do RTP"]);
    expect(camposTrocadosPorEngenheiroPci(formularioPciVazio(), "rtp", RAFAEL)).toEqual([]);
    expect(faltasPerfilEngenheiroPci({ ...RAFAEL, cpf: null, telefone: null })).toEqual(["CPF", "telefone"]);
  });
  it("perfil desativado: o motivo diz que está desativado (não 'sem CPF')", () => {
    const { ausencias } = sugestoesAutomaticasPci(fontes({ rtp: { id: "9", dados: { nome: "Eng. Desativado", email: "d@x", telefone: null, crea: null, creaUf: null, cpf: null, perfilAtivo: false, temPerfil: true }, fonte: "Escolhido", escolhido: true } }));
    expect(ausencias.find((a) => a.chave === "rtpCpf")?.motivo).toMatch(/está desativado/);
  });
});

describe("pessoa nunca misturada (portão de QA)", () => {
  it("QA 1 — PCI vinculada com proponente MARIA sem CPF e CRM com JOSE + CPF: nada é misturado, a pessoa vai para escolha", () => {
    const f = fontes({ obra: obraVazia, pci: pciCom({ proponenteNome: "MARIA ANTIGA (PCI)" }), cliente: { nome: "JOSE NOVO (CRM)", cpf: "529.982.247-25", email: "jose@x.com", telefone: "(41) 99999-0000", endereco: null, bairro: null } });
    const aberto = preencherPciAutomatico(f);
    expect([aberto.campos.proponenteNome, aberto.campos.proponenteCpf, aberto.campos.proponenteEmail]).toEqual([null, null, null]);
    const r = compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes);
    expect(r.preenchidos.filter((p) => p.chave.startsWith("proponente"))).toEqual([]);
    const e = r.pessoas.find((p) => p.pessoa === "proponente")!;
    expect(e.opcoes.map((o) => o.valores.proponenteNome)).toEqual(["MARIA ANTIGA (PCI)", "JOSE NOVO (CRM)"]);
    // A opção da MARIA não leva o CPF do JOSE.
    expect(e.opcoes[0].valores.proponenteCpf).toBeUndefined();
    const escolhida = aplicarEscolhasPci(r.formulario, { pessoas: { proponente: e.opcoes[0] } });
    expect(escolhida.campos).toMatchObject({ proponenteNome: "MARIA ANTIGA (PCI)", proponenteCpf: null, proponenteEmail: null });
  });
  it("portão 2, M1 — só o nome igual NÃO junta quando acrescentaria o CPF: escolha com as opções e a junção rotulada", () => {
    const f = fontes({ obra: obraVazia, pci: pciCom({ proponenteNome: "José Novo" }), cliente: { nome: "JOSE  NOVO", cpf: "529.982.247-25", email: null, telefone: null, endereco: null, bairro: null } });
    const aberto = preencherPciAutomatico(f);
    expect(aberto.campos).toMatchObject({ proponenteNome: null, proponenteCpf: null });
    const r = compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes);
    const e = r.pessoas.find((p) => p.pessoa === "proponente")!;
    expect(e.motivo).toMatch(/só o nome não prova que é a mesma pessoa/);
    expect(e.opcoes.map((o) => o.fonte)).toEqual(["PCI vinculada à obra", "Cliente do CRM", "PCI vinculada à obra + Cliente do CRM (nome igual nas duas fontes; confira se é a mesma pessoa)"]);
    // Escolher a junção rotulada vale como confirmação (o servidor grava quem e quando).
    const junto = aplicarEscolhasPci(r.formulario, { pessoas: { proponente: e.opcoes[2] } });
    expect(junto.campos).toMatchObject({ proponenteNome: "José Novo", proponenteCpf: "529.982.247-25" });
    expect(misturaPessoaPci(junto)).toEqual([]);
    expect(junto.confirmacoes?.proponente).toMatchObject({ por: null, marca: marcaPessoaPci(junto, "proponente") });
  });
  it("portão 2, M1 — homônimo com e-mail e telefone diferentes: nada junta, os dois valores ficam nas opções", () => {
    const pci = pciCom({ proponenteNome: "JOSE DA SILVA", proponenteEmail: "a@pci.com", proponenteDdd: 41, proponenteTelefone: "999990000" });
    const f = fontes({ obra: obraVazia, pci, cliente: { nome: "José da Silva", cpf: "529.982.247-25", email: "b@crm.com", telefone: "(11) 98888-7777", endereco: null, bairro: null } });
    const r = compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes);
    expect(r.formulario.campos).toMatchObject({ proponenteNome: null, proponenteCpf: null, proponenteEmail: null, proponenteTelefone: null });
    const e = r.pessoas.find((p) => p.pessoa === "proponente")!;
    expect(e.motivo).toMatch(/Os outros dados são diferentes \(E-mail.*Telefone/);
    expect(e.opcoes).toHaveLength(2); // sem junção: há valor diferente
    const json = JSON.stringify(e.opcoes);
    for (const v of ["a@pci.com", "b@crm.com", "999990000", "988887777", "529.982.247-25"]) expect(json).toContain(v);
    expect(e.opcoes.find((o) => o.origem === "pci")!.valores).not.toHaveProperty("proponenteCpf");
  });
  it("portão 2, M1 — nome digitado igual ao do CRM: o CPF do CRM não entra calado", () => {
    const tela = definirCampoPci(formularioPciVazio(), "proponenteNome", "JOSÉ DA SILVA");
    const f = fontes({ obra: obraVazia, pci: null, cliente: { nome: "JOSÉ DA SILVA", cpf: "529.982.247-25", email: "outro@x.com", telefone: null, endereco: null, bairro: null } });
    const r = compararPreenchimentoPci(tela, sugestoesAutomaticasPci(f).sugestoes);
    expect(r.formulario.campos).toMatchObject({ proponenteNome: "JOSÉ DA SILVA", proponenteCpf: null, proponenteEmail: null });
    expect(r.formulario.procedencia).toEqual({ proponenteNome: "manual" });
    const e = r.pessoas[0];
    expect(e.opcoes.map((o) => o.fonte)).toEqual(["Cliente do CRM", "o que está na tela + Cliente do CRM (nome igual nas duas fontes; confira se é a mesma pessoa)"]);
  });
  it("portão 2, M1 — nome igual e nenhum CPF nos dois lados, sem divergência: completa (nada a misturar)", () => {
    const tela = definirCampoPci(formularioPciVazio(), "proponenteNome", "Maria Souza");
    const f = fontes({ obra: obraVazia, pci: null, cliente: { nome: "MARIA SOUZA", cpf: null, email: "m@x.com", telefone: null, endereco: null, bairro: null } });
    const r = compararPreenchimentoPci(tela, sugestoesAutomaticasPci(f).sugestoes);
    expect(r.pessoas).toEqual([]);
    expect(r.formulario.campos.proponenteEmail).toBe("m@x.com");
  });
  it("portão 2 — mesma pessoa pelo CPF com e-mail diferente: o e-mail que não entrou vira aviso", () => {
    const f = fontes({ obra: obraVazia, pci: pciCom({ proponenteNome: "Ana", proponenteCpf: "529.982.247-25", proponenteEmail: "a@pci.com" }), cliente: { nome: "Ana", cpf: "52998224725", email: "b@crm.com", telefone: null, endereco: null, bairro: null } });
    const r = compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes);
    expect(r.formulario.campos.proponenteEmail).toBe("a@pci.com");
    expect(r.avisos.join(" ")).toMatch(/Cliente do CRM" traz e-mail diferente \(b@crm.com\)/);
  });
  it("QA 2 — tela com rtpNome digitado e fonte só com CPF: nada entra em silêncio; a pessoa inteira vai para escolha", () => {
    const form = definirCampoPci(formularioPciVazio(), "rtpNome", "JOAO DIGITADO");
    const r = compararPreenchimentoPci(form, sugestoesAutomaticasPci(fontes({ obra: obraVazia, cliente: null, pci: pciCom({ rtpCpf: "111.444.777-35" }) })).sugestoes);
    expect(r.formulario.campos).toMatchObject({ rtpNome: "JOAO DIGITADO", rtpCpf: null });
    expect(r.pessoas.map((p) => p.pessoa)).toEqual(["rtp"]);
    expect(r.conflitos).toEqual([]);
  });
  it("QA 3 — engenheiro escolhido sem CPF e PCI com outro RT: duas opções, nenhuma mistura", () => {
    const f = fontes({ obra: obraVazia, cliente: null, pci: pciCom({ rtpNome: "OUTRO RT", rtpCpf: "111.444.777-35" }), rtp: { id: "7", fonte: "Engenheiro escolhido nesta obra", escolhido: true, dados: { ...RAFAEL, cpf: null } } });
    const r = compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes);
    expect([r.formulario.campos.rtpNome, r.formulario.campos.rtpCpf]).toEqual([null, null]);
    const e = r.pessoas.find((p) => p.pessoa === "rtp")!;
    expect(e.opcoes.map((o) => [o.valores.rtpNome, o.valores.rtpCpf ?? null])).toEqual([["Rafael Claudino", null], ["OUTRO RT", "111.444.777-35"]]);
  });
  it("tela com a MESMA pessoa (mesmo CPF) e dado faltando: completa; dado diferente vira escolha da pessoa inteira", () => {
    let form = definirCampoPci(formularioPciVazio(), "proponenteNome", "Cliente Um");
    form = definirCampoPci(form, "proponenteCpf", "123.456.789-09");
    const r = compararPreenchimentoPci(form, sugestoesAutomaticasPci(fontes()).sugestoes);
    expect(r.formulario.campos).toMatchObject({ proponenteEmail: "um@x.y", proponenteDdd: 99 });
    semMistura(r.formulario);
    const outro = definirCampoPci(form, "proponenteEmail", "outro@x.y");
    const r2 = compararPreenchimentoPci(outro, sugestoesAutomaticasPci(fontes()).sugestoes);
    expect(r2.pessoas[0]).toMatchObject({ pessoa: "proponente", motivo: expect.stringMatching(/Mesma pessoa \(CPF igual\), com dados diferentes em: E-mail/) });
    expect(r2.formulario.campos.proponenteDdd).toBeNull();
  });
  it("prova de mesma pessoa: CPF decide antes do nome; sem prova → diferente", () => {
    expect(mesmaPessoaPci("proponente", { proponenteNome: "A", proponenteCpf: "529.982.247-25" }, { proponenteNome: "A", proponenteCpf: "111.444.777-35" })).toBe(false);
    expect(mesmaPessoaPci("proponente", { proponenteCpf: "52998224725" }, { proponenteCpf: "529.982.247-25" })).toBe(true);
    expect(mesmaPessoaPci("proponente", { proponenteNome: "João" }, { proponenteCpf: "529.982.247-25" })).toBe(false);
    expect(mesmaPessoaPci("rtp", { rtpEngenheiroId: "7", rtpCpf: "1" }, { rtpEngenheiroId: "8", rtpCpf: "1" })).toBe(false);
  });
  it("nenhuma combinação de escolhas da tela deixa pessoa misturada", () => {
    // Tela com proponente e RTP digitados; fontes com 2 candidatos de proponente, 2 de RTP, 1 de RTE e campos técnicos diferentes.
    let base = definirCampoPci(formularioPciVazio(), "proponenteNome", "Digitado");
    base = definirCampoPci(base, "rtpCpf", "000.000.001-91");
    base = definirCampoPci(base, "endereco", "Rua Digitada");
    const f = fontes({ pci: pciCom({ proponenteNome: "MARIA (PCI)", rtpNome: "RT DA PCI", rtpCpf: "111.444.777-35", rteNome: "RTE DA PCI" }), rtp: { id: "7", dados: RAFAEL, fonte: "Escolhido", escolhido: true } });
    const r = compararPreenchimentoPci(base, sugestoesAutomaticasPci(f).sugestoes);
    semMistura(r.formulario);
    expect(r.pessoas.map((p) => p.pessoa).sort()).toEqual(["proponente", "rtp"]);
    // Conflitos de campo para tentar "aceitar" também campos de pessoa (devem ser ignorados).
    const conflitosForjados = [...r.conflitos, { chave: "proponenteCpf", valor: "529.982.247-25" }, { chave: "rtpNome", valor: "INTRUSO" }];
    const opcoesDe = (p: PessoaPci) => [null, ...(r.pessoas.find((e) => e.pessoa === p)?.opcoes ?? [])];
    const subconjuntos = Array.from({ length: 1 << conflitosForjados.length }, (_, m) => conflitosForjados.filter((_, i) => m & (1 << i)));
    let casos = 0;
    for (const sub of subconjuntos) for (const op of opcoesDe("proponente")) for (const rt of opcoesDe("rtp")) {
      const final = aplicarEscolhasPci(r.formulario, { conflitos: sub, pessoas: { proponente: op, rtp: rt } });
      semMistura(final);
      expect(final.campos.rtpNome).not.toBe("INTRUSO");
      expect(misturaPessoaPci(final)).toEqual([]);
      casos++;
    }
    expect(casos).toBeGreaterThan(20);
  });
  it("guarda da geração: nome e CPF de fontes diferentes bloqueiam; 'confirmo' libera", () => {
    let f = aplicarEngenheiroPci(formularioPciVazio(), "rtp", "7", RAFAEL);
    f = definirCampoPci(f, "rtpNome", "Outro Nome Digitado");
    expect(misturaPessoaPci(f).map((m) => m.pessoa)).toEqual(["rtp"]);
    expect(errosPci(f, { paraGerar: true }).join(" ")).toMatch(/nome e o CPF vieram de fontes diferentes/);
    expect(errosPci(f, { paraGerar: false }).join(" ")).not.toMatch(/fontes diferentes/);
    const ok = confirmarMesmaPessoaPci(f, "rtp");
    expect(misturaPessoaPci(ok)).toEqual([]);
    // A procedência viaja no rascunho (normalizar mantém).
    expect(misturaPessoaPci(normalizarFormularioPci(JSON.parse(JSON.stringify(f)))).length).toBe(1);
  });
});

describe("portão 2 — rascunho antigo, procedência conferida no servidor e registro da confirmação", () => {
  it("M2 — rascunho salvo antes da conferência (sem procedência) com nome e CPF: pede a confirmação uma vez, e diz por quê", () => {
    const antigo = normalizarFormularioPci(JSON.parse(JSON.stringify({ campos: { proponenteNome: "FULANO", proponenteCpf: "529.982.247-25", rtpNome: "ENG", rtpCpf: "111.444.777-35", rteNome: "SÓ NOME" } })));
    const m = misturaPessoaPci(antigo);
    expect(m.map((x) => [x.pessoa, x.motivo])).toEqual([["proponente", "legado"], ["rtp", "legado"]]);
    expect(m[0].mensagem).toMatch(/rascunho anterior à conferência de origem/);
    expect(errosPci(antigo, { paraGerar: true }).join(" ")).toMatch(/rascunho anterior à conferência de origem/);
    expect(errosPci(antigo, { paraGerar: false }).join(" ")).not.toMatch(/conferência de origem/); // salvar continua livre
    let ok = confirmarMesmaPessoaPci(antigo, "proponente", new Date("2026-11-16T10:00:00Z"));
    expect(misturaPessoaPci(ok).map((x) => x.pessoa)).toEqual(["rtp"]);
    ok = confirmarMesmaPessoaPci(ok, "rtp");
    // Uma vez: a confirmação viaja no rascunho.
    expect(misturaPessoaPci(normalizarFormularioPci(JSON.parse(JSON.stringify(ok))))).toEqual([]);
    // Nome antigo + CPF digitado agora também pede confirmação (antes passava).
    const digitado = definirCampoPci(normalizarFormularioPci({ campos: { proponenteNome: "FULANO" } }), "proponenteCpf", "52998224725");
    expect(misturaPessoaPci(digitado).map((x) => x.motivo)).toEqual(["legado"]);
  });
  it("L3 — procedência do navegador é conferida: origem que não bate com a fonte (ou desconhecida) vira manual", () => {
    const f = fontes({ rtp: { id: "7", fonte: "Engenheiro escolhido nesta obra", escolhido: true, dados: RAFAEL } });
    const { sugestoes } = sugestoesAutomaticasPci(f);
    const legitimo = compararPreenchimentoPci(formularioPciVazio(), sugestoes).formulario;
    expect(conferirProcedenciaPci(legitimo, sugestoes).rebaixadas).toEqual([]);
    // Navegador diz "crm" no nome digitado e "engenheiro:7" num CPF que não é o do Rafael.
    const forjado = normalizarFormularioPci({
      campos: { proponenteNome: "OUTRA PESSOA", proponenteCpf: "123.456.789-09", rtpNome: "Rafael Claudino", rtpCpf: "111.444.777-35" },
      procedencia: { proponenteNome: "crm", proponenteCpf: "crm", rtpNome: "engenheiro:7", rtpCpf: "engenheiro:7" },
    });
    expect(misturaPessoaPci(forjado)).toEqual([]); // o navegador sozinho enganaria a guarda
    const conferido = conferirProcedenciaPci(forjado, sugestoes);
    expect(conferido.rebaixadas.sort()).toEqual(["proponenteNome", "rtpCpf"]);
    expect(misturaPessoaPci(conferido.formulario).map((x) => x.pessoa)).toEqual(["proponente", "rtp"]);
    // Origem inventada ou de outro engenheiro → manual; "manual" e a confirmação ficam.
    const outros = normalizarFormularioPci({ campos: { rtpNome: "Rafael Claudino", proponenteNome: "X", rteNome: "Y" }, procedencia: { rtpNome: "engenheiro:8", proponenteNome: "inventada", rteNome: "manual:confirmado" } });
    expect(conferirProcedenciaPci(outros, sugestoes).formulario.procedencia).toEqual({ rtpNome: "manual", proponenteNome: "manual", rteNome: "manual:confirmado" });
  });
  it("L4 — a confirmação registra quem e quando (servidor); a mesma confirmação não é registrada de novo; mudar o CPF desfaz", () => {
    const base = normalizarFormularioPci({ campos: { proponenteNome: "FULANO", proponenteCpf: "529.982.247-25" } });
    const conf = normalizarFormularioPci(JSON.parse(JSON.stringify(confirmarMesmaPessoaPci(base, "proponente"))));
    expect(conf.confirmacoes?.proponente).toMatchObject({ por: null, marca: marcaPessoaPci(conf, "proponente") });
    const agora = new Date("2026-11-16T12:00:00Z");
    const r1 = registrarConfirmacoesPci(conf, null, "u20", agora);
    expect(r1.novas).toEqual(["proponente"]);
    expect(r1.formulario.confirmacoes).toEqual({ proponente: { por: "u20", em: "2026-11-16T12:00:00.000Z", marca: marcaPessoaPci(conf, "proponente") } });
    // Navegador forja "por": o servidor não aceita sem registro anterior igual.
    const forjado = { ...conf, confirmacoes: { proponente: { por: "u1", em: "2020-01-01T00:00:00.000Z", marca: marcaPessoaPci(conf, "proponente") } } };
    expect(registrarConfirmacoesPci(forjado, null, "u20", agora).formulario.confirmacoes?.proponente?.por).toBe("u20");
    const r2 = registrarConfirmacoesPci(conf, r1.formulario, "u23", new Date("2026-11-17T00:00:00Z"));
    expect([r2.novas, r2.formulario.confirmacoes?.proponente?.por]).toEqual([[], "u20"]);
    const mudou = definirCampoPci(r1.formulario, "proponenteCpf", "111.444.777-35");
    expect(misturaPessoaPci(mudou)).toHaveLength(1);
    expect(registrarConfirmacoesPci(mudou, r1.formulario, "u20", agora).formulario.confirmacoes).toBeUndefined();
  });
});

describe("B — Dados automáticos: fonte, conflito e o que faltou", () => {
  it("campo técnico/imóvel: só completa o vazio; o diferente vira conflito por campo; o igual é informado", () => {
    const { sugestoes, ausencias } = sugestoesAutomaticasPci(fontes());
    const atual = normalizarFormularioPci({ campos: { municipio: "Imperatriz", endereco: "Rua Digitada, 9" } });
    const r = compararPreenchimentoPci(atual, sugestoes, ausencias);
    expect(r.formulario.campos.endereco).toBe("Rua Digitada, 9");
    expect(r.conflitos).toEqual([expect.objectContaining({ chave: "endereco", atual: "Rua Digitada, 9", sugerido: "Rua A, 1", fonte: "Cadastro da obra" })]);
    expect(r.iguais.map((i) => i.chave)).toContain("municipio");
    expect(r.preenchidos).toContainEqual(expect.objectContaining({ chave: "proponenteCpf", valor: "123.456.789-09", fonte: "Cliente do CRM" }));
    expect(r.naoEncontrados).toContainEqual(expect.objectContaining({ chave: "rtpCpf", motivo: expect.stringMatching(/Nenhum engenheiro escolhido para o RTP/) }));
    expect(aplicarEscolhasPci(r.formulario, { conflitos: r.conflitos }).campos.endereco).toBe("Rua A, 1");
  });
  it("clicar de novo não muda nada e diz que está tudo igual", () => {
    const { sugestoes } = sugestoesAutomaticasPci(fontes());
    const r = compararPreenchimentoPci(preencherPciAutomatico(fontes()), sugestoes);
    expect([r.preenchidos, r.conflitos, r.pessoas]).toEqual([[], [], []]);
    expect(r.iguais.length).toBeGreaterThan(5);
  });
  it("engenheiro da obra com CPF no RTP e no RTE (uma fonte cada)", () => {
    const f = preencherPciAutomatico(fontes({ rtp: { id: "7", dados: RAFAEL, fonte: "Escolhido nesta obra", escolhido: true }, rte: { id: "8", dados: ANA, fonte: "Última PCI gerada", escolhido: true } }));
    expect(f.campos).toMatchObject({ rtpNome: "Rafael Claudino", rtpCpf: "529.982.247-25", rteNome: "Eng. Ana", rteCpf: "111.444.777-35" });
    expect([f.rtpEngenheiroId, f.rteEngenheiroId]).toEqual(["7", "8"]);
    semMistura(f);
  });
  it("sem cliente, sem localização e sem PCI legível: diz o motivo", () => {
    const { ausencias } = sugestoesAutomaticasPci(fontes({ cliente: null, coordenadas: null, motivos: { cliente: "A obra não tem cliente do CRM vinculado.", pci: "A PCI vinculada não pôde ser lida (arquivo inválido)." } }));
    expect(ausencias).toContainEqual(expect.objectContaining({ chave: "proponenteCpf", motivo: "A obra não tem cliente do CRM vinculado." }));
    expect(ausencias).toContainEqual(expect.objectContaining({ chave: "latitude", motivo: "A obra não tem localização no mapa." }));
    expect(ausencias.find((a) => a.chave === "custos")?.motivo).toMatch(/não pôde ser lida/);
  });
});

describe("C — modelos de preenchimento (lista de permissão)", () => {
  it("a lista de permissão só tem campos técnicos existentes", () => {
    for (const id of CAMPOS_COPIAVEIS_MODELO_PCI) expect(CAMPO_POR_ID.get(id)?.copiavel, id).toBe(true);
    const pessoais = ["proponente", "rtp", "rte", "imovel", "matricula", "documentacao", "localizacao"];
    expect(CAMPOS_PCI.filter((c) => c.copiavel && pessoais.includes(c.secao))).toEqual([]);
    for (const id of ["valorTerreno", "valorImovel", "valorFinanciado", "areaTerreno", "areaPermeavel", "esgoto", "abastecimentoAgua", "drenagem", "preExecutado", "observacoes", "localData", "obrasPreExistentes"])
      expect(CAMPO_POR_ID.get(id)?.copiavel, id).toBeFalsy();
  });
  it("extrair tira dados pessoais — também de JSON adulterado e de lista com texto livre", () => {
    const origem = normalizarFormularioPci({
      campos: { proponenteNome: "Cliente Um", proponenteCpf: "123.456.789-09", rtpCpf: "529.982.247-25", endereco: "Rua A, 1", bairro: "Centro", matricula: "4321", latitude: `05° 30' 00" S`, valorTerreno: 50000, areaCoberta: 70, divisaoInterna: "2 quartos, sala, cozinha", bdi: 18 },
      custos: [1000, 2000], cronograma: [10, 100], rtpEngenheiroId: "7", imagem: { tipo: "png", base64: "AAAA" },
    });
    const m = extrairModeloPreenchimentoPci(origem);
    const json = JSON.stringify(m);
    for (const proibido of ["Cliente Um", "123.456.789-09", "529.982.247-25", "Rua A", "Centro", "4321", "05°", "50000", "AAAA", "EngenheiroId", "imagem", "procedencia"]) expect(json).not.toContain(proibido);
    expect(m.campos).toEqual({ areaCoberta: 70, divisaoInterna: "2 quartos, sala, cozinha", bdi: 18 });
    // Lista (executor) com texto livre fora das opções oficiais não entra.
    expect(extrairModeloPreenchimentoPci({ campos: { proponenteCpf: "123", areaCoberta: 70, executor: "José da Silva", bdi: { cpf: "x" } }, segredo: "x" }).campos).toEqual({ areaCoberta: 70 });
  });
  it("detecta CPF, CNPJ, e-mail e telefone em texto livre (com e sem pontuação; dígitos conferidos)", () => {
    expect(dadosPessoaisNoTextoPci("Cliente José da Silva CPF 529.982.247-25 mora na Rua X 10")).toEqual(["CPF"]);
    expect(dadosPessoaisNoTextoPci("cpf 52998224725")).toEqual(["CPF"]);
    expect(dadosPessoaisNoTextoPci("CNPJ 11.222.333/0001-81 e 11222333000181")).toEqual(["CNPJ"]);
    expect(dadosPessoaisNoTextoPci("fale com jose@x.com.br")).toEqual(["e-mail"]);
    expect(dadosPessoaisNoTextoPci("ligar (99) 98888-7777")).toEqual(["telefone"]);
    // Texto técnico comum não é dado pessoal.
    expect(dadosPessoaisNoTextoPci("Alvenaria de blocos 14x19x39, NBR 15575, 2 quartos, prazo 6 meses, R$ 3.940,68, 123.456.789-00")).toEqual([]);
  });
  it("modelo com dado pessoal em texto livre, nome ou observação: lista os campos (o servidor recusa)", () => {
    const dados = extrairModeloPreenchimentoPci({ campos: { justificativaPrazoTexto: "Cliente CPF 529.982.247-25", outrosEspecificar: "ok" }, adicionais: [{ descricao: "Muro, falar com a@b.com", valor: 10 }] });
    expect(dadosPessoaisNoModeloPci({ nome: "Casa do 52998224725", observacao: "tel (99) 98888-7777", dados })).toEqual([
      { campo: "Nome do modelo", tipos: ["CPF"], trechos: ["Casa do 529••••••25"] }, { campo: "Observação do modelo", tipos: ["telefone"], trechos: ["tel (99) 9••••-••77"] },
      { campo: "Justificativa técnica do prazo", tipos: ["CPF"], trechos: ["Cliente CPF 529.•••.•••-25"] }, { campo: "Serviço adicional 1", tipos: ["e-mail"], trechos: ["…falar com a@•.••m"] },
    ]);
  });
  it("portão 2, L5 — detector: pega CPF com espaços/traços, celular separado, telefone com contexto e e-mail com (arroba)", () => {
    const casos: [string, string[]][] = [
      ["CPF: 529 982 247 25", ["CPF"]], ["CPF 529 982 247-25", ["CPF"]], ["cpf 529-982-247-25", ["CPF"]], ["CPF529.982.247-25", ["CPF"]],
      ["41 9 9999 0000", ["telefone"]], ["fone 9999-0000", ["telefone"]], ["(41)99999-0000", ["telefone"]], ["whats: 41 99999-0000", ["telefone"]],
      ["+55 41 999990000", ["telefone"]], ["41 3333 4444", ["telefone"]],
      ["Email: joao.silva(arroba)gmail.com", ["e-mail"]], ["joao [at] x.com", ["e-mail"]], ["joao@x.com.br", ["e-mail"]],
    ];
    for (const [t, tipos] of casos) expect(dadosPessoaisNoTextoPci(t), t).toEqual(tipos);
  });
  it("portão 2, L5 — número técnico corrido não é telefone; CPF com espaços só depois de \"CPF\"; CNPJ só avisa", () => {
    for (const t of ["Lote 4123456789", "ART 41987654321", "Concreto 2025-11-16 lote 4123456789", "41999990000", "CEP 80010-000", "Norma NBR 15575-2013 item 11.2",
      "série 2024 0001 0002", "R$ 52.998.224,72", "Dimensões 3000x4000x2800 mm", "processo 5299822472-5", "123 456 789 09", "Bloco 14x19x39 cm, 12.500 unidades, R$ 32.500,00"]) {
      expect(dadosPessoaisNoTextoPci(t), t).toEqual([]);
    }
    expect(achadosPessoaisNoTextoPci("Fornecedor CNPJ 11.222.333/0001-81")).toEqual([{ tipo: "CNPJ", trecho: "…CNPJ 11.2••.•••/••••-81", bloqueia: false }]);
    const dados = extrairModeloPreenchimentoPci({ campos: { justificativaPrazoTexto: "Esquadrias ACME CNPJ 11.222.333/0001-81" } });
    expect(dadosPessoaisNoModeloPci({ nome: "Casa", dados })).toEqual([]);
    expect(avisosEmpresaNoModeloPci({ nome: "Casa", dados })).toEqual([expect.stringMatching(/^Justificativa técnica do prazo: CNPJ ".*-81" ficou no modelo \(dado de empresa/)]);
  });
  it("portão 2, L5 — o trecho mascarado localiza o dado num memorial longo sem mostrá-lo inteiro", () => {
    const memorial = `${"Fundação em sapata corrida, alvenaria de bloco cerâmico. ".repeat(20)}Dúvidas: falar com Fulano no whats 41 99999-0000. ${"Cobertura em telha cerâmica. ".repeat(10)}`;
    const [a] = achadosPessoaisNoTextoPci(memorial);
    expect(a).toEqual({ tipo: "telefone", trecho: "…no whats 41 9••••-••00", bloqueia: true });
    expect(a.trecho).not.toContain("99999-0000");
    expect(mascararMeioPci("529.982.247-25")).toBe("529.•••.•••-25");
  });
  it("aplicar em outra obra: técnico entra, pessoal da obra fica, diferente pede confirmação", () => {
    const outra = normalizarFormularioPci({ campos: { proponenteNome: "Cliente Dois", proponenteCpf: "987.654.321-00", endereco: "Rua Dois", bdi: 10 } });
    const modelo = extrairModeloPreenchimentoPci({ campos: { proponenteNome: "Cliente Um", areaCoberta: 70, bdi: 18 }, custos: [1000] });
    const r = compararPreenchimentoPci(outra, sugestoesDoModeloPci(modelo, 'Modelo "Casa 70" v1'));
    expect(r.formulario.campos).toMatchObject({ proponenteNome: "Cliente Dois", proponenteCpf: "987.654.321-00", endereco: "Rua Dois", areaCoberta: 70, bdi: 10 });
    expect(r.formulario.custos[0]).toBe(1000);
    expect(r.conflitos).toEqual([expect.objectContaining({ chave: "bdi", atual: "10", sugerido: "18" })]);
    expect(r.pessoas).toEqual([]);
  });
});
