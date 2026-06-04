import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso Restrito | Grupo Santa Fé",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--brand-dark)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-[var(--brand-yellow)] font-black text-3xl tracking-wider uppercase block">
            Grupo Santa Fé
          </span>
          <span className="text-gray-500 text-xs tracking-[0.3em] uppercase">
            Área Restrita
          </span>
        </div>

        <div className="bg-white p-8">
          <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase tracking-wide mb-1">
            Entrar no Sistema
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Acesso exclusivo para equipe e clientes do Grupo Santa Fé.
          </p>

          <LoginForm />

          {/* Hint */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-2">Contas de demonstração:</p>
            <div className="space-y-1 text-xs text-gray-400 font-mono">
              <p>admin@gruposantafe.com.br / admin123</p>
              <p>corretor@gruposantafe.com.br / corretor123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
