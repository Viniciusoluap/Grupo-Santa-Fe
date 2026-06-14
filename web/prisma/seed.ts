import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// @ts-ignore
const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
// @ts-ignore
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database…");

  // ─── CORRETORES ────────────────────────────────────────────────────────────
  const c1 = await prisma.corretor.upsert({
    where: { email: "joao@gruposantafe.com.br" },
    update: {},
    create: {
      id: "c1",
      nome: "João Santos",
      creci: "CRECI-PA 0001",
      telefone: "(94) 9 9999-1111",
      email: "joao@gruposantafe.com.br",
      ativo: true,
      especialidades: JSON.stringify(["Compra e Venda", "Financiamento MCMV", "Lotes"]),
    },
  });

  const c2 = await prisma.corretor.upsert({
    where: { email: "maria@gruposantafe.com.br" },
    update: {},
    create: {
      id: "c2",
      nome: "Maria Oliveira",
      creci: "CRECI-PA 0002",
      telefone: "(94) 9 9999-2222",
      email: "maria@gruposantafe.com.br",
      ativo: true,
      especialidades: JSON.stringify(["Compra e Venda", "Imóveis de Alto Padrão", "Locação"]),
    },
  });

  const c3 = await prisma.corretor.upsert({
    where: { email: "ana@gruposantafe.com.br" },
    update: {},
    create: {
      id: "c3",
      nome: "Ana Lima",
      creci: "CRECI-PA 0003",
      telefone: "(94) 9 9999-3333",
      email: "ana@gruposantafe.com.br",
      ativo: true,
      especialidades: JSON.stringify(["Financiamento Habitacional", "MCMV", "Regularização"]),
    },
  });

  console.log("✅ Corretores criados");

  // ─── IMÓVEIS ───────────────────────────────────────────────────────────────
  const imoveis = [
    {
      id: "imovel-1",
      slug: "casa-3-quartos-ouro-preto",
      tipo: "casa",
      status: "venda",
      titulo: "Casa 3 Quartos — Ouro Preto",
      descricao: "Linda casa no bairro Ouro Preto com acabamento de alto padrão, piso porcelanato, armários planejados e área gourmet.",
      preco: 380000,
      precoNegociavel: true,
      iptu: 180,
      area: 120,
      areaTotal: 180,
      quartos: 3,
      suites: 1,
      banheiros: 2,
      vagas: 2,
      rua: "Rua B",
      bairro: "Ouro Preto",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Armários planejados", "Piso porcelanato", "Área gourmet", "Churrasqueira"]),
      destaque: true,
      badge: "Destaque",
      corretorId: c1.id,
    },
    {
      id: "imovel-2",
      slug: "lote-novo-horizonte",
      tipo: "lote",
      status: "venda",
      titulo: "Lote Residencial — Novo Horizonte",
      descricao: "Excelente lote plano em localização privilegiada. Toda documentação regularizada.",
      preco: 120000,
      area: 300,
      rua: "Rua das Flores",
      bairro: "Novo Horizonte",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Documentação regularizada", "Terreno plano", "Infraestrutura completa"]),
      destaque: true,
      badge: "Oportunidade",
      corretorId: c2.id,
    },
    {
      id: "imovel-3",
      slug: "apartamento-2-quartos-centro",
      tipo: "apartamento",
      status: "venda",
      titulo: "Apartamento 2 Quartos — Centro",
      descricao: "Apartamento moderno no Centro com vista privilegiada, reformado recentemente.",
      preco: 280000,
      condominio: 550,
      iptu: 80,
      area: 65,
      quartos: 2,
      banheiros: 2,
      vagas: 1,
      rua: "Rua Principal",
      bairro: "Centro",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Reformado", "Vista privilegiada", "Área de lazer"]),
      destaque: false,
      corretorId: c1.id,
    },
    {
      id: "imovel-4",
      slug: "casa-4-quartos-residencial-norte",
      tipo: "casa",
      status: "venda",
      titulo: "Casa 4 Quartos — Residencial Norte",
      descricao: "Espaçosa casa em condomínio fechado com excelente localização.",
      preco: 520000,
      condominio: 800,
      area: 200,
      areaTotal: 300,
      quartos: 4,
      suites: 2,
      banheiros: 3,
      vagas: 2,
      rua: "Alameda das Palmeiras",
      bairro: "Residencial Norte",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Condomínio fechado", "Piscina", "Churrasqueira", "Portaria 24h"]),
      destaque: true,
      badge: "Exclusivo",
      corretorId: c2.id,
    },
    {
      id: "imovel-5",
      slug: "lote-vale-dourado",
      tipo: "lote",
      status: "venda",
      titulo: "Lote Comercial — Vale Dourado",
      descricao: "Lote em esquina, ideal para comércio. Alto fluxo de pessoas.",
      preco: 250000,
      area: 450,
      rua: "Av. Principal",
      bairro: "Vale Dourado",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Esquina", "Alto fluxo", "Documentação ok"]),
      destaque: false,
      corretorId: c3.id,
    },
    {
      id: "imovel-6",
      slug: "casa-3-quartos-vila-funcionarios",
      tipo: "casa",
      status: "locacao",
      titulo: "Casa 3 Quartos para Locação — Vila dos Funcionários",
      descricao: "Casa para locação em bairro tranquilo e familiar.",
      preco: 2500,
      area: 90,
      quartos: 3,
      banheiros: 1,
      vagas: 1,
      rua: "Rua C",
      bairro: "Vila dos Funcionários",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Quintal amplo", "Garagem"]),
      destaque: false,
      corretorId: c1.id,
    },
    {
      id: "imovel-7",
      slug: "chacara-zona-rural",
      tipo: "chacara",
      status: "venda",
      titulo: "Chácara 5 ha — Zona Rural",
      descricao: "Chácara com nascente, pomar e casa sede. Ótimo para lazer ou produção.",
      preco: 450000,
      area: 50000,
      quartos: 3,
      banheiros: 2,
      rua: "Estrada Vicinal km 8",
      bairro: "Zona Rural",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Nascente", "Pomar", "Casa sede", "Curral"]),
      destaque: false,
      corretorId: c3.id,
    },
    {
      id: "imovel-8",
      slug: "apartamento-lancamento-centro",
      tipo: "apartamento",
      status: "lancamento",
      titulo: "Apartamento Lançamento — Centro",
      descricao: "Lançamento exclusivo no centro da cidade. Unidades limitadas.",
      preco: 350000,
      condominio: 700,
      area: 75,
      quartos: 2,
      suites: 1,
      banheiros: 2,
      vagas: 1,
      rua: "Av. JK",
      bairro: "Centro",
      cidade: "Canaã dos Carajás",
      estado: "PA",
      features: JSON.stringify(["Academia", "Salão de festas", "Segurança 24h"]),
      destaque: true,
      badge: "Lançamento",
      corretorId: c2.id,
    },
  ];

  for (const imovel of imoveis) {
    await prisma.imovel.upsert({
      where: { id: imovel.id },
      update: {},
      create: imovel,
    });
  }
  console.log("✅ Imóveis criados");

  // ─── LEADS ─────────────────────────────────────────────────────────────────
  const leads = [
    {
      id: "lead-1",
      nome: "Carlos Mendes",
      telefone: "(94) 9 8765-4321",
      email: "carlos@email.com",
      servico: "Financiamento MCMV",
      status: "contato",
      origem: "site",
      corretorId: c1.id,
      orcamento: 300000,
      notas: "Interessado em casa com FGTS disponível.",
    },
    {
      id: "lead-2",
      nome: "Ana Paula Santos",
      telefone: "(94) 9 9876-5432",
      email: "ana@email.com",
      servico: "Compra de imóvel",
      status: "visita_agendada",
      origem: "whatsapp",
      corretorId: c2.id,
      orcamento: 450000,
      notas: "Quer casa 3 quartos em bairro nobre.",
    },
    {
      id: "lead-3",
      nome: "Roberto Lima",
      telefone: "(94) 9 7654-3210",
      email: "roberto@email.com",
      servico: "Avaliação de imóvel",
      status: "proposta",
      origem: "indicacao",
      corretorId: c1.id,
      notas: "Quer avaliar terreno para vender.",
    },
    {
      id: "lead-4",
      nome: "Fernanda Costa",
      telefone: "(94) 9 6543-2109",
      email: "fernanda@email.com",
      servico: "Regularização",
      status: "negociacao",
      origem: "instagram",
      corretorId: c3.id,
      notas: "Imóvel sem escritura, quer regularizar.",
    },
    {
      id: "lead-5",
      nome: "Marcos Oliveira",
      telefone: "(94) 9 5432-1098",
      email: "marcos@email.com",
      servico: "Obra e reforma",
      status: "novo",
      origem: "site",
      corretorId: c2.id,
      orcamento: 80000,
      notas: "Reforma de cozinha e banheiros.",
    },
    {
      id: "lead-6",
      nome: "Beatriz Santos",
      telefone: "(94) 9 7777-2222",
      email: "beatriz@email.com",
      servico: "Compra de imóvel",
      status: "ganho",
      origem: "whatsapp",
      corretorId: c2.id,
      orcamento: 560000,
      notas: "Comprou o apartamento no Setor Bueno.",
    },
    {
      id: "lead-7",
      nome: "Rodrigo Mendes",
      telefone: "(94) 9 7766-4455",
      email: "rodrigo@email.com",
      servico: "Financiamento SBPE",
      status: "contato",
      origem: "facebook",
      corretorId: c1.id,
      orcamento: 650000,
      notas: "Interesse em SBPE para imóvel comercial.",
    },
    {
      id: "lead-8",
      nome: "Luiza Ferreira",
      telefone: "(94) 9 8899-3344",
      email: "luiza@email.com",
      servico: "Locação",
      status: "novo",
      origem: "outro",
      corretorId: c3.id,
      orcamento: 3000,
      notas: "Procura casa para locação.",
    },
  ];

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {},
      create: lead,
    });
  }
  console.log("✅ Leads criados");

  // ─── INTERAÇÕES ────────────────────────────────────────────────────────────
  await prisma.interacao.upsert({
    where: { id: "int-1" },
    update: {},
    create: {
      id: "int-1",
      leadId: "lead-1",
      tipo: "nota",
      descricao: "Lead chegou pelo formulário do site. Interesse em financiamento MCMV.",
      criadoPor: "Sistema",
    },
  });
  await prisma.interacao.upsert({
    where: { id: "int-2" },
    update: {},
    create: {
      id: "int-2",
      leadId: "lead-1",
      tipo: "ligacao",
      descricao: "Ligação de qualificação realizada. Cliente confirmou interesse.",
      criadoPor: "João Santos",
    },
  });
  await prisma.interacao.upsert({
    where: { id: "int-3" },
    update: {},
    create: {
      id: "int-3",
      leadId: "lead-2",
      tipo: "whatsapp",
      descricao: "Primeiro contato. Cliente perguntou sobre casas disponíveis.",
      criadoPor: "Maria Oliveira",
    },
  });
  console.log("✅ Interações criadas");

  // ─── VISITAS ───────────────────────────────────────────────────────────────
  await prisma.visita.upsert({
    where: { id: "visita-1" },
    update: {},
    create: {
      id: "visita-1",
      leadId: "lead-2",
      imovelId: "imovel-1",
      corretorId: c1.id,
      clienteNome: "Ana Paula Santos",
      clienteTel: "(94) 9 9876-5432",
      agendadaPara: new Date("2026-06-15T10:00:00"),
      status: "agendada",
      notas: "Visita à casa 3 quartos no Ouro Preto.",
    },
  });
  await prisma.visita.upsert({
    where: { id: "visita-2" },
    update: {},
    create: {
      id: "visita-2",
      leadId: "lead-3",
      imovelId: "imovel-3",
      corretorId: c2.id,
      clienteNome: "Roberto Lima",
      clienteTel: "(94) 9 7654-3210",
      agendadaPara: new Date("2026-06-16T14:00:00"),
      status: "agendada",
      notas: "",
    },
  });
  await prisma.visita.upsert({
    where: { id: "visita-3" },
    update: {},
    create: {
      id: "visita-3",
      leadId: "lead-6",
      imovelId: "imovel-4",
      corretorId: c2.id,
      clienteNome: "Beatriz Santos",
      clienteTel: "(94) 9 7777-2222",
      agendadaPara: new Date("2026-05-20T09:00:00"),
      status: "realizada",
      notas: "Visita realizada com sucesso. Cliente fechou negócio.",
    },
  });
  console.log("✅ Visitas criadas");

  // ─── COMISSÕES ─────────────────────────────────────────────────────────────
  const comissoes = [
    { id: "com-1", corretorId: c1.id, imovel: "Residencial Ouro Preto", valor: 10500, percentual: 3, status: "paga", vencimento: new Date("2026-01-15"), pagamentoEm: new Date("2026-01-20") },
    { id: "com-2", corretorId: c1.id, imovel: "Casa Residencial Norte", valor: 12600, percentual: 3, status: "aprovada", vencimento: new Date("2026-02-28") },
    { id: "com-3", corretorId: c1.id, imovel: "Lote Vale Dourado", valor: 2700, percentual: 1.5, status: "pendente", vencimento: new Date("2026-03-15") },
    { id: "com-4", corretorId: c2.id, imovel: "Apartamento Centro", valor: 26700, percentual: 3, status: "paga", vencimento: new Date("2026-01-10"), pagamentoEm: new Date("2026-01-15") },
    { id: "com-5", corretorId: c2.id, imovel: "Casa Lançamento Centro", valor: 16800, percentual: 3, status: "aprovada", vencimento: new Date("2026-02-20") },
    { id: "com-6", corretorId: c2.id, imovel: "Sala Comercial", valor: 2400, percentual: 5, status: "paga", vencimento: new Date("2026-01-31"), pagamentoEm: new Date("2026-02-01") },
    { id: "com-7", corretorId: c3.id, imovel: "Casa MCMV Ouro Preto", valor: 6300, percentual: 3, status: "paga", vencimento: new Date("2026-02-15"), pagamentoEm: new Date("2026-02-18") },
    { id: "com-8", corretorId: c3.id, imovel: "Lote Novo Horizonte", valor: 5550, percentual: 3, status: "aprovada", vencimento: new Date("2026-03-10") },
  ];

  for (const com of comissoes) {
    await prisma.comissao.upsert({
      where: { id: com.id },
      update: {},
      create: com,
    });
  }
  console.log("✅ Comissões criadas");

  // ─── FINANCIAMENTOS ────────────────────────────────────────────────────────
  const financiamentos = [
    { id: "fin-1", clienteNome: "Carlos Mendes", clienteTel: "(94) 9 8888-1111", clienteEmail: "carlos@email.com", imovel: "Residencial Jardim Novo — Apto 204", tipo: "mcmv_faixa3", banco: "caixa", valorImovel: 280000, valorFinanciado: 250000, entrada: 30000, taxa: 5.5, prazo: 360, parcela: 1650, status: "documentacao", protocolo: "CEF-2026-001234", corretorId: c1.id },
    { id: "fin-2", clienteNome: "Beatriz Santos", clienteTel: "(94) 9 7777-2222", clienteEmail: "beatriz@email.com", imovel: "Casa Setor Bueno", tipo: "sbpe", banco: "bradesco", valorImovel: 560000, valorFinanciado: 420000, entrada: 140000, taxa: 9.8, prazo: 240, parcela: 4200, status: "avaliacao", protocolo: "BRD-2026-005678", corretorId: c2.id },
    { id: "fin-3", clienteNome: "Roberto Alves", clienteTel: "(94) 9 6666-3333", clienteEmail: "roberto@email.com", imovel: "Apto Alto da Glória", tipo: "mcmv_faixa2", banco: "caixa", valorImovel: 390000, valorFinanciado: 330000, entrada: 60000, taxa: 6.5, prazo: 360, parcela: 2280, status: "aprovado", protocolo: "CEF-2026-003456", corretorId: c1.id },
    { id: "fin-4", clienteNome: "Fernanda Lima", clienteTel: "(94) 9 5555-4444", clienteEmail: "fernanda@email.com", imovel: "Casa Jardim Novo", tipo: "mcmv_faixa1", banco: "caixa", valorImovel: 175000, valorFinanciado: 160000, entrada: 15000, taxa: 4.75, prazo: 360, parcela: 950, status: "liberado", protocolo: "CEF-2025-009012", corretorId: c3.id },
  ];

  for (const fin of financiamentos) {
    await prisma.financiamento.upsert({
      where: { id: fin.id },
      update: {},
      create: fin,
    });
  }

  // Checklist para o primeiro financiamento
  const checklistItems = [
    { id: "chk-1", financiamentoId: "fin-1", grupo: "pessoal", item: "RG / CNH", concluido: true },
    { id: "chk-2", financiamentoId: "fin-1", grupo: "pessoal", item: "CPF", concluido: true },
    { id: "chk-3", financiamentoId: "fin-1", grupo: "pessoal", item: "Comprovante de residência", concluido: true },
    { id: "chk-4", financiamentoId: "fin-1", grupo: "renda", item: "Holerite (3 meses)", concluido: true },
    { id: "chk-5", financiamentoId: "fin-1", grupo: "renda", item: "Declaração de IR", concluido: false },
    { id: "chk-6", financiamentoId: "fin-1", grupo: "renda", item: "Extrato bancário (3 meses)", concluido: false },
    { id: "chk-7", financiamentoId: "fin-1", grupo: "imovel", item: "Certidão de matrícula", concluido: false },
    { id: "chk-8", financiamentoId: "fin-1", grupo: "banco", item: "Extrato FGTS", concluido: true },
    { id: "chk-9", financiamentoId: "fin-1", grupo: "banco", item: "Laudo de avaliação", concluido: false },
  ];

  for (const item of checklistItems) {
    await prisma.checklistItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }
  console.log("✅ Financiamentos criados");

  // ─── OBRAS ─────────────────────────────────────────────────────────────────
  const obra1 = await prisma.obra.upsert({
    where: { id: "obra-1" },
    update: {},
    create: {
      id: "obra-1",
      nome: "Reforma Residencial Rua das Palmeiras",
      tipo: "reforma",
      status: "em_andamento",
      clienteNome: "Marcos Ferreira",
      clienteTel: "(94) 9 8877-5566",
      endereco: "Rua das Palmeiras, 234 — Ouro Preto, Canaã dos Carajás-PA",
      area: 180,
      valorTotal: 85000,
      valorPago: 42500,
      progresso: 58,
      engenheiroResp: "Eng. Pedro Lima",
      dataInicio: new Date("2026-02-01"),
      dataPrevisaoFim: new Date("2026-05-31"),
      descricao: "Reforma completa incluindo cozinha, banheiros e área de lazer.",
    },
  });

  const etapasObra1 = [
    { id: "etapa-1", obraId: obra1.id, nome: "Demolição e Preparação", status: "concluida", percentual: 100, ordem: 1 },
    { id: "etapa-2", obraId: obra1.id, nome: "Estrutura e Alvenaria", status: "concluida", percentual: 100, ordem: 2 },
    { id: "etapa-3", obraId: obra1.id, nome: "Instalações Elétricas", status: "concluida", percentual: 100, ordem: 3 },
    { id: "etapa-4", obraId: obra1.id, nome: "Instalações Hidráulicas", status: "concluida", percentual: 100, ordem: 4 },
    { id: "etapa-5", obraId: obra1.id, nome: "Revestimentos e Cerâmica", status: "em_andamento", percentual: 65, ordem: 5 },
    { id: "etapa-6", obraId: obra1.id, nome: "Pintura", status: "pendente", percentual: 0, ordem: 6 },
    { id: "etapa-7", obraId: obra1.id, nome: "Acabamentos e Entrega", status: "pendente", percentual: 0, ordem: 7 },
  ];

  for (const etapa of etapasObra1) {
    await prisma.obraEtapa.upsert({
      where: { id: etapa.id },
      update: {},
      create: etapa,
    });
  }

  await prisma.obra.upsert({
    where: { id: "obra-2" },
    update: {},
    create: {
      id: "obra-2",
      nome: "Construção Casa Térrea — Setor Norte",
      tipo: "residencial",
      status: "contratada",
      clienteNome: "Rodrigo e Carla Mendes",
      clienteTel: "(94) 9 7766-4455",
      endereco: "Quadra 3 Lote 12 — Residencial Norte, Canaã dos Carajás-PA",
      area: 220,
      valorTotal: 320000,
      valorPago: 64000,
      progresso: 5,
      engenheiroResp: "Eng. Fernanda Costa",
      dataInicio: new Date("2026-06-01"),
      dataPrevisaoFim: new Date("2027-02-28"),
      descricao: "Casa térrea 4 quartos, 2 suítes. Projeto aprovado.",
    },
  });

  await prisma.obra.upsert({
    where: { id: "obra-3" },
    update: {},
    create: {
      id: "obra-3",
      nome: "Reforma Comercial — Escritório Centro",
      tipo: "comercial",
      status: "concluida",
      clienteNome: "Empresa TechPA",
      clienteTel: "(94) 9 5544-3322",
      endereco: "Av. JK, 200 — Centro, Canaã dos Carajás-PA",
      area: 120,
      valorTotal: 45000,
      valorPago: 45000,
      progresso: 100,
      engenheiroResp: "Eng. Pedro Lima",
      dataInicio: new Date("2026-01-10"),
      dataConclusao: new Date("2026-03-15"),
      descricao: "Reforma completa do escritório com modernização do espaço.",
    },
  });
  console.log("✅ Obras criadas");

  // ─── PROJETOS ──────────────────────────────────────────────────────────────
  const projetos = [
    { id: "proj-1", nome: "Projeto Arquitetônico Residência Fernandes", tipo: "arquitetonico", status: "em_elaboracao", clienteNome: "Família Fernandes", clienteTel: "(94) 9 8899-1122", engenheiro: "Eng. Fernanda Costa", valorProjeto: 12000, valorPago: 6000, prazoEntrega: new Date("2026-05-30"), descricao: "Projeto arquitetônico completo para residência de alto padrão." },
    { id: "proj-2", nome: "Projeto Estrutural + Elétrico — Galpão", tipo: "completo", status: "entregue", clienteNome: "Indústria São Lucas", clienteTel: "(94) 3333-8899", engenheiro: "Eng. Pedro Lima", valorProjeto: 18500, valorPago: 18500, prazoEntrega: new Date("2025-08-31"), descricao: "Projeto estrutural e elétrico para galpão industrial." },
    { id: "proj-3", nome: "Projeto Elétrico Residência — Bairro Novo", tipo: "eletrico", status: "revisao", clienteNome: "João Pereira", clienteTel: "(94) 9 9977-5566", engenheiro: "Eng. Fernanda Costa", valorProjeto: 4500, valorPago: 2250, prazoEntrega: new Date("2026-04-30"), descricao: "Projeto elétrico residencial." },
  ];

  for (const proj of projetos) {
    await prisma.projeto.upsert({
      where: { id: proj.id },
      update: {},
      create: proj,
    });
  }
  console.log("✅ Projetos criados");

  // ─── REGULARIZAÇÕES ────────────────────────────────────────────────────────
  const reg1 = await prisma.regularizacao.upsert({
    where: { id: "reg-1" },
    update: {},
    create: {
      id: "reg-1",
      nome: "Averbação de Construção — Rua B",
      tipo: "averbacao",
      status: "em_andamento",
      clienteNome: "José Ferreira",
      clienteTel: "(94) 9 9988-7766",
      endereco: "Rua B, 45 — Ouro Preto, Canaã dos Carajás-PA",
      matricula: "CRI-12345",
      responsavel: "Ana Lima",
      valorServico: 3500,
      valorPago: 1750,
      previsaoFim: new Date("2026-07-31"),
      descricao: "Averbação de construção residencial no cartório.",
    },
  });

  const docReg1 = [
    { id: "rdoc-1", regularizacaoId: reg1.id, nome: "Certidão de matrícula", status: "obtido" },
    { id: "rdoc-2", regularizacaoId: reg1.id, nome: "Projeto aprovado na prefeitura", status: "obtido" },
    { id: "rdoc-3", regularizacaoId: reg1.id, nome: "IPTU quitado", status: "aprovado" },
    { id: "rdoc-4", regularizacaoId: reg1.id, nome: "Habite-se", status: "pendente" },
    { id: "rdoc-5", regularizacaoId: reg1.id, nome: "ART do responsável técnico", status: "obtido" },
  ];

  for (const doc of docReg1) {
    await prisma.regDocumento.upsert({
      where: { id: doc.id },
      update: {},
      create: doc,
    });
  }

  await prisma.regularizacao.upsert({
    where: { id: "reg-2" },
    update: {},
    create: {
      id: "reg-2",
      nome: "Usucapião Extrajudicial — Residencial Norte",
      tipo: "usucapiao",
      status: "coleta_docs",
      clienteNome: "Maria das Graças",
      clienteTel: "(94) 9 7766-5544",
      endereco: "Rua D, 78 — Residencial Norte, Canaã dos Carajás-PA",
      responsavel: "João Santos",
      valorServico: 8000,
      valorPago: 4000,
      previsaoFim: new Date("2026-12-31"),
      descricao: "Processo de usucapião extrajudicial para regularização de posse.",
    },
  });
  console.log("✅ Regularizações criadas");

  // ─── CONTRATOS ─────────────────────────────────────────────────────────────
  await prisma.contrato.upsert({
    where: { id: "cont-1" },
    update: {},
    create: {
      id: "cont-1",
      numero: "GSF-2026-001",
      tipo: "compra_venda",
      status: "ativo",
      parteA: "Grupo Santa Fé Imóveis",
      parteADoc: "00.000.000/0001-00",
      parteB: "Carlos Mendes",
      parteBDoc: "123.456.789-00",
      imovelId: "imovel-1",
      valor: 380000,
      vencimento: new Date("2026-12-31"),
      descricao: "Contrato de compra e venda de imóvel residencial.",
    },
  });

  await prisma.contrato.upsert({
    where: { id: "cont-2" },
    update: {},
    create: {
      id: "cont-2",
      numero: "GSF-2026-002",
      tipo: "corretagem",
      status: "ativo",
      parteA: "Grupo Santa Fé Imóveis",
      parteADoc: "00.000.000/0001-00",
      parteB: "Beatriz Santos",
      parteBDoc: "987.654.321-00",
      imovelId: "imovel-4",
      valor: 560000,
      descricao: "Contrato de intermediação imobiliária.",
    },
  });

  await prisma.contrato.upsert({
    where: { id: "cont-3" },
    update: {},
    create: {
      id: "cont-3",
      numero: "GSF-2026-003",
      tipo: "locacao",
      status: "ativo",
      parteA: "José Ferreira (Locador)",
      parteADoc: "111.222.333-44",
      parteB: "Roberto Lima (Locatário)",
      parteBDoc: "444.555.666-77",
      imovelId: "imovel-6",
      valor: 2500,
      vencimento: new Date("2027-06-30"),
      descricao: "Contrato de locação residencial — 12 meses.",
    },
  });
  console.log("✅ Contratos criados");

  // ─── AGREGADOR ─────────────────────────────────────────────────────────────
  const agregadorImoveis = [
    { id: "agr-1", titulo: "Casa 3/4 — Centro, bem localizada", preco: 220000, area: 110, tipo: "casa", bairro: "Centro", fonte: "olx", urlFonte: "https://olx.com.br/item/123", status: "verificado", documentoTipo: "escritura", contatoTel: "(94) 9 9988-1122" },
    { id: "agr-2", titulo: "Lote 300m² com documentação — Ouro Preto", preco: 95000, area: 300, tipo: "lote", bairro: "Ouro Preto", fonte: "zapimoveis", status: "verificado", documentoTipo: "loteamento", contatoTel: "(94) 9 7766-3344" },
    { id: "agr-3", titulo: "Casa reformada 2/4 — Vila dos Funcionários", preco: 165000, area: 80, tipo: "casa", bairro: "Vila dos Funcionários", fonte: "facebook", status: "pendente", documentoTipo: "contrato_gaveta", contatoTel: "(94) 9 8855-9900" },
    { id: "agr-4", titulo: "Chácara 2ha com casa — Zona Rural", preco: 380000, area: 20000, tipo: "chacara", bairro: "Zona Rural", fonte: "direto", status: "verificado", documentoTipo: "escritura", contatoTel: "(94) 9 9944-7788" },
    { id: "agr-5", titulo: "Lote comercial esquina — Vale Dourado", preco: 180000, area: 400, tipo: "lote", bairro: "Vale Dourado", fonte: "instagram", status: "pendente", documentoTipo: "loteamento", contatoTel: "(94) 9 6633-2211" },
  ];

  for (const item of agregadorImoveis) {
    await prisma.agregadorImovel.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }
  console.log("✅ Agregador criado");

  // ─── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  const configs = [
    { chave: "empresa_nome", valor: "Grupo Santa Fé", grupo: "empresa" },
    { chave: "empresa_cnpj", valor: "00.000.000/0001-00", grupo: "empresa" },
    { chave: "empresa_telefone", valor: "(94) 99304-4689", grupo: "empresa" },
    { chave: "empresa_email", valor: "comercial@gruposantafee.com.br", grupo: "empresa" },
    { chave: "empresa_endereco", valor: "Rua B N° 40 — Ouro Preto, Canaã dos Carajás-PA", grupo: "empresa" },
    { chave: "empresa_cep", valor: "68350-307", grupo: "empresa" },
    { chave: "notif_email", valor: "true", grupo: "notificacoes" },
    { chave: "notif_whatsapp", valor: "true", grupo: "notificacoes" },
    { chave: "comissao_percentual", valor: "6", grupo: "financeiro" },
    { chave: "prazo_resposta_lead", valor: "2", grupo: "operacional" },
  ];

  for (const config of configs) {
    await prisma.configuracao.upsert({
      where: { chave: config.chave },
      update: {},
      create: { ...config, id: `cfg-${config.chave}` },
    });
  }
  console.log("✅ Configurações criadas");

  console.log("✅ Seed concluído com sucesso!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
