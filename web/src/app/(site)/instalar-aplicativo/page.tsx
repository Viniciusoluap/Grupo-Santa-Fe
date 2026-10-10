import Image from "next/image";
import {
  Smartphone,
  Share,
  SquarePlus,
  CheckCircle2,
  Lock,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { InstallActions } from "./_components/install-actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instale nosso aplicativo",
  description:
    "Instale o aplicativo do Grupo Santa Fé na tela inicial do seu celular e acesse serviços e funcionalidades com mais rapidez e praticidade.",
};

export default function InstalarAplicativoPage() {
  return (
    <>
      <section className="bg-[var(--brand-dark)] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <BackButton className="mb-6 text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>

        <div className="max-w-3xl mx-auto px-4 text-center space-y-8">
          <div className="space-y-4">
            <Image
              src="/icon-192.png"
              alt="Ícone do aplicativo Grupo Santa Fé"
              width={96}
              height={96}
              className="mx-auto rounded-2xl shadow-lg shadow-black/40"
            />
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase">
              Seu aplicativo
            </p>
            <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight">
              Instale nosso aplicativo
            </h1>
            <p className="text-gray-400 leading-relaxed text-lg max-w-2xl mx-auto">
              Tenha o Grupo Santa Fé diretamente na tela inicial do seu celular. Acesse seus
              serviços e funcionalidades com mais rapidez e praticidade.
            </p>
            <p className="text-sm uppercase tracking-wide text-[var(--brand-yellow)]/80 font-semibold">
              Seu sistema sempre à mão.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <InstallActions />
          </div>

          <div className="grid gap-6 text-left sm:grid-cols-2">
            <div className="bg-[var(--brand-dark-secondary)] border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-[var(--brand-yellow)] font-bold">
                <Smartphone size={20} /> iPhone (Safari ou Google Chrome)
              </div>
              <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
                <li>Abra o endereço do sistema pelo Safari ou Google Chrome.</li>
                <li className="flex items-start gap-2">
                  <Share className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" size={16} />
                  <span>Toque no ícone de compartilhamento (ou no menu disponível).</span>
                </li>
                <li className="flex items-start gap-2">
                  <SquarePlus className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" size={16} />
                  <span>Selecione &quot;Adicionar à Tela de Início&quot;, quando disponível.</span>
                </li>
                <li>Confirme a inclusão.</li>
                <li>Abra o aplicativo pelo ícone criado na tela inicial.</li>
              </ol>
              <p className="text-xs text-gray-500">
                O caminho exato pode variar conforme a versão do iOS e do Safari ou Google Chrome.
              </p>
            </div>

            <div className="bg-[var(--brand-dark-secondary)] border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-[var(--brand-yellow)] font-bold">
                <Smartphone size={20} /> Android (Google Chrome)
              </div>
              <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
                <li>Abra o endereço do sistema no Google Chrome.</li>
                <li>
                  Use a opção &quot;Instalar aplicativo&quot; ou &quot;Adicionar à tela
                  inicial&quot; (ou o botão acima, quando disponível).
                </li>
                <li>Confirme a instalação.</li>
                <li>Acesse o aplicativo pelo ícone criado.</li>
              </ol>
              <p className="text-xs text-gray-500">
                Quando o Google Chrome oferece a instalação nativa, o botão &quot;Instalar
                aplicativo&quot; acima já aciona esse mecanismo.
              </p>
            </div>
          </div>

          <div className="bg-[var(--brand-dark-secondary)] border border-gray-700 rounded-lg p-6 text-left space-y-3">
            <div className="flex items-center gap-2 text-[var(--brand-yellow)] font-bold">
              <CheckCircle2 size={20} /> Depois de instalar
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" size={16} />
                Seu login e suas permissões continuam exatamente iguais aos do navegador.
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" size={16} />
                As atualizações chegam automaticamente, sem precisar reinstalar.
              </li>
              <li className="flex items-start gap-2">
                <Wifi className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" size={16} />
                Dados de leads, financeiro e documentos nunca ficam salvos no aparelho — sempre
                vêm direto do sistema.
              </li>
            </ul>
          </div>

          <p className="text-xs text-gray-500">
            Este não é um aplicativo publicado na App Store ou no Google Play — é o próprio
            sistema Grupo Santa Fé, instalado como aplicativo (PWA) direto do navegador.
          </p>
        </div>
      </section>
    </>
  );
}
