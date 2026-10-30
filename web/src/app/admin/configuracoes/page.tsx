import { Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { ConfiguracoesClient } from "./configuracoes-client";
import { UsuariosClient } from "./_components/usuarios-client";
import { FotoPerfilClient } from "./_components/foto-perfil-client";

const SECTIONS = [
  {
    title: "Dados da Empresa",
    grupo: "empresa",
    fields: [
      { label: "Razão Social",      chave: "razao_social",     placeholder: "Grupo Santa Fé Ltda",           type: "text"  },
      { label: "CNPJ",              chave: "cnpj",             placeholder: "00.000.000/0001-00",            type: "text"  },
      { label: "CRECI",             chave: "creci",            placeholder: "PA-12345",                      type: "text"  },
      { label: "Telefone Principal",chave: "telefone",         placeholder: "(94) 9 9999-9999",              type: "tel"   },
      { label: "E-mail",            chave: "email",            placeholder: "contato@gruposantafe.com.br",   type: "email" },
      { label: "Site",              chave: "site",             placeholder: "https://gruposantafe.com.br",   type: "url"   },
    ],
  },
  {
    title: "Endereço",
    grupo: "endereco",
    fields: [
      { label: "Rua / Avenida", chave: "rua",    placeholder: "Av. Principal, 1234", type: "text" },
      { label: "Bairro",        chave: "bairro", placeholder: "Centro",              type: "text" },
      { label: "Cidade",        chave: "cidade", placeholder: "Canaã dos Carajás",   type: "text" },
      { label: "Estado",        chave: "estado", placeholder: "PA",                  type: "text" },
      { label: "CEP",           chave: "cep",    placeholder: "68354-000",           type: "text" },
    ],
  },
  {
    title: "Notificações",
    grupo: "notificacoes",
    fields: [
      { label: "E-mail para novos leads",       chave: "email_leads",   placeholder: "leads@gruposantafe.com.br",  type: "email" },
      { label: "E-mail para visitas agendadas", chave: "email_visitas", placeholder: "agenda@gruposantafe.com.br", type: "email" },
    ],
  },
];

export default async function ConfiguracoesPage() {
  const session = await auth();
  requirePageRole(session, "admin");
  const sessionUser = session?.user as { role?: string; name?: string } | undefined;
  const userName = sessionUser?.name ?? "Usuário";

  // Item 05: os cinco perfis aparecem aqui; clientes do CRM sem conta para vincular.
  const [configs, usuarios, leadsSemConta] = await Promise.all([
    prisma.configuracao.findMany({ orderBy: { grupo: "asc" } }),
    prisma.usuario.findMany({
      orderBy: { criadoEm: "asc" },
      include: { leadCliente: { select: { nome: true, telefone: true } }, perfilEngenheiro: { select: { ativo: true } } },
    }),
    prisma.lead.findMany({
      where: { excluidoEm: null, contaCliente: null },
      select: { id: true, nome: true, email: true, telefone: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  // LOTE B (25/10): só os campos desta tela vão ao navegador — segredos de integração
  // (asaas.*, whatsapp.evolution.*), mesmo criptografados, ficam no servidor.
  const chavesDaTela = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.chave)));
  const valoresSalvos = Object.fromEntries(configs.filter((c) => chavesDaTela.has(c.chave)).map((c) => [c.chave, c.valor]));

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Settings size={22} className="text-[var(--brand-dark)]" />
          <div>
            <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Configurações</h1>
            <p className="text-gray-600 text-sm mt-0.5">Usuários e acesso, dados da empresa e preferências do sistema</p>
          </div>
        </div>
      </div>

      <FotoPerfilClient userName={userName} />

      <ConfiguracoesClient sections={SECTIONS} valoresSalvos={valoresSalvos} />

      <UsuariosClient usuarios={usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        ativo: u.ativo,
        creci: u.creci,
        telefone: u.telefone,
        permissoes: u.permissoes,
        leadId: u.leadId,
        leadNome: u.leadCliente?.nome ?? null,
        leadTelefone: u.leadCliente?.telefone ?? null,
        // Lote 2, correção 04: "Engenheiro" = colaborador com perfil de engenheiro ativo.
        engenheiro: u.papel === "colaborador" && u.perfilEngenheiro?.ativo === true,
      }))} leadsSemConta={leadsSemConta} />
    </div>
  );
}
