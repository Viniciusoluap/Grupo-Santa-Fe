import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ConfiguracoesClient } from "./configuracoes-client";
import { UsuariosClient } from "./_components/usuarios-client";
import { FeedsAgregadorClient } from "./_components/feeds-agregador-client";
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
  const sessionUser = session?.user as { role?: string; name?: string } | undefined;
  if (sessionUser?.role !== "admin") redirect("/admin");
  const userName = sessionUser?.name ?? "Usuário";

  const [configs, usuarios, feedsConfig] = await Promise.all([
    prisma.configuracao.findMany({ orderBy: { grupo: "asc" } }),
    prisma.usuario.findMany({
      where: { papel: { in: ["admin", "colaborador"] } },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.configuracao.findUnique({ where: { chave: "agregador_feeds" } }),
  ]);
  const feedUrls: string[] = (() => {
    try { return feedsConfig?.valor ? (JSON.parse(feedsConfig.valor) as string[]) : []; } catch { return []; }
  })();
  const valoresSalvos = Object.fromEntries(configs.map((c) => [c.chave, c.valor]));

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings size={22} className="text-[var(--brand-dark)]" />
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Configurações</h1>
          <p className="text-gray-400 text-sm mt-0.5">Dados da empresa e preferências do sistema</p>
        </div>
      </div>

      <FotoPerfilClient userName={userName} />

      <ConfiguracoesClient sections={SECTIONS} valoresSalvos={valoresSalvos} />

      <FeedsAgregadorClient feedUrls={feedUrls} />

      <UsuariosClient usuarios={usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        ativo: u.ativo,
        creci: u.creci,
        telefone: u.telefone,
        permissoes: u.permissoes,
      }))} />
    </div>
  );
}
