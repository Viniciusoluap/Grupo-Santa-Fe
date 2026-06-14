"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className }: BackButtonProps) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[var(--brand-dark)] transition-colors group ${className ?? ""}`}
    >
      <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      Voltar
    </button>
  );
}
