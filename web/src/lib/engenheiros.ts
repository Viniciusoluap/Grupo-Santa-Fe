// Lote 2, correção 04 (AD-02): perfil Engenheiro (colaborador + dados profissionais).
// Consulta e gravação no banco; regras puras em ./engenheiro.ts. Mesma regra no
// Prospecta (server/usuario-documentos.ts).
import { prisma } from "@/lib/db";
import { lerCreasAdicionais, type CreaAdicional, type PerfilEngenheiroDados } from "@/lib/engenheiro";

export type EngenheiroOpcao = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  /** true = perfil Engenheiro ativo (colaborador com dados profissionais). */
  engenheiro: boolean;
  telefone: string | null;
  crea: string | null;
  creaUf: string | null;
  creasAdicionais: CreaAdicional[];
};

/**
 * Pessoas que podem ser escolhidas como engenheiro responsável (Projetos e, nas
 * próximas ondas, Obras, Gerador de PCI e Incorporação): colaboradores e admins
 * ativos, com os dados do perfil Engenheiro quando houver. `apenasEngenheiros`
 * restringe a quem tem o perfil ativo. CREA ausente vem null — nunca inventado.
 */
export async function listarEngenheiros(opcoes: { apenasEngenheiros?: boolean } = {}): Promise<EngenheiroOpcao[]> {
  const linhas = await prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["colaborador", "admin"] } },
    select: { id: true, nome: true, email: true, papel: true, telefone: true, perfilEngenheiro: true },
    orderBy: { nome: "asc" },
  });
  return linhas
    .map((u) => {
      const p = u.perfilEngenheiro?.ativo ? u.perfilEngenheiro : null;
      return {
        id: u.id, nome: u.nome, email: u.email, papel: u.papel,
        engenheiro: u.papel === "colaborador" && !!p,
        telefone: p?.telefone || u.telefone || null,
        crea: p?.crea ?? null,
        creaUf: p?.creaUf ?? null,
        creasAdicionais: p ? lerCreasAdicionais(p.creasAdicionais) : [],
      };
    })
    .filter((e) => !opcoes.apenasEngenheiros || e.engenheiro);
}

/** Dados de UM engenheiro para preencher RTP/RTE da PCI (paridade 17/11, Prospecta EPIC-024 S-09). */
export type EngenheiroParaPci = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  crea: string | null;
  creaUf: string | null;
  cpf: string | null;
  /** true = perfil Engenheiro ativo; false = sem perfil ou desativado (CPF/CREA não usados). */
  perfilAtivo: boolean;
  temPerfil: boolean;
};

/**
 * Paridade 17/11 (pedido do dono de 16/11 na Prospecta, substitui a decisão de 30/10 só para o CPF do próprio
 * engenheiro): CPF, CREA e telefone do perfil de UM engenheiro, para a PCI. Mesmas regras de `listarEngenheiros`
 * (usuário ativo, colaborador ou admin; dados do perfil só com o perfil ativo). A lista continua sem CPF.
 * Chamar só depois da checagem do módulo Obras (Gerador de PCI).
 */
export async function dadosEngenheiroParaPci(usuarioId: string): Promise<EngenheiroParaPci | null> {
  const u = await prisma.usuario.findFirst({
    where: { id: usuarioId, ativo: true, papel: { in: ["colaborador", "admin"] } },
    select: { id: true, nome: true, email: true, telefone: true, perfilEngenheiro: { select: { ativo: true, telefone: true, cpf: true, crea: true, creaUf: true } } },
  });
  if (!u) return null;
  const p = u.perfilEngenheiro;
  const ativo = p?.ativo === true;
  return {
    id: u.id, nome: u.nome, email: u.email,
    telefone: (ativo ? p?.telefone : null) || u.telefone || null,
    crea: ativo ? p?.crea ?? null : null,
    creaUf: ativo ? p?.creaUf ?? null : null,
    cpf: ativo ? p?.cpf ?? null : null,
    perfilAtivo: ativo,
    temPerfil: !!p,
  };
}

/** Grava (ou reativa) o perfil Engenheiro. Só chamar depois da checagem de admin. */
export async function gravarPerfilEngenheiro(usuarioId: string, dados: PerfilEngenheiroDados, autorId: string | null) {
  const valores = {
    ...(dados.cpf !== undefined ? { cpf: dados.cpf } : {}),
    ativo: true, telefone: dados.telefone, cep: dados.cep, logradouro: dados.logradouro, numero: dados.numero,
    complemento: dados.complemento, bairro: dados.bairro, cidade: dados.cidade, uf: dados.uf,
    crea: dados.crea, creaUf: dados.creaUf, creasAdicionais: dados.creasAdicionais, atualizadoPorId: autorId,
  };
  await prisma.perfilEngenheiro.upsert({ where: { usuarioId }, create: { usuarioId, ...valores }, update: valores });
}

/** Liga/desliga o perfil sem apagar os dados (trocar de perfil não perde CREA nem endereço). */
export async function definirPerfilEngenheiroAtivo(usuarioId: string, ativo: boolean, autorId: string | null) {
  if (ativo) {
    await prisma.perfilEngenheiro.upsert({ where: { usuarioId }, create: { usuarioId, ativo: true, atualizadoPorId: autorId }, update: { ativo: true, atualizadoPorId: autorId } });
  } else {
    await prisma.perfilEngenheiro.updateMany({ where: { usuarioId }, data: { ativo: false, atualizadoPorId: autorId } });
  }
}
