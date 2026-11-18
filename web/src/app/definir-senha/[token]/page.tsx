import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { aceitesDoUsuario, situacaoNoLink, MENSAGEM_FALHA_AO_VERIFICAR, type SituacaoDoTermo } from "@/lib/consentimento";
import { DefinirSenhaForm } from "./definir-senha-form";

export const metadata: Metadata = {
  title: "Definir Senha | Grupo Santa Fé",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function DefinirSenhaPage({ params }: PageProps) {
  const { token } = await params;

  const usuario = await prisma.usuario.findUnique({
    where: { tokenPrimeiroAcesso: token },
    select: { id: true, nome: true, tokenPrimeiroAcessoExpira: true },
  });
  const valido = !!usuario && !!usuario.tokenPrimeiroAcessoExpira && usuario.tokenPrimeiroAcessoExpira > new Date();
  // Paridade 17/11 bloco 4: situação do termo de consentimento (falha do banco não vira "link inválido").
  let termo: SituacaoDoTermo | null = null;
  if (valido) {
    try { termo = situacaoNoLink(await aceitesDoUsuario(usuario.id)); }
    catch (erro) { console.error("[consentimento] falha ao verificar o termo no link:", erro); }
  }

  return (
    <div className="min-h-screen bg-[var(--brand-dark)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-[var(--brand-yellow)] font-black text-3xl tracking-wider uppercase block">
            Grupo Santa Fé
          </span>
          <span className="text-gray-500 text-xs tracking-[0.3em] uppercase">
            Primeiro Acesso
          </span>
        </div>

        <div className="bg-white p-8">
          {valido ? (
            <>
              <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase tracking-wide mb-1">
                Bem-vindo(a), {usuario.nome.split(" ")[0]}
              </h1>
              <p className="text-gray-400 text-sm mb-6">
                Defina sua senha de acesso ao sistema.
              </p>
              {termo ? <DefinirSenhaForm token={token} termo={termo} /> : (
                <p role="alert" className="text-sm text-red-600">{MENSAGEM_FALHA_AO_VERIFICAR}</p>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <AlertCircle size={36} className="text-red-400 mx-auto" />
              <h1 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">
                Link inválido ou expirado
              </h1>
              <p className="text-gray-400 text-sm">
                Peça ao administrador para gerar um novo link de acesso.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
