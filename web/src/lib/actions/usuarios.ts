"use server";
import { exigirAdminAtivo, IDS_MODULOS_PAINEL } from "@/lib/auth/modulos";
import { ehPerfil, normalizarPermissoes } from "@/lib/perfis-acesso";
import { sendEmail } from "@/lib/email";
import { deveBloquearDesativacaoUltimoAdmin } from "@/lib/auth/admin-guard";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { validarPerfilEngenheiro } from "@/lib/engenheiro";
import { definirPerfilEngenheiroAtivo } from "@/lib/engenheiros";
import { lerPercentualComissao } from "@/lib/comissoes/percentual-comissao";
import { lerConvite, lerObservacoesCorretor } from "@/lib/usuarios/corretor-cadastro";

const TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function linkPrimeiroAcesso(token: string) {
  const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://www.gruposantafee.com.br";
  return `${base.replace(/\/$/, "")}/definir-senha/${token}`;
}

/** Envia o link de primeiro acesso; nunca lança (sem SMTP o admin recebe o link para repassar). */
async function enviarLinkPrimeiroAcesso(nome: string, email: string, link: string): Promise<boolean> {
  const html = `<p>Olá, ${nome.replace(/[<>&"]/g, "")}!</p><p>Sua conta no sistema do Grupo Santa Fé foi criada. Para acessar, defina sua senha pelo link abaixo (válido por 7 dias):</p><p><a href="${link}">${link}</a></p><p>© ${new Date().getFullYear()} Grupo Santa Fé</p>`;
  return sendEmail({ to: email, subject: "Grupo Santa Fé — defina sua senha de acesso", html });
}

/**
 * Item 05: cadastro dos cinco perfis com vínculo real.
 * - corretor: cria (ou liga) o cadastro de Corretor com CRECI;
 * - cliente: liga a conta ao lead do CRM (um lead, uma conta);
 * - colaborador: módulos liberados pelo admin;
 * - empreiteiro: obras são atribuídas na própria obra;
 * - admin: acesso completo.
 * Sem senha digitada, a conta nasce com link de primeiro acesso.
 */
export async function criarUsuario(formData: FormData) {
  const admin = await exigirAdminAtivo();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  // Lote 2, correção 04: "Engenheiro" = colaborador (módulos) + perfil profissional.
  const engenheiro = String(formData.get("papel") ?? "") === "engenheiro";
  const papel = engenheiro ? "colaborador" : String(formData.get("papel") ?? "");
  const creci = String(formData.get("creci") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const leadId = String(formData.get("leadId") ?? "").trim() || null;
  const perfilEngenheiro = engenheiro ? validarPerfilEngenheiro({ telefone, crea: formData.get("crea"), creaUf: formData.get("creaUf") }) : null;
  if (perfilEngenheiro && !perfilEngenheiro.ok) return { error: perfilEngenheiro.erro };

  if (!nome || !email || !papel) return { error: "Preencha nome, e-mail e perfil." };
  if (!ehPerfil(papel)) return { error: "Perfil inválido." };
  if (senha && senha.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres (ou deixe em branco para enviar o link de primeiro acesso)." };
  if (papel === "corretor" && (!creci || !telefone)) return { error: "Corretor exige CRECI e telefone." };
  if (papel === "cliente" && !leadId) return { error: "Escolha o cliente do CRM a que esta conta pertence." };
  // Paridade 17/11 (EPIC-023 S-A da Prospecta): comissão padrão, observações e cadastro sem convite vieram da
  // antiga tela "Corretores". Só o corretor pode nascer sem o e-mail de senha (o link sai depois, pelo botão "Link").
  let percentualComissao: string | null = null;
  let observacoes = "";
  if (papel === "corretor") {
    try {
      percentualComissao = lerPercentualComissao(formData.get("percentualComissaoPadrao"));
      observacoes = lerObservacoesCorretor(formData.get("observacoes"));
    } catch (e) { return { error: (e as Error).message }; }
  }
  const convidar = papel !== "corretor" || lerConvite(formData.get("enviarConvite"));

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return { error: "E-mail já cadastrado." };

  const permissoes = normalizarPermissoes(papel, formData.getAll("permissoes"), IDS_MODULOS_PAINEL);
  const token = senha || !convidar ? null : crypto.randomBytes(32).toString("hex");
  const hash = await bcrypt.hash(senha || crypto.randomBytes(32).toString("hex"), 10);

  try {
    await prisma.$transaction(async (tx) => {
      // Item 12 (18/10): conta de cliente usa nome e telefone do cadastro no CRM.
      let nomeConta = nome;
      let telefoneConta = telefone;
      if (papel === "cliente") {
        const lead = await tx.lead.findUnique({ where: { id: leadId! }, select: { nome: true, telefone: true, excluidoEm: true, contaCliente: { select: { id: true } } } });
        if (!lead || lead.excluidoEm) throw new Error("Cliente do CRM não encontrado.");
        if (lead.contaCliente) throw new Error("Este cliente do CRM já tem uma conta de acesso.");
        nomeConta = lead.nome || nome;
        telefoneConta = lead.telefone || telefone;
      }
      const usuario = await tx.usuario.create({
        data: {
          nome: nomeConta, email, senha: hash, papel, creci: papel === "corretor" ? creci : null, telefone: telefoneConta,
          permissoes: JSON.stringify(permissoes),
          leadId: papel === "cliente" ? leadId : null,
          tokenPrimeiroAcesso: token,
          tokenPrimeiroAcessoExpira: token ? new Date(Date.now() + TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS) : null,
        },
      });
      if (papel === "corretor") {
        // Não duplica: liga um cadastro de corretor já existente (mesmo e-mail) sem conta.
        const corretor = await tx.corretor.findUnique({ where: { email }, select: { id: true, usuarioId: true } });
        if (corretor?.usuarioId) throw new Error("Já existe um corretor com este e-mail ligado a outra conta.");
        const dadosCorretor = {
          ...(observacoes ? { observacoes } : {}),
          ...(percentualComissao ? { regraComissao: corretor
            ? { upsert: { create: { percentual: percentualComissao }, update: { percentual: percentualComissao } } }
            : { create: { percentual: percentualComissao } } } : {}),
        };
        if (corretor) await tx.corretor.update({ where: { id: corretor.id }, data: { usuarioId: usuario.id, creci: creci!, telefone: telefone!, ...dadosCorretor } });
        else await tx.corretor.create({ data: { nome, email, telefone: telefone!, creci: creci!, usuarioId: usuario.id, ...dadosCorretor } });
      }
      if (perfilEngenheiro?.ok) {
        const d = perfilEngenheiro.dados;
        await tx.perfilEngenheiro.create({ data: { usuarioId: usuario.id, ativo: true, telefone: d.telefone, crea: d.crea, creaUf: d.creaUf, creasAdicionais: [], atualizadoPorId: admin.id } });
      }
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Não foi possível cadastrar." };
  }

  revalidatePath("/admin/configuracoes");
  if (!convidar && !senha) return { success: true, convidado: false };
  if (!token) return { success: true };
  const link = linkPrimeiroAcesso(token);
  const emailEnviado = await enviarLinkPrimeiroAcesso(nome, email, link);
  return { success: true, link, emailEnviado };
}

/**
 * Item 05/06: troca de perfil (e do vínculo de cliente). A sessão antiga do
 * usuário é encerrada (sessionVersion) e as permissões de colaborador só ficam
 * para colaborador.
 */
export async function alterarPerfilUsuario(id: string, papelEscolhido: string, leadId: string | null = null) {
  const admin = await exigirAdminAtivo();
  // Lote 2, correção 04: "Engenheiro" = colaborador + perfil profissional (dados preservados ao trocar).
  const engenheiro = papelEscolhido === "engenheiro";
  const papel = engenheiro ? "colaborador" : papelEscolhido;
  if (!ehPerfil(papel)) return { error: "Perfil inválido." };
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { id: true, papel: true, ativo: true, permissoes: true, corretor: { select: { id: true } } } });
  if (!alvo) return { error: "Usuário não encontrado." };
  if (alvo.id === admin.id && papel !== "admin") return { error: "Você não pode remover o seu próprio acesso de administrador." };
  if (alvo.papel === "admin" && papel !== "admin") {
    const bloqueado = await bloquearSeUltimoAdminAtivo(id);
    if (bloqueado) return bloqueado;
  }
  if (papel === "corretor" && !alvo.corretor) return { error: "Para virar corretor, crie a conta como Corretor (com CRECI) em Usuários e acesso." };
  let dadosDoLead: { nome: string; telefone: string } | null = null;
  if (papel === "cliente") {
    if (!leadId) return { error: "Escolha o cliente do CRM a que esta conta pertence." };
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nome: true, telefone: true, excluidoEm: true, contaCliente: { select: { id: true } } } });
    if (!lead || lead.excluidoEm) return { error: "Cliente do CRM não encontrado." };
    if (lead.contaCliente && lead.contaCliente.id !== id) return { error: "Este cliente do CRM já tem uma conta de acesso." };
    dadosDoLead = { nome: lead.nome, telefone: lead.telefone };
  }
  await prisma.usuario.update({
    where: { id },
    data: {
      papel,
      // Item 12 (18/10): nome e telefone acompanham o cliente do CRM.
      ...(dadosDoLead ? { nome: dadosDoLead.nome || undefined, telefone: dadosDoLead.telefone || null } : {}),
      leadId: papel === "cliente" ? leadId : null,
      permissoes: papel === "colaborador" ? alvo.permissoes : "[]",
      sessionVersion: { increment: 1 },
    },
  });
  await definirPerfilEngenheiroAtivo(id, engenheiro, admin.id);
  revalidatePath("/admin/configuracoes");
  return { success: true };
}

// Protege contra lockout administrativo: a UI ja desabilita o botao para
// usuarios com papel=admin, mas isso e so client-side (nao substitui
// autorizacao no servidor) - uma chamada direta a esta action sem essa guarda
// permitiria desativar/excluir o ultimo admin ativo e travar o acesso
// administrativo do sistema para sempre.
async function bloquearSeUltimoAdminAtivo(id: string): Promise<{ error: string } | null> {
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { papel: true, ativo: true } });
  const adminsAtivos = await prisma.usuario.count({ where: { papel: "admin", ativo: true } });
  if (deveBloquearDesativacaoUltimoAdmin(alvo, adminsAtivos)) {
    return { error: "Não é possível desativar/excluir o último administrador ativo" };
  }
  return null;
}

export async function alternarAtivo(id: string, ativo: boolean) {
  await exigirAdminAtivo();
  if (!ativo) {
    const bloqueado = await bloquearSeUltimoAdminAtivo(id);
    if (bloqueado) return bloqueado;
  }
  await prisma.usuario.update({ where: { id }, data: { ativo } });
  revalidatePath("/admin/configuracoes");
}

export async function redefinirSenha(formData: FormData) {
  await exigirAdminAtivo();
  const id = formData.get("id") as string;
  const novaSenha = formData.get("novaSenha") as string;
  if (!id || !novaSenha || novaSenha.length < 6) return { error: "Senha inválida (mín. 6 caracteres)" };

  const hash = await bcrypt.hash(novaSenha, 10);
  // Incrementa sessionVersion: qualquer sessao JWT ja emitida para este usuario
  // (por exemplo, de alguem que tinha acesso indevido) e invalidada no proximo
  // request - ver comentario em auth.ts sobre por que isso nao acontecia antes.
  await prisma.usuario.update({ where: { id }, data: { senha: hash, sessionVersion: { increment: 1 } } });
  revalidatePath("/admin/configuracoes");
}

export async function excluirUsuario(id: string) {
  await exigirAdminAtivo();
  const bloqueado = await bloquearSeUltimoAdminAtivo(id);
  if (bloqueado) return bloqueado;
  await prisma.usuario.delete({ where: { id } });
  // Pedido de 29/10: Equipe/<Nome (nº)> vai para a lixeira do Drive depois da exclusão no banco.
  const { lixeiraDaPasta } = await import("@/lib/drive-organizacao");
  const { chaveEquipe } = await import("@/lib/drive-estrutura");
  await lixeiraDaPasta(chaveEquipe(id));
  revalidatePath("/admin/configuracoes");
}

// Corretores cadastrados antes da correção do ciclo de identidade (S-01) ficaram
// sem Usuario vinculado — nenhum deles consegue logar. Esta action cria o Usuario
// com uma senha placeholder inutilizável (nunca entregue a ninguém) e um token de
// primeiro acesso: o próprio corretor define a senha real em /definir-senha/[token],
// em vez do admin ter que inventar e repassar uma senha.
export async function vincularUsuarioCorretor(corretorId: string) {
  await exigirAdminAtivo();

  const corretor = await prisma.corretor.findUnique({ where: { id: corretorId } });
  if (!corretor) return { error: "Corretor não encontrado" };
  if (corretor.usuarioId) return { error: "Este corretor já tem uma conta vinculada" };

  const existe = await prisma.usuario.findUnique({ where: { email: corretor.email } });
  if (existe) return { error: "Já existe um usuário com este e-mail" };

  const token = crypto.randomBytes(32).toString("hex");
  const senhaPlaceholder = crypto.randomBytes(32).toString("hex");
  const hash = await bcrypt.hash(senhaPlaceholder, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome: corretor.nome,
      email: corretor.email,
      senha: hash,
      papel: "corretor",
      creci: corretor.creci,
      telefone: corretor.telefone,
      tokenPrimeiroAcesso: token,
      tokenPrimeiroAcessoExpira: new Date(Date.now() + TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS),
    },
  });

  await prisma.corretor.update({ where: { id: corretorId }, data: { usuarioId: usuario.id } });

  revalidatePath("/admin/configuracoes");
  return { success: true, token };
}

export async function salvarPermissoes(id: string, permissoes: string[]) {
  await exigirAdminAtivo();
  // Item 06: só colaborador guarda permissões; módulos desconhecidos são descartados.
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { papel: true } });
  if (!alvo) return { error: "Usuário não encontrado." };
  await prisma.usuario.update({
    where: { id },
    data: { permissoes: JSON.stringify(normalizarPermissoes(alvo.papel, permissoes, IDS_MODULOS_PAINEL)) },
  });
  revalidatePath("/admin/configuracoes");
}

/**
 * Paridade 17/11 (EPIC-023 S-A da Prospecta): o que a antiga tela "Corretores" editava passa para "Usuários e
 * acesso", só para o admin — nome, e-mail, telefone, CRECI, situação do cadastro, comissão padrão (vazio = sem
 * regra) e observações. Vale também para corretor ainda sem conta de acesso. Com conta, nome/e-mail/telefone/CRECI
 * acompanham o login (são a mesma pessoa).
 */
export async function salvarDadosCorretor(formData: FormData) {
  await exigirAdminAtivo();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const creci = String(formData.get("creci") ?? "").trim();
  if (!id) return { error: "Corretor não encontrado." };
  if (!nome || !email || !creci || !telefone) return { error: "Nome, CRECI, telefone e e-mail são obrigatórios." };
  let percentual: string | null;
  let observacoes: string;
  try {
    percentual = lerPercentualComissao(formData.get("percentualComissaoPadrao"));
    observacoes = lerObservacoesCorretor(formData.get("observacoes"));
  } catch (e) { return { error: (e as Error).message }; }
  const ativo = formData.get("ativo") === "true";

  const corretor = await prisma.corretor.findUnique({ where: { id }, select: { id: true, usuarioId: true } });
  if (!corretor) return { error: "Corretor não encontrado." };
  const [outroCorretor, outroUsuario] = await Promise.all([
    prisma.corretor.findFirst({ where: { email, id: { not: id } }, select: { id: true } }),
    prisma.usuario.findFirst({ where: { email, ...(corretor.usuarioId ? { id: { not: corretor.usuarioId } } : {}) }, select: { id: true } }),
  ]);
  if (outroCorretor || outroUsuario) return { error: "E-mail já cadastrado." };

  await prisma.$transaction([
    prisma.corretor.update({ where: { id }, data: { nome, email, telefone, creci, ativo, observacoes } }),
    percentual === null
      ? prisma.regraComissaoCorretor.deleteMany({ where: { corretorId: id } })
      : prisma.regraComissaoCorretor.upsert({ where: { corretorId: id }, create: { corretorId: id, percentual }, update: { percentual } }),
    ...(corretor.usuarioId ? [prisma.usuario.update({ where: { id: corretor.usuarioId }, data: { nome, email, telefone, creci } })] : []),
  ]);
  revalidatePath("/admin/configuracoes");
  return { success: true };
}

/**
 * Paridade 17/11 (EPIC-023 S-A da Prospecta, "Enviar link" em Gerenciar acesso): gera um novo link de definição
 * de senha (7 dias) e tenta enviá-lo por e-mail; sem SMTP, o admin recebe o link para repassar. Usado sobretudo
 * para o corretor cadastrado sem convite.
 */
export async function enviarLinkAcesso(id: string) {
  await exigirAdminAtivo();
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, email: true, ativo: true } });
  if (!alvo) return { error: "Usuário não encontrado." };
  if (!alvo.ativo) return { error: "Ative o usuário antes de enviar o link de acesso." };
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.usuario.update({ where: { id }, data: { tokenPrimeiroAcesso: token, tokenPrimeiroAcessoExpira: new Date(Date.now() + TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS) } });
  const link = linkPrimeiroAcesso(token);
  const emailEnviado = await enviarLinkPrimeiroAcesso(alvo.nome, alvo.email, link);
  revalidatePath("/admin/configuracoes");
  return { success: true, link, emailEnviado };
}
