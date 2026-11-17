import "server-only";
// Paridade 17/11 bloco 4 — termo de consentimento (gêmeo de Prospecta/server/consentimento.ts, EPIC-024 S-12 + retirada).
//
// Primeiro acesso no Santa Fé: o link /definir-senha/[token] só existe para conta NOVA (criarUsuario sem senha e
// vincularUsuarioCorretor); a redefinição de senha é feita pelo admin direto (redefinirSenha), sem link. Então:
//   - no link: aceite da versão vigente → "aceito" (a caixa não aparece); aceite de versão anterior → "opcional";
//     nenhum aceite → "obrigatorio" (o servidor recusa a senha sem a caixa marcada);
//   - a senha e o aceite são gravados NA MESMA TRANSAÇÃO; a senha só é gravada se o token ainda vale.
// Conta criada pelo admin já com senha (criarUsuario com senha, cadastro de corretor em /admin/corretores/novo) a partir
// de INICIO_DO_TERMO: aceita no PRIMEIRO LOGIN (modal nas áreas logadas). A redefinição de senha não pede de novo.
// Opção "pedir o aceite uma vez no próximo login" (para TODOS): DESLIGADA; liga com CONSENTIMENTO_PEDIR_NO_LOGIN=1.
// Retirada: linha nova de tipo "revogacao" (admin em Configurações › Termo de consentimento, ou o próprio titular na
// página do termo). Só contam os aceites DEPOIS da última retirada: quem retirou volta a ver o termo ao entrar.
// LIMITAÇÃO (igual à Prospecta): o servidor não bloqueia as demais rotas de quem ainda não aceitou; a trava é o modal.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  MENSAGEM_SEM_ACEITE, MENSAGEM_SEM_CONSENTIMENTO_ATIVO, MENSAGEM_VERSAO_ERRADA, VERSAO_DO_TERMO,
  type AparelhoDoConsentimento, type CanalDoConsentimento, type TipoDoConsentimento,
} from "@/lib/termo-consentimento";

/** A partir desta data (17/11/2026, 00:00 UTC) toda conta nova passa pelo termo. Mesma data da Prospecta. */
export const INICIO_DO_TERMO = new Date("2026-11-17T00:00:00Z");
export const MENSAGEM_FALHA_AO_VERIFICAR = "Não foi possível verificar agora; tente de novo em instantes.";

type Banco = Pick<typeof prisma, "consentimento"> | Prisma.TransactionClient;

export class ErroDoTermo extends Error {}

export function pedirAceiteNoLogin(env: Record<string, string | undefined> = process.env): boolean {
  return env.CONSENTIMENTO_PEDIR_NO_LOGIN === "1";
}

/** Resumo técnico mínimo: só a categoria do aparelho; o user-agent em si não é guardado. */
export function aparelhoDoUserAgent(ua: string | undefined | null): AparelhoDoConsentimento {
  if (!ua) return "desconhecido";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "celular";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "computador";
  return "desconhecido";
}

export type EventoDoTermo = { tipo: string; versao: string; em: Date; id: number };
export type AceitesDoUsuario = { atual: boolean; algum: boolean; retirado: boolean };

/** Só contam os aceites depois da última retirada; `retirado` = o último registro é uma retirada. */
export function situacaoDosRegistros(eventos: readonly EventoDoTermo[]): AceitesDoUsuario {
  const ordenados = [...eventos].sort((a, b) => a.em.getTime() - b.em.getTime() || a.id - b.id);
  let ultimaRetirada = -1;
  ordenados.forEach((e, i) => { if (e.tipo === "revogacao") ultimaRetirada = i; });
  const validos = ordenados.slice(ultimaRetirada + 1).filter(e => e.tipo === "aceite");
  return {
    atual: validos.some(e => e.versao === VERSAO_DO_TERMO),
    algum: validos.length > 0,
    retirado: ordenados.length > 0 && ordenados[ordenados.length - 1].tipo === "revogacao",
  };
}

export async function aceitesDoUsuario(usuarioId: string, db: Banco = prisma): Promise<AceitesDoUsuario> {
  const linhas = await db.consentimento.findMany({ where: { usuarioId }, select: { tipo: true, versaoTermo: true, registradoEm: true, id: true } });
  return situacaoDosRegistros(linhas.map(l => ({ tipo: l.tipo, versao: l.versaoTermo, em: l.registradoEm, id: l.id })));
}

export type SituacaoDoTermo = "aceito" | "obrigatorio" | "opcional";

/** No link de primeiro acesso (só existe para conta nova): sem aceite válido, o aceite é obrigatório. */
export function situacaoNoLink(aceites: AceitesDoUsuario): SituacaoDoTermo {
  if (aceites.atual) return "aceito";
  if (aceites.algum) return "opcional";
  return "obrigatorio";
}

/** Confere o aceite enviado pela tela. Devolve se o aceite deve ser gravado; lança ErroDoTermo quando não vale. */
export function conferirAceite(situacao: SituacaoDoTermo, aceitouTermo: boolean | undefined, versaoDoTermo: string | undefined): boolean {
  const marcou = aceitouTermo === true;
  if (marcou && versaoDoTermo !== VERSAO_DO_TERMO) throw new ErroDoTermo(MENSAGEM_VERSAO_ERRADA);
  if (situacao === "obrigatorio" && !marcou) throw new ErroDoTermo(MENSAGEM_SEM_ACEITE);
  return marcou && situacao !== "aceito";
}

/** Com a opção ligada: falta a versão vigente. Desligada: falta qualquer aceite. */
export function precisaAceitarNoLogin(aceites: AceitesDoUsuario, pedirATodos: boolean): boolean {
  return pedirATodos ? !aceites.atual : !aceites.algum;
}

export function contaCriadaNoTermo(criadoEm: Date | null | undefined, inicio = INICIO_DO_TERMO): boolean {
  return !!criadoEm && criadoEm.getTime() >= inicio.getTime();
}

/** O modal deve aparecer? Conta nova sem aceite, conta que retirou, ou (opção ligada) sem a versão vigente. */
export async function situacaoNoLogin(usuario: { id: string; criadoEm: Date }, db: Banco = prisma): Promise<{ pedir: boolean; versao: string }> {
  const aceites = await aceitesDoUsuario(usuario.id, db);
  const todos = pedirAceiteNoLogin();
  if (aceites.retirado) return { pedir: true, versao: VERSAO_DO_TERMO };
  if (!todos && !contaCriadaNoTermo(usuario.criadoEm)) return { pedir: false, versao: VERSAO_DO_TERMO };
  return { pedir: precisaAceitarNoLogin(aceites, todos), versao: VERSAO_DO_TERMO };
}

export async function registrarAceite(db: Banco, dados: { usuarioId: string; canal: Extract<CanalDoConsentimento, "definir_senha" | "login">; aparelho: AparelhoDoConsentimento; comSenha: boolean }) {
  await db.consentimento.create({ data: { usuarioId: dados.usuarioId, versaoTermo: VERSAO_DO_TERMO, canal: dados.canal, aparelho: dados.aparelho, comSenha: dados.comSenha, tipo: "aceite" satisfies TipoDoConsentimento } });
}

/** Retirada: linha nova de tipo "revogacao" (nada é alterado nem apagado). Exige consentimento ativo. */
export async function registrarRetirada(dados: {
  usuarioId: string; registradoPor: string; canal: Extract<CanalDoConsentimento, "admin" | "conta">; aparelho?: AparelhoDoConsentimento;
}, db: Banco = prisma): Promise<void> {
  const situacao = await aceitesDoUsuario(dados.usuarioId, db);
  if (!situacao.algum) throw new ErroDoTermo(MENSAGEM_SEM_CONSENTIMENTO_ATIVO);
  await db.consentimento.create({ data: {
    usuarioId: dados.usuarioId, versaoTermo: VERSAO_DO_TERMO, canal: dados.canal, aparelho: dados.aparelho ?? "desconhecido",
    comSenha: false, tipo: "revogacao" satisfies TipoDoConsentimento, registradoPor: dados.registradoPor,
  } });
}

/** Aceite pelo modal do login. Devolve `jaAceito` quando não havia nada a aceitar. */
export async function aceitarNoLogin(usuario: { id: string; criadoEm: Date }, aceitouTermo: boolean, versaoDoTermo: string, aparelho: AparelhoDoConsentimento, db: Banco = prisma) {
  const aceites = await aceitesDoUsuario(usuario.id, db);
  const todos = pedirAceiteNoLogin();
  if (!todos && !aceites.retirado && !contaCriadaNoTermo(usuario.criadoEm)) throw new ErroDoTermo("O pedido de aceite no login está desligado.");
  if (!precisaAceitarNoLogin(aceites, todos)) return { jaAceito: true };
  conferirAceite("obrigatorio", aceitouTermo, versaoDoTermo);
  await registrarAceite(db, { usuarioId: usuario.id, canal: "login", aparelho, comSenha: false });
  return { jaAceito: false };
}

type LinhaDoResumo = { usuarioId: string; tipo: string; versaoTermo: string; registradoEm: Date; canal: string; registradoPor: string | null; id: number };
export type SituacaoNoResumo = {
  usuarioId: string; versao: string | null; aceitoEm: Date | null; canal: string | null; aceitouVersaoAtual: boolean;
  retirado: boolean; retiradoEm: Date | null; retiradoPor: string | null; retiradoPeloTitular: boolean;
};

/** Por usuário: último aceite, se cobre a versão vigente e a retirada (quando e quem registrou). */
export function resumoPorUsuario(linhas: readonly LinhaDoResumo[]): SituacaoNoResumo[] {
  const porUsuario = new Map<string, LinhaDoResumo[]>();
  for (const l of linhas) porUsuario.set(l.usuarioId, [...(porUsuario.get(l.usuarioId) ?? []), l]);
  return Array.from(porUsuario.entries()).map(([usuarioId, eventos]) => {
    const ordenados = [...eventos].sort((a, b) => a.registradoEm.getTime() - b.registradoEm.getTime() || a.id - b.id);
    const situacao = situacaoDosRegistros(ordenados.map(e => ({ tipo: e.tipo, versao: e.versaoTermo, em: e.registradoEm, id: e.id })));
    const ultimoAceite = [...ordenados].reverse().find(e => e.tipo === "aceite");
    const ultimaRetirada = [...ordenados].reverse().find(e => e.tipo === "revogacao");
    return {
      usuarioId,
      versao: ultimoAceite?.versaoTermo ?? null,
      aceitoEm: ultimoAceite?.registradoEm ?? null,
      canal: ultimoAceite?.canal ?? null,
      aceitouVersaoAtual: situacao.atual,
      retirado: situacao.retirado,
      retiradoEm: situacao.retirado ? ultimaRetirada!.registradoEm : null,
      retiradoPor: situacao.retirado ? ultimaRetirada!.registradoPor : null,
      retiradoPeloTitular: situacao.retirado ? ultimaRetirada!.canal === "conta" : false,
    };
  });
}

const PAPEIS = ["admin", "colaborador", "corretor", "cliente", "empreiteiro"] as const;

/** Consulta do admin: aceites por papel e por usuário, com a retirada. Só leitura. */
export async function resumoDoTermoParaAdmin(db: Pick<typeof prisma, "consentimento" | "usuario"> = prisma) {
  const [linhas, usuarios] = await Promise.all([
    db.consentimento.findMany({ select: { usuarioId: true, tipo: true, versaoTermo: true, registradoEm: true, canal: true, registradoPor: true, id: true } }),
    db.usuario.findMany({ select: { id: true, nome: true, email: true, papel: true }, orderBy: { nome: "asc" } }),
  ]);
  const situacoes = new Map(resumoPorUsuario(linhas).map(s => [s.usuarioId, s]));
  const nomeDe = new Map(usuarios.map(u => [u.id, u.nome]));
  const porPapel = PAPEIS.map(papel => {
    const doPapel = usuarios.filter(u => u.papel === papel);
    const sit = doPapel.map(u => situacoes.get(u.id));
    return {
      papel,
      usuarios: doPapel.length,
      aceitaramVersaoAtual: sit.filter(s => s?.aceitouVersaoAtual).length,
      aceitaramVersaoAnterior: sit.filter(s => s && !s.retirado && s.aceitoEm && !s.aceitouVersaoAtual).length,
      retirados: sit.filter(s => s?.retirado).length,
      semAceite: sit.filter(s => !s || (!s.aceitoEm && !s.retirado)).length,
    };
  });
  const porVersao = new Map<string, Set<string>>();
  for (const l of linhas) if (l.tipo === "aceite") porVersao.set(l.versaoTermo, (porVersao.get(l.versaoTermo) ?? new Set()).add(l.usuarioId));
  return {
    versaoAtual: VERSAO_DO_TERMO,
    pedirNoLogin: pedirAceiteNoLogin(),
    porPapel,
    porVersao: Array.from(porVersao.entries()).map(([versao, s]) => ({ versao, usuarios: s.size })).sort((a, b) => b.versao.localeCompare(a.versao)),
    usuarios: usuarios.map(u => {
      const s = situacoes.get(u.id);
      return {
        id: u.id, nome: u.nome, email: u.email, papel: u.papel,
        versao: s?.versao ?? null, aceitoEm: s?.aceitoEm ?? null, aceitouVersaoAtual: s?.aceitouVersaoAtual ?? false,
        retirado: s?.retirado ?? false, retiradoEm: s?.retiradoEm ?? null,
        retiradoPorNome: s?.retiradoPor ? nomeDe.get(s.retiradoPor) ?? "usuário excluído" : null,
        retiradoPeloTitular: s?.retiradoPeloTitular ?? false,
      };
    }),
  };
}
