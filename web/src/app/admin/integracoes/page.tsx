export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plug } from "lucide-react";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { podeAdministrarSeguranca } from "@/lib/perfis-acesso";
import { statusIntegracoes } from "@/lib/integracoes";
import { IntegracoesClient } from "./_components/integracoes-client";
import { headers } from "next/headers";
import { estadoOAuth } from "@/lib/google-drive-conexao";
import { origemDaRequisicao } from "@/lib/google-drive-oauth";
import { ultimoRelatorioDrive } from "@/lib/drive-organizacao";
import { GoogleDriveCard } from "./_components/google-drive-card";
import { SubPciAtual } from "@/components/admin/sub-pci-atual";

// LOTE B (25/10): Configurações › Integrações — Asaas, Pluggy, WhatsApp (Evolution) e Google Drive num lugar só.
// Só o admin (igual a Configurações). Gêmeo de Prospecta/client/src/pages/admin/AdminIntegracoes.tsx.
// A organização manual do Drive pode levar até ~45 s, inclusive via Server Action.
export const maxDuration = 60;

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<{ drive?: string; motivo?: string }> }) {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.ativo) redirect("/login");
  if (!podeAdministrarSeguranca(usuario)) redirect(destinoDoUsuario(usuario));

  const { drive, motivo } = await searchParams;
  const h = await headers();
  const [status, statusDrive, relatorioDrive] = await Promise.all([
    statusIntegracoes(),
    estadoOAuth(origemDaRequisicao(h.get("x-forwarded-host") ?? h.get("host") ?? undefined)),
    ultimoRelatorioDrive().catch(() => null),
  ]);
  const retornoDrive = drive === "ok" ? { tipo: "ok" as const, texto: "Google Drive conectado! Os próximos arquivos vão para o seu Drive." }
    : drive === "erro" ? { tipo: "erro" as const, texto: (motivo ?? "Não foi possível conectar o Google Drive.").slice(0, 300) } : null;

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-[var(--brand-dark)]"><ArrowLeft size={16} /> Voltar ao painel</Link>
      <div className="flex items-center gap-3">
        <Plug size={22} className="text-[var(--brand-dark)]" />
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Integrações</h1>
          <p className="text-gray-600 text-sm mt-0.5">Asaas, Pluggy, WhatsApp e Google Drive — conexões e configurações em um só lugar.</p>
        </div>
      </div>
      <IntegracoesClient inicial={status} />
      <GoogleDriveCard retorno={retornoDrive} inicial={statusDrive} relatorioInicial={relatorioDrive} />
      <SubPciAtual />
    </div>
  );
}
