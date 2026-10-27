export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plug } from "lucide-react";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { podeAdministrarSeguranca } from "@/lib/perfis-acesso";
import { statusIntegracoes } from "@/lib/integracoes";
import { IntegracoesClient } from "./_components/integracoes-client";
import { SubPciAtual } from "@/components/admin/sub-pci-atual";

// LOTE B (25/10): Configurações › Integrações — Asaas, Pluggy e WhatsApp (Evolution) num lugar só.
// Só o admin (igual a Configurações). Gêmeo de Prospecta/client/src/pages/admin/AdminIntegracoes.tsx.
export default async function IntegracoesPage() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.ativo) redirect("/login");
  if (!podeAdministrarSeguranca(usuario)) redirect(destinoDoUsuario(usuario));

  const status = await statusIntegracoes();

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-[var(--brand-dark)]"><ArrowLeft size={16} /> Voltar ao painel</Link>
      <div className="flex items-center gap-3">
        <Plug size={22} className="text-[var(--brand-dark)]" />
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Integrações</h1>
          <p className="text-gray-600 text-sm mt-0.5">Asaas, Pluggy e WhatsApp — cada chave fica salva só aqui.</p>
        </div>
      </div>
      <IntegracoesClient inicial={status} />
      <SubPciAtual />
    </div>
  );
}
