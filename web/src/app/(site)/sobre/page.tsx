import Link from "next/link";
import {
  Award,
  Users,
  Target,
  Heart,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre Nós",
  description: "Conheça a história, missão e valores do Grupo Santa Fé — especialistas em imóveis, construção e engenharia em Goiânia.",
};

const values = [
  {
    icon: ShieldCheck,
    title: "Transparência",
    description:
      "Comunicação clara em todas as etapas, sem surpresas. Você sempre sabe o que está acontecendo com seu investimento.",
  },
  {
    icon: Heart,
    title: "Compromisso",
    description:
      "Tratamos cada negócio como se fosse o nosso. Dedicação total do primeiro contato à entrega das chaves.",
  },
  {
    icon: Target,
    title: "Excelência",
    description:
      "Padrão elevado em cada serviço prestado. Nossa reputação é construída resultado a resultado.",
  },
  {
    icon: Users,
    title: "Relacionamento",
    description:
      "Clientes são parceiros de longo prazo. Mantemos contato antes, durante e após a conclusão do negócio.",
  },
];

const timeline = [
  {
    year: "2014",
    title: "Fundação",
    description:
      "O Grupo Santa Fé nasce focado em corretagem imobiliária em Goiânia, com uma equipe de 3 corretores.",
  },
  {
    year: "2016",
    title: "Expansão de Serviços",
    description:
      "Adicionamos financiamento habitacional à grade de serviços, tornando-nos referência em MCMV na região.",
  },
  {
    year: "2018",
    title: "Área de Engenharia",
    description:
      "Criação do setor de obras e projetos, permitindo atender clientes do projeto à entrega completa.",
  },
  {
    year: "2021",
    title: "Regularização",
    description:
      "Início do serviço de regularização imobiliária, completando o ecossistema de soluções do grupo.",
  },
  {
    year: "2024",
    title: "Plataforma Digital",
    description:
      "Lançamento da plataforma digital para oferecer a melhor experiência de busca e contato para nossos clientes.",
  },
];

const team = [
  {
    name: "João Santos",
    role: "Diretor Comercial",
    creci: "CRECI-GO XXXX",
  },
  {
    name: "Maria Oliveira",
    role: "Corretora Sênior",
    creci: "CRECI-GO YYYY",
  },
  {
    name: "Carlos Ferreira",
    role: "Engenheiro Civil",
    crea: "CREA-GO ZZZZ",
  },
  {
    name: "Ana Lima",
    role: "Especialista em Financiamento",
    creci: "CRECI-GO WWWW",
  },
];

export default function SobrePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--brand-dark)] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Nossa história
            </p>
            <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight mb-6">
              Construindo negócios{" "}
              <span className="text-[var(--brand-yellow)]">há mais de 10 anos</span>
            </h1>
            <p className="text-gray-400 leading-relaxed text-lg">
              O Grupo Santa Fé nasceu da visão de criar uma empresa que fosse
              além da simples intermediação imobiliária — um parceiro completo
              para todas as necessidades de quem quer construir, comprar, vender
              ou regularizar um imóvel.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "500+", label: "Imóveis negociados" },
              { value: "300+", label: "Clientes satisfeitos" },
              { value: "50+", label: "Obras entregues" },
              { value: "10+", label: "Anos de mercado" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-white/5 border border-white/10 p-6 text-center hover:border-[var(--brand-yellow)]/40 transition-colors"
              >
                <p className="text-[var(--brand-yellow)] font-black text-4xl">
                  {value}
                </p>
                <p className="text-gray-400 text-sm mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <TrendingUp size={40} className="text-[var(--brand-dark)] mx-auto mb-4 opacity-50" />
          <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase mb-4">
            Nossa Missão
          </h2>
          <p className="text-[var(--brand-dark-secondary)] text-lg max-w-2xl mx-auto leading-relaxed">
            Transformar o sonho da casa própria em realidade, oferecendo soluções
            imobiliárias e de engenharia completas com ética, qualidade e
            comprometimento com cada cliente.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              O que nos guia
            </p>
            <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase">
              Nossos Valores
            </h2>
            <div className="w-14 h-1 bg-[var(--brand-yellow)] mx-auto mt-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white p-6 hover:shadow-md transition-shadow text-center"
              >
                <div className="w-12 h-12 bg-[var(--brand-yellow)] flex items-center justify-center mx-auto mb-4">
                  <Icon size={22} className="text-[var(--brand-dark)]" />
                </div>
                <h3 className="font-bold text-[var(--brand-dark)] uppercase tracking-wide mb-2">
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Nossa jornada
            </p>
            <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase">
              Linha do Tempo
            </h2>
            <div className="w-14 h-1 bg-[var(--brand-yellow)] mx-auto mt-3" />
          </div>

          <div className="relative">
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-8">
              {timeline.map(({ year, title, description }, i) => (
                <div
                  key={year}
                  className={`relative flex gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  {/* Content */}
                  <div className={`flex-1 ${i % 2 === 0 ? "md:text-right md:pr-12" : "md:text-left md:pl-12"} pl-16 md:pl-0`}>
                    <div className="bg-white border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <span className="text-[var(--brand-yellow)] font-black text-xl">
                        {year}
                      </span>
                      <h3 className="font-bold text-[var(--brand-dark)] mt-1 uppercase tracking-wide">
                        {title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                        {description}
                      </p>
                    </div>
                  </div>

                  {/* Dot */}
                  <div className="absolute left-6 md:left-1/2 top-5 -translate-x-1/2 w-5 h-5 bg-[var(--brand-yellow)] border-4 border-white shadow-md rounded-full" />

                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 bg-[var(--brand-dark)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Quem faz acontecer
            </p>
            <h2 className="text-white font-black text-3xl md:text-4xl uppercase">
              Nossa Equipe
            </h2>
            <div className="w-14 h-1 bg-[var(--brand-yellow)] mx-auto mt-3" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map(({ name, role, creci, crea }) => (
              <div
                key={name}
                className="bg-white/5 border border-white/10 hover:border-[var(--brand-yellow)]/40 p-6 text-center transition-colors"
              >
                <div className="w-16 h-16 bg-[var(--brand-yellow)] rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-[var(--brand-dark)] font-black text-2xl">
                    {name[0]}
                  </span>
                </div>
                <h3 className="text-white font-bold">{name}</h3>
                <p className="text-[var(--brand-yellow)] text-sm font-medium mt-0.5">
                  {role}
                </p>
                <p className="text-gray-500 text-xs mt-1">{creci ?? crea}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-[var(--brand-dark)] font-black text-2xl md:text-3xl uppercase">
              Vamos trabalhar juntos?
            </h2>
            <p className="text-[var(--brand-dark-secondary)] mt-1">
              Conte-nos sobre seu projeto e encontraremos a melhor solução.
            </p>
          </div>
          <Button variant="dark" size="lg" asChild>
            <Link href="/contato">
              Falar Conosco <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
