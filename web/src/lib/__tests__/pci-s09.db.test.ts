// Paridade 17/11, bloco 3 — porte de Prospecta/server/pci-s09-db.test.ts (EPIC-024 S-09) com o banco real
// (TEST_DATABASE_URL, com a migração 20261117300000 aplicada): CPF só de quem a lista oferece (e registrado),
// "Dados automáticos" com fonte e escolha de pessoa, modelos de preenchimento versionados, sem dados pessoais e com
// dono, permissões. Mesmos cenários; ids texto (cuid) e server actions no lugar do tRPC.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  aplicarEscolhasPci, compararPreenchimentoPci, confirmarMesmaPessoaPci, definirCampoPci, normalizarFormularioPci, sugestoesDoModeloPci, type FormularioPci,
} from "@/lib/pci-gerador";

vi.mock("server-only", () => ({}));
const sessao = vi.hoisted(() => ({ atual: null as null | { user: { id: string; role: string; permissoes?: string[]; ativo?: boolean } } }));
vi.mock("@/auth", () => ({ auth: async () => sessao.atual }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const MARCA = "TESTE-PCI-S09";
const CPF_RAFAEL = "529.982.247-25";
const CPF_ANA = "111.444.777-35";
const CPF_INATIVO = "222.333.444-05";
const CPF_CLIENTE_1 = "123.456.789-09";

type R<T> = T | { erro: string };
const ok = <T,>(r: R<T>): T => { if (r && typeof r === "object" && "erro" in r) throw new Error((r as { erro: string }).erro); return r as T; };

describe.skipIf(!url)("Gerador de PCI — paridade 17/11 (S-09, banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/pci-gerador");
  const u: Record<string, string> = {};
  const o: Record<string, string> = {};

  const como = (quem: string, role: string, permissoes?: string[]) => { sessao.atual = { user: { id: u[quem], role, ...(permissoes ? { permissoes } : {}) } }; };
  const comoAdmin = () => como("admin", "admin");
  const comoColabObras = () => como("colabObras", "colaborador", ["obras"]);
  const comoOutroColab = () => como("outroColab", "colaborador", ["obras"]);

  async function limpar() {
    await prisma.pciModeloPreenchimento.updateMany({ where: { nome: { startsWith: MARCA } }, data: { anteriorId: null } });
    await prisma.pciModeloPreenchimento.deleteMany({ where: { nome: { startsWith: MARCA } } });
    const obras = await prisma.obra.findMany({ where: { nome: { startsWith: MARCA } }, select: { id: true } });
    await prisma.obraPci.deleteMany({ where: { obraId: { in: obras.map((x) => x.id) } } });
    await prisma.obra.deleteMany({ where: { id: { in: obras.map((x) => x.id) } } });
    await prisma.projeto.deleteMany({ where: { nome: { startsWith: MARCA } } });
    const leads = await prisma.lead.findMany({ where: { nome: { startsWith: MARCA } }, select: { id: true } });
    await prisma.servicoLead.deleteMany({ where: { leadId: { in: leads.map((x) => x.id) } } });
    await prisma.lead.deleteMany({ where: { id: { in: leads.map((x) => x.id) } } });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: MARCA.toLowerCase() } } });
  }

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    acoes = await import("@/lib/actions/pci-gerador");
    await limpar();
    const usuario = async (chave: string, nome: string, papel: string, extra: Record<string, unknown> = {}, perfil?: Record<string, unknown>) => {
      const x = await prisma.usuario.create({ data: { nome, email: `${MARCA.toLowerCase()}-${chave}@x.y`, senha: "x", papel, ...extra } });
      if (perfil) await prisma.perfilEngenheiro.create({ data: { usuarioId: x.id, ...perfil } });
      u[chave] = x.id;
    };
    await usuario("admin", `${MARCA} Admin`, "admin");
    await usuario("rafael", "Rafael Claudino", "colaborador", {}, { ativo: true, cpf: CPF_RAFAEL, telefone: "(99) 99111-2222", crea: "1122334455", creaUf: "MA" });
    await usuario("ana", "Eng. Ana", "colaborador", { telefone: "(86) 3222-1111" }, { ativo: true, cpf: CPF_ANA, crea: "998877", creaUf: "PI" });
    await usuario("desativado", "Eng. Desativado", "colaborador", { telefone: "(99) 3000-0000" }, { ativo: false, cpf: CPF_INATIVO, telefone: "(99) 98000-0000", crea: "555", creaUf: "MA" });
    await usuario("colabObras", "Colab Obras", "colaborador", { permissoes: '["obras"]' });
    await usuario("outroColab", "Outro Colab Obras", "colaborador", { permissoes: '["obras"]' });
    await usuario("inativo", "Usuário Inativo", "colaborador", { ativo: false }, { ativo: true, cpf: "333.444.555-06", crea: "777", creaUf: "MA" });
    await usuario("cliente", "Cliente Portal", "cliente", {}, { ativo: true, cpf: "444.555.666-07", crea: "888", creaUf: "MA" });
    await usuario("corretor", "Corretor", "corretor");
    const lead1 = await prisma.lead.create({ data: { nome: `${MARCA} Cliente Um`, telefone: "(99) 98888-7777", email: "um@x.y", cpf: CPF_CLIENTE_1, servico: "obras", endereco: "Rua do Lead", bairro: "Bairro Um" } });
    const lead2 = await prisma.lead.create({ data: { nome: `${MARCA} Cliente Dois`, telefone: "", email: "dois@x.y", cpf: "987.654.321-00", servico: "obras", bairro: "Bairro Dois" } });
    const lead3 = await prisma.lead.create({ data: { nome: `${MARCA} Cliente Tres`, telefone: "", servico: "obras" } });
    const s1 = await prisma.servicoLead.create({ data: { leadId: lead1.id, modulo: "obras", servico: "obras", requestKey: `${MARCA}-s1` } });
    const s3 = await prisma.servicoLead.create({ data: { leadId: lead3.id, modulo: "obras", servico: "obras", requestKey: `${MARCA}-s3` } });
    await prisma.projeto.create({ data: { nome: `${MARCA} Projeto Casa Lote 1`, clienteNome: "x", clienteTel: "x", engenheiroId: u.rafael, status: "execucao", leadId: lead1.id, servicoLeadId: s1.id } });
    await prisma.projeto.create({ data: { nome: `${MARCA} Projeto Cancelado`, clienteNome: "x", clienteTel: "x", engenheiroId: u.ana, status: "cancelado", leadId: lead3.id, servicoLeadId: s3.id } });
    const obra20 = await prisma.obra.create({ data: {
      nome: `${MARCA} Casa Lote 1`, clienteNome: "Cliente Um", clienteTel: "", endereco: "Rua Lote 1, Imperatriz - MA", area: 70, vgv: 200000, custoTerreno: 50000,
      financiamentoCef: 150000, dataInicio: new Date("2026-01-10T12:00:00Z"), dataPrevisaoFim: new Date("2026-07-05T12:00:00Z"), leadId: lead1.id, servicoLeadId: s1.id,
      latitude: -5.5, longitude: -47.5,
    } });
    const obra21 = await prisma.obra.create({ data: { nome: `${MARCA} Casa Lote 2`, clienteNome: "Cliente Dois", clienteTel: "", endereco: "Rua Lote 2", area: 70, leadId: lead2.id } });
    const versao = await prisma.obraPciVersao.create({ data: { obraId: obra21.id, hash: `${MARCA}-h`, nome: "pci.xls", dados: Buffer.from([0, 1, 2, 3]), tamanho: 4, parsed: {} } });
    await prisma.obraPci.create({ data: { obraId: obra21.id, versaoId: versao.id } });
    const obra22 = await prisma.obra.create({ data: { nome: `${MARCA} Casa Lote 3`, clienteNome: "", clienteTel: "", endereco: "Rua Lote 3", leadId: lead3.id, servicoLeadId: s3.id } });
    Object.assign(o, { o20: obra20.id, o21: obra21.id, o22: obra22.id });
  });
  afterAll(async () => { if (prisma) { await limpar(); await prisma.$disconnect(); } });

  describe("A — CPF do engenheiro", () => {
    it("a lista de engenheiros nunca leva CPF", async () => {
      comoAdmin();
      const d = ok(await acoes.obterGeradorPci(o.o21)).dados;
      const json = JSON.stringify(d.engenheiros);
      expect(d.engenheiros.map((e) => e.nome)).toEqual(expect.arrayContaining(["Rafael Claudino", "Eng. Ana"]));
      for (const cpf of [CPF_RAFAEL, CPF_ANA, CPF_INATIVO]) expect(json).not.toContain(cpf);
      expect(json).not.toMatch(/"cpf"/);
    });
    it("o engenheiro escolhido vem com CPF, CREA e telefone do perfil; a leitura é registrada só com ids", async () => {
      const log = vi.spyOn(console, "info").mockImplementation(() => {});
      try {
        comoAdmin();
        expect(ok(await acoes.engenheiroPciAcao(o.o20, u.rafael)).engenheiro).toMatchObject({ id: u.rafael, nome: "Rafael Claudino", cpf: CPF_RAFAEL, crea: "1122334455", creaUf: "MA", telefone: "(99) 99111-2222", perfilAtivo: true, avisos: [] });
        comoColabObras();
        expect(ok(await acoes.engenheiroPciAcao(o.o20, u.ana)).engenheiro).toMatchObject({ cpf: CPF_ANA, telefone: "(86) 3222-1111" });
        const linhas = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("pci.cpf_engenheiro_lido"));
        expect(linhas).toHaveLength(2);
        expect(JSON.parse(linhas[1])).toMatchObject({ usuarioId: u.colabObras, obraId: o.o20, engenheiroId: u.ana, origem: "selecao", comCpf: true });
        for (const l of linhas) { expect(l).not.toContain(CPF_ANA); expect(l).not.toContain(CPF_RAFAEL); expect(l).not.toMatch(/Ana|Rafael/); }
      } finally { log.mockRestore(); }
    });
    it("só quem a lista oferece: usuário inativo, cliente ou corretor → recusa (mesmo com perfil de Engenheiro)", async () => {
      comoColabObras();
      for (const id of [u.inativo, u.cliente, u.corretor, "nao-existe"]) expect(await acoes.engenheiroPciAcao(o.o20, id)).toEqual({ erro: expect.stringMatching(/não está na lista de engenheiros/) });
      // Sugestões com um id arbitrário também não trazem o CPF.
      const s = ok(await acoes.sugestoesAutomaticasPciAcao(o.o21, { rtpEngenheiroId: u.cliente })).sugestoes;
      expect(JSON.stringify(s)).not.toContain("444.555.666-07");
      expect(s.ausencias.find((a) => a.chave === "rtpCpf")?.motivo).toMatch(/não está na lista de engenheiros/);
    });
    it("perfil desativado ou ausente: nada do perfil e aviso claro", async () => {
      comoAdmin();
      const des = ok(await acoes.engenheiroPciAcao(o.o20, u.desativado)).engenheiro;
      expect(des).toMatchObject({ cpf: null, crea: null, perfilAtivo: false, telefone: "(99) 3000-0000" });
      expect(des.avisos[0]).toMatch(/está desativado/);
      expect(ok(await acoes.engenheiroPciAcao(o.o20, u.admin)).engenheiro.avisos[0]).toMatch(/não tem perfil de Engenheiro/);
      const s = ok(await acoes.sugestoesAutomaticasPciAcao(o.o21, { rtpEngenheiroId: u.desativado })).sugestoes;
      expect(s.ausencias.find((a) => a.chave === "rtpCpf")?.motivo).toMatch(/está desativado/);
    });
  });

  describe("B — Dados automáticos", () => {
    it("abertura sem rascunho: RTP do projeto do mesmo serviço, com a fonte no relatório (como no botão)", async () => {
      comoAdmin();
      const d = ok(await acoes.obterGeradorPci(o.o20)).dados;
      expect(d.origem).toBe("automatico");
      expect(d.formulario.campos).toMatchObject({ rtpNome: "Rafael Claudino", rtpCpf: CPF_RAFAEL, rtpRegistro: "1122334455", proponenteCpf: CPF_CLIENTE_1, bairro: "Bairro Um", latitude: `05° 30' 00" S` });
      expect(d.preenchimento?.preenchidos.find((p) => p.chave === "rtpCpf")?.fonte).toMatch(/Projeto Casa Lote 1.*mesmo serviço do CRM.*perfil de Rafael Claudino/);
      expect(d.preenchimento?.preenchidos.find((p) => p.chave === "proponenteCpf")?.fonte).toBe("Cliente do CRM (lead vinculado à obra)");
      expect(d.preenchimento?.naoEncontrados.find((a) => a.chave === "rteCpf")?.motivo).toMatch(/Nenhum engenheiro de execução/);
    });
    it("projeto cancelado não vale como engenheiro da obra", async () => {
      comoAdmin();
      const s = ok(await acoes.sugestoesAutomaticasPciAcao(o.o22, {})).sugestoes;
      expect(JSON.stringify(s)).not.toContain(CPF_ANA);
      expect(s.ausencias.find((a) => a.chave === "rtpNome")?.motivo).toMatch(/não tem serviço do CRM ligado a um projeto/);
    });
    it("RTE do rascunho; RTP digitado à mão ≠ engenheiro escolhido → escolha da pessoa inteira, sem mistura", async () => {
      comoAdmin();
      let rascunho = normalizarFormularioPci({ rteEngenheiroId: u.ana, campos: { proponenteNome: `${MARCA} Cliente Um` } });
      rascunho = definirCampoPci(rascunho, "rtpNome", "Digitado à mão");
      ok(await acoes.salvarRascunhoGeradorPci(o.o20, rascunho));
      const s = ok(await acoes.sugestoesAutomaticasPciAcao(o.o20, { rtpEngenheiroId: u.rafael })).sugestoes;
      const r = compararPreenchimentoPci(rascunho, s.sugestoes, s.ausencias);
      expect(r.formulario.campos).toMatchObject({ rteNome: "Eng. Ana", rteCpf: CPF_ANA, rtpNome: "Digitado à mão", rtpCpf: null });
      const rtp = r.pessoas.find((p) => p.pessoa === "rtp")!;
      expect(rtp.opcoes[0]).toMatchObject({ valores: expect.objectContaining({ rtpNome: "Rafael Claudino", rtpCpf: CPF_RAFAEL }), fonte: expect.stringMatching(/escolhido nesta obra/) });
      expect(aplicarEscolhasPci(r.formulario, { pessoas: { rtp: rtp.opcoes[0] } }).campos).toMatchObject({ rtpNome: "Rafael Claudino", rtpCpf: CPF_RAFAEL });
      // Portão 2 (M1): o nome do rascunho igual ao do CRM não traz o CPF do CRM calado — escolha com a junção rotulada.
      expect(r.formulario.campos.proponenteCpf).toBeNull();
      expect(r.pessoas.find((p) => p.pessoa === "proponente")?.opcoes.map((x) => x.fonte)).toEqual([
        "Cliente do CRM (lead vinculado à obra)", "o que está na tela + Cliente do CRM (lead vinculado à obra) (nome igual nas duas fontes; confira se é a mesma pessoa)",
      ]);
      // Mesmo profissional nos dois papéis.
      const mesmo = compararPreenchimentoPci(normalizarFormularioPci({}), ok(await acoes.sugestoesAutomaticasPciAcao(o.o20, { rtpEngenheiroId: u.rafael, rteEngenheiroId: u.rafael })).sugestoes.sugestoes);
      expect([mesmo.formulario.campos.rtpCpf, mesmo.formulario.campos.rteCpf]).toEqual([CPF_RAFAEL, CPF_RAFAEL]);
      await prisma.pciGeradorRascunho.delete({ where: { obraId: o.o20 } });
    });
    it("gerar recusa nome e CPF de fontes diferentes (guarda no servidor)", async () => {
      comoAdmin();
      let f = compararPreenchimentoPci(normalizarFormularioPci({}), ok(await acoes.sugestoesAutomaticasPciAcao(o.o20, { rtpEngenheiroId: u.rafael })).sugestoes.sugestoes).formulario;
      expect(f.campos.rtpCpf).toBe(CPF_RAFAEL);
      expect(f.procedencia?.rtpCpf).toBe(`engenheiro:${u.rafael}`); // id texto (cuid) também é origem conferível
      f = definirCampoPci(f, "rtpNome", "Outra pessoa");
      expect(await acoes.gerarPci(o.o20, f)).toEqual({ erro: expect.stringMatching(/nome e o CPF vieram de fontes diferentes/) });
    });
    it("portão 2, L3 — procedência forjada no navegador: o servidor confere com a fonte e recusa a mistura", async () => {
      comoAdmin();
      const origem = `engenheiro:${u.rafael}`;
      const forjado = normalizarFormularioPci({ rtpEngenheiroId: u.rafael, campos: { rtpNome: "Outra pessoa", rtpCpf: CPF_RAFAEL }, procedencia: { rtpEngenheiroId: origem, rtpNome: origem, rtpCpf: origem } });
      const log = vi.spyOn(console, "info");
      try {
        expect(await acoes.gerarPci(o.o20, forjado)).toEqual({ erro: expect.stringMatching(/RT pelo projeto \(RTP\): o nome e o CPF vieram de fontes diferentes/) });
        const linha = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("pci.procedencia_rebaixada"))!;
        expect(JSON.parse(linha)).toMatchObject({ usuarioId: u.admin, obraId: o.o20, campos: ["rtpNome"] });
        expect(linha).not.toContain(CPF_RAFAEL);
      } finally { log.mockRestore(); }
    });
    it("portão 2, L4 — confirmação gravada com quem e quando no rascunho, log só com ids, sem registrar de novo", async () => {
      const f = confirmarMesmaPessoaPci(normalizarFormularioPci({ campos: { proponenteNome: "Pessoa Antiga", proponenteCpf: CPF_CLIENTE_1 } }), "proponente");
      const log = vi.spyOn(console, "info");
      try {
        comoColabObras();
        ok(await acoes.salvarRascunhoGeradorPci(o.o22, f));
        const gravado = (await prisma.pciGeradorRascunho.findUniqueOrThrow({ where: { obraId: o.o22 } })).dados as unknown as FormularioPci;
        expect(gravado.confirmacoes?.proponente).toMatchObject({ por: u.colabObras, marca: expect.stringMatching(/^[0-9a-f]{8}$/) });
        const linhas = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("pci.pessoa_confirmada"));
        expect(linhas).toHaveLength(1);
        expect(JSON.parse(linhas[0])).toMatchObject({ evento: "pci.pessoa_confirmada", usuarioId: u.colabObras, obraId: o.o22, pessoa: "proponente" });
        expect(linhas[0]).not.toMatch(/Pessoa Antiga|123\.456/);
        // Outro usuário salva o mesmo nome/CPF já confirmado: o registro original fica.
        comoOutroColab();
        ok(await acoes.salvarRascunhoGeradorPci(o.o22, normalizarFormularioPci(gravado)));
        expect(log.mock.calls.filter((c) => String(c[0]).includes("pci.pessoa_confirmada"))).toHaveLength(1);
        const depois = (await prisma.pciGeradorRascunho.findUniqueOrThrow({ where: { obraId: o.o22 } })).dados as unknown as FormularioPci;
        expect(depois.confirmacoes?.proponente?.por).toBe(u.colabObras);
      } finally { log.mockRestore(); await prisma.pciGeradorRascunho.deleteMany({ where: { obraId: o.o22 } }); }
    });
    it("PCI vinculada ilegível deixa de ser engolida: vira motivo", async () => {
      comoAdmin();
      const s = ok(await acoes.sugestoesAutomaticasPciAcao(o.o21, {})).sugestoes;
      expect(s.ausencias.find((a) => a.chave === "custos")?.motivo).toMatch(/PCI vinculada não pôde ser lida/);
      expect(s.ausencias.find((a) => a.chave === "latitude")?.motivo).toMatch(/localização exata/);
    });
  });

  describe("C — modelos de preenchimento", () => {
    const formObra20 = () => normalizarFormularioPci({
      campos: { proponenteNome: "Cliente Um", proponenteCpf: CPF_CLIENTE_1, rtpNome: "Rafael Claudino", rtpCpf: CPF_RAFAEL, endereco: "Rua Lote 1", bairro: "Bairro Um",
        matricula: "4321", latitude: `05° 30' 00" S`, valorTerreno: 50000, valorImovel: 200000, areaCoberta: 70, divisaoInterna: "2 quartos, sala, cozinha", bdi: 18, prazoMeses: 6 },
      custos: [3000, 4000], cronograma: [10, 30, 50, 70, 90, 100], rtpEngenheiroId: u.rafael, imagem: { tipo: "png", base64: "QUJD" },
    });
    const N = (s: string) => `${MARCA} ${s}`;
    const meus = <T extends { nome: string }>(l: T[]) => l.filter((m) => m.nome.startsWith(MARCA));
    const salvar = (e: { nome: string; formulario: FormularioPci; observacao?: string; novaVersaoDe?: string | null }, obraId = o.o20) => acoes.salvarModeloPreenchimentoPciAcao({ obraId, ...e });

    it("salva só o técnico (o JSON gravado não tem CPF, nome nem endereço da obra de origem); a obra de origem só o admin vê", async () => {
      comoColabObras();
      const r = ok(await salvar({ nome: N("Casa padrão 70 m²"), formulario: formObra20() }));
      expect(r).toMatchObject({ nome: N("Casa padrão 70 m²"), versao: 1 });
      const gravado = JSON.stringify((await prisma.pciModeloPreenchimento.findUniqueOrThrow({ where: { id: r.id } })).dados);
      for (const proibido of [CPF_CLIENTE_1, CPF_RAFAEL, "Cliente Um", "Rafael", "Rua Lote 1", "Bairro Um", "4321", "05°", "50000", "200000", "QUJD", "EngenheiroId"]) expect(gravado).not.toContain(proibido);
      expect(gravado).toContain("2 quartos, sala, cozinha");
      const lista = meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos);
      expect(lista).toEqual([expect.objectContaining({ nome: N("Casa padrão 70 m²"), versao: 1, obraOrigem: null, obraOrigemId: null, autor: "Colab Obras", resumo: expect.stringMatching(/campo\(s\) técnico\(s\), custos, cronograma/) })]);
      expect(JSON.stringify(ok(await acoes.obterModeloPreenchimentoPciAcao(r.id)))).not.toContain("Casa Lote 1");
      comoAdmin();
      expect(meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos)[0]).toMatchObject({ obraOrigem: `${MARCA} Casa Lote 1` });
      expect(await salvar({ nome: N("casa PADRÃO 70 m²"), formulario: formObra20() })).toEqual({ erro: expect.stringMatching(/Já existe o modelo/) });
      expect(await salvar({ nome: N("Vazio"), formulario: normalizarFormularioPci({ campos: { proponenteCpf: CPF_CLIENTE_1 } }) })).toEqual({ erro: expect.stringMatching(/Não há dados técnicos/) });
    });

    it("texto livre com CPF, e-mail ou telefone: recusa e diz o campo (nada é apagado em silêncio)", async () => {
      comoAdmin();
      const f = formObra20();
      f.campos.justificativaPrazoTexto = "Cliente José da Silva CPF 529.982.247-25 mora na Rua X 10";
      f.adicionais[0] = { descricao: "Muro — falar com jose@x.com", valor: 10 };
      expect(await salvar({ nome: N("Com dado pessoal"), formulario: f, observacao: "tel (99) 98888-7777" })).toEqual({
        erro: expect.stringMatching(/Observação do modelo \(telefone: "tel \(99\) 9••••-••77"\); Justificativa técnica do prazo \(CPF: "…da Silva CPF 529\.•••\.•••-25"\); Serviço adicional 1 \(e-mail: "…— falar com jos•@•\.•om"\)/),
      });
      expect(await salvar({ nome: N("Casa 52998224725"), formulario: formObra20() })).toEqual({ erro: expect.stringMatching(/Nome do modelo \(CPF: ".*529••••••25"\)/) });
      // Portão 2 (L5): CNPJ de fornecedor não bloqueia — salva com aviso.
      const comCnpj = formObra20();
      comCnpj.campos.justificativaPrazoTexto = "Esquadrias do fornecedor ACME, CNPJ 11.222.333/0001-81, conforme orçamento";
      const salvo = ok(await salvar({ nome: N("Com CNPJ de fornecedor"), formulario: comCnpj }));
      expect(salvo.avisos.join(" ")).toMatch(/Justificativa técnica do prazo: CNPJ "…ACME, CNPJ 11\.2••\.•••\/••••-81" ficou no modelo \(dado de empresa/);
      ok(await acoes.excluirModeloPreenchimentoPciAcao(salvo.id, true));
      expect(await prisma.pciModeloPreenchimento.count({ where: { OR: [{ nome: { contains: "dado pessoal" } }, { nome: { startsWith: N("Casa 5") } }] } })).toBe(0);
    });

    it("aplicar em outra obra: técnico entra, dados pessoais da outra obra ficam", async () => {
      comoAdmin();
      const [m] = meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos);
      comoColabObras();
      const modelo = ok(await acoes.obterModeloPreenchimentoPciAcao(m.id)).modelo;
      expect(JSON.stringify(modelo)).not.toContain(CPF_CLIENTE_1);
      const obra21 = normalizarFormularioPci({ campos: { proponenteNome: "Cliente Dois", proponenteCpf: "987.654.321-00", endereco: "Rua Lote 2", valorTerreno: 40000 } });
      const r = compararPreenchimentoPci(obra21, sugestoesDoModeloPci(modelo.dados, `Modelo "${modelo.nome}" v${modelo.versao}`));
      expect(r.formulario.campos).toMatchObject({ proponenteNome: "Cliente Dois", proponenteCpf: "987.654.321-00", endereco: "Rua Lote 2", valorTerreno: 40000, areaCoberta: 70, bdi: 18, prazoMeses: 6, rtpCpf: null });
      expect(r.formulario.custos.slice(0, 2)).toEqual([3000, 4000]);
      expect(r.formulario.cronograma).toEqual([10, 30, 50, 70, 90, 100]);
      expect([r.conflitos, r.pessoas]).toEqual([[], []]);
      // O formulário guarda de qual modelo veio (id texto no Santa Fé) e isso sobrevive à normalização.
      expect(normalizarFormularioPci({ ...r.formulario, modeloOrigem: { id: modelo.id, nome: modelo.nome, versao: modelo.versao } }).modeloOrigem).toEqual({ id: modelo.id, nome: modelo.nome, versao: 1 });
    });

    it("nova versão guarda a anterior; histórico; não salva sobre versão antiga; não toma o nome de outro modelo", async () => {
      comoAdmin();
      const [v1] = meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos);
      const f = formObra20();
      f.campos.bdi = 15;
      comoOutroColab();
      const v2 = ok(await salvar({ nome: v1.nome, formulario: f, novaVersaoDe: v1.id }));
      expect(v2).toMatchObject({ versao: 2, nome: N("Casa padrão 70 m²") });
      comoAdmin();
      expect(meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos).map((m) => [m.id, m.versao])).toEqual([[v2.id, 2]]);
      expect(ok(await acoes.historicoModeloPreenchimentoPciAcao(v2.id)).versoes.map((h) => h.versao)).toEqual([2, 1]);
      expect(ok(await acoes.obterModeloPreenchimentoPciAcao(v1.id)).modelo.dados.campos.bdi).toBe(18);
      expect(ok(await acoes.obterModeloPreenchimentoPciAcao(v2.id)).modelo.dados.campos.bdi).toBe(15);
      expect(await salvar({ nome: N("x"), formulario: f, novaVersaoDe: v1.id })).toEqual({ erro: expect.stringMatching(/versão mais nova/) });
      const outro = ok(await salvar({ nome: N("Sobrado 120 m²"), formulario: f }));
      expect(await salvar({ nome: N("CASA PADRÃO 70 m²"), formulario: f, novaVersaoDe: outro.id })).toEqual({ erro: expect.stringMatching(/Já existe o modelo/) });
      ok(await acoes.excluirModeloPreenchimentoPciAcao(outro.id, true));
    });

    it("portão 2, L6 — nome único no banco (índice parcial da versão atual): corrida de dois salvamentos dá a mensagem amigável", async () => {
      comoAdmin();
      const f = formObra20();
      // As duas gravações passam pela conferência do nome antes de qualquer gravação; só o índice decide. (Chamadas à
      // função do servidor, e não à action: chamadas simultâneas da action carregam o next-auth real no vitest.)
      const dados = await import("@/lib/obras/pci-gerador-dados");
      const [a, b] = await Promise.allSettled([
        dados.salvarModeloPreenchimentoPci({ obraId: o.o20, nome: N("Corrida 90 m²"), formulario: f }, u.admin),
        dados.salvarModeloPreenchimentoPci({ obraId: o.o20, nome: N("CORRIDA 90 m²"), formulario: f }, u.colabObras),
      ]);
      const erros = [a, b].filter((x) => x.status === "rejected") as PromiseRejectedResult[];
      const certos = ([a, b].filter((x) => x.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[]).map((x) => x.value);
      expect([erros.length, certos.length]).toEqual([1, 1]);
      expect(String(erros[0].reason?.message)).toMatch(/Já existe o modelo/);
      expect(await prisma.pciModeloPreenchimento.count({ where: { nome: { equals: N("Corrida 90 m²"), mode: "insensitive" }, excluidoEm: null } })).toBe(1);
      // O índice em si: gravação direta com o mesmo nome é recusada; nova versão (mesmo nome) passa; excluído libera o nome.
      await expect(prisma.$executeRawUnsafe(`INSERT INTO pci_modelos_preenchimento (id, nome, dados) VALUES ('${MARCA}-direto', '${N("corrida 90 M²")}', '{}'::jsonb)`)).rejects.toThrow(/pci_modelos_preenchimento_nome_atual_uidx/);
      const v2 = ok(await salvar({ nome: N("Corrida 90 m²"), formulario: f, novaVersaoDe: certos[0].id }));
      expect(v2.versao).toBe(2);
      expect((await prisma.pciModeloPreenchimento.findUniqueOrThrow({ where: { id: certos[0].id } })).substituido).toBe(true);
      expect(await salvar({ nome: N("Corrida 90 m²"), formulario: f, novaVersaoDe: certos[0].id })).toEqual({ erro: expect.stringMatching(/versão mais nova/) });
      ok(await acoes.excluirModeloPreenchimentoPciAcao(v2.id, true));
      const deNovo = ok(await salvar({ nome: N("Corrida 90 m²"), formulario: f }));
      expect(deNovo.versao).toBe(1);
      ok(await acoes.excluirModeloPreenchimentoPciAcao(deNovo.id, true));
    });

    it("exclusão lógica: só o admin ou o AUTOR ORIGINAL — quem só acrescentou versão não apaga", async () => {
      comoAdmin();
      const [m] = meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos); // v2 do "outroColab"; a v1 do "colabObras"
      comoOutroColab();
      expect(await acoes.excluirModeloPreenchimentoPciAcao(m.id, true)).toEqual({ erro: expect.stringMatching(/Só o administrador ou quem criou o modelo/) });
      comoColabObras();
      expect(ok(await acoes.excluirModeloPreenchimentoPciAcao(m.id, true))).toMatchObject({ versoes: 2 });
      comoAdmin();
      expect(meus(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos)).toEqual([]);
      expect(await prisma.pciModeloPreenchimento.count({ where: { nome: { startsWith: MARCA }, excluidoEm: { not: null } } })).toBe(7); // + o com CNPJ (L5) e os 3 da corrida (L6)
    });
  });

  describe("permissões", () => {
    it("corretor, cliente, empreiteiro e colaborador sem Obras não usam; colaborador com Obras usa", async () => {
      const chamadas = () => [
        () => acoes.engenheiroPciAcao(o.o20, u.rafael),
        () => acoes.sugestoesAutomaticasPciAcao(o.o20, {}),
        () => acoes.listarModelosPreenchimentoPciAcao(),
        () => acoes.salvarModeloPreenchimentoPciAcao({ obraId: o.o20, nome: `${MARCA} X`, formulario: {} }),
        () => acoes.excluirModeloPreenchimentoPciAcao("x", true),
      ];
      for (const [role, permissoes] of [["colaborador", ["crm"]], ["corretor", undefined], ["cliente", undefined], ["empreiteiro", undefined]] as const) {
        sessao.atual = { user: { id: u.corretor, role, ...(permissoes ? { permissoes: [...permissoes] } : {}) } };
        for (const chamada of chamadas()) expect(await chamada()).toEqual({ erro: expect.stringMatching(/Sem permissão|Não autorizado/) });
      }
      comoColabObras();
      expect(ok(await acoes.listarModelosPreenchimentoPciAcao()).modelos).toBeDefined();
    });
  });
});
