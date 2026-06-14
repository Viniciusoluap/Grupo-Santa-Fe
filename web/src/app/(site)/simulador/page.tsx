import { MortgageSimulator } from "@/components/simulador/mortgage-simulator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import {
  Calculator,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Clock,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulador de Financiamento",
  description:
    "Simule seu financiamento habitacional pelo MCMV (Faixas 1-4), SBPE, FGTS. Prazo de até 420 meses (35 anos). Tabelas Price e SAC com amortização completa.",
};

const benefits = [
  {
    icon: Calculator,
    title: "Price ou SAC",
    description: "Compare os dois sistemas e escolha o que melhor se encaixa no seu bolso.",
  },
  {
    icon: ShieldCheck,
    title: "MCMV e FGTS",
    description: "Simulação com as taxas dos programas habitacionais governamentais.",
  },
  {
    icon: Clock,
    title: "Resultado imediato",
    description: "Parcelas, juros totais e tabela completa de amortização em segundos.",
  },
  {
    icon: Users,
    title: "Assessoria gratuita",
    description: "Após simular, fale com nosso especialista para montar sua proposta real.",
  },
];

export default function SimuladorPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-14">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Financiamento Habitacional
            </p>
            <h1 className="text-white font-black text-4xl md:text-5xl uppercase leading-tight mb-4">
              Simule seu{" "}
              <span className="text-[var(--brand-yellow)]">financiamento</span>
            </h1>
            <p className="text-gray-400 leading-relaxed mb-6">
              Calcule suas parcelas nos sistemas Price e SAC, com suporte ao
              Minha Casa Minha Vida, FGTS e financiamento convencional.
              Tabela completa de amortização incluída.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {benefits.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-2">
                  <Icon
                    size={16}
                    className="text-[var(--brand-yellow)] shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-white text-xs font-bold">{title}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick checklist */}
          <div className="bg-white/5 border border-white/10 p-6">
            <p className="text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-widest mb-4">
              O que você vai ver na simulação
            </p>
            {[
              "Valor da parcela (Price ou SAC)",
              "Total de juros pagos ao longo do contrato",
              "Impacto do FGTS na entrada",
              "Tabela completa de amortização mês a mês",
              "Comparativo visual: principal × juros × seguros",
              "Taxa mensal equivalente à taxa anual",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 mb-2">
                <CheckCircle2
                  size={13}
                  className="text-[var(--brand-yellow)] shrink-0 mt-0.5"
                />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section className="py-12 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4">
          <MortgageSimulator />
        </div>
      </section>

      {/* CTA falar com especialista */}
      <section className="py-12 bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-[var(--brand-dark)] font-black text-2xl md:text-3xl uppercase">
              Gostou da simulação?
            </h2>
            <p className="text-[var(--brand-dark-secondary)] mt-1">
              Fale com nosso especialista e transforme a simulação em proposta real.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="dark" size="lg" asChild>
              <Link href="/contato">
                Falar com Especialista <ArrowRight size={16} />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-[var(--brand-dark)] hover:text-[var(--brand-yellow)]"
              asChild
            >
              <Link href="/imoveis">Ver Imóveis</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
