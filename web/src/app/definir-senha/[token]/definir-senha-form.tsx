"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { definirSenhaPrimeiroAcesso } from "@/lib/actions/primeiro-acesso";

interface Props {
  token: string;
}

export function DefinirSenhaForm({ token }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const senha = formData.get("senha") as string;
    const confirmar = formData.get("confirmar") as string;

    if (senha !== confirmar) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const result = await definirSenhaPrimeiroAcesso(token, senha);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <div className="text-center py-6 space-y-3">
        <CheckCircle2 size={40} className="text-green-500 mx-auto" />
        <p className="text-sm text-gray-600">Senha definida! Redirecionando para o login…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Nova senha
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="senha"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full border border-gray-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Confirmar senha
        </label>
        <input
          type={showPassword ? "text" : "password"}
          name="confirmar"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>

      {error && (
        <p className="text-red-500 text-xs bg-red-50 border border-red-100 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] disabled:opacity-60 text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider py-3 transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        {loading ? "Salvando..." : "Definir senha"}
      </button>
    </form>
  );
}
