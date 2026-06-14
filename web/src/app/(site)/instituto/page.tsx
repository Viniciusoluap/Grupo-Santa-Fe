import { Heart, TreePine, Users, PlayCircle, Camera, HandHeart, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instituto Social — Grupo Santa Fé",
  description: "Conheça o trabalho social do Instituto do Grupo Santa Fé. Ações ambientais, educação e desenvolvimento comunitário em Canaã dos Carajás - PA. Faça uma doação.",
};

const impacts = [
  {
    icon: Users,
    value: "Em breve",
    label: "Famílias beneficiadas",
  },
  {
    icon: TreePine,
    value: "Em breve",
    label: "Ações ambientais",
  },
  {
    icon: Building2,
    value: "Em breve",
    label: "Projetos comunitários",
  },
  {
    icon: Heart,
    value: "Em breve",
    label: "Voluntários ativos",
  },
];

const actions = [
  "Apoio à educação e formação profissional de jovens",
  "Ações de preservação ambiental e reflorestamento",
  "Projetos habitacionais para famílias em vulnerabilidade",
  "Campanhas de saúde e bem-estar na comunidade",
  "Incentivo ao empreendedorismo local",
  "Parceria com empresas para doações com benefício fiscal",
];

export default function InstitutoPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-16">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
            Impacto Social
          </p>
          <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight max-w-3xl">
            Instituto{" "}
            <span className="text-[var(--brand-yellow)]">Santa Fé</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl">
            Transformando vidas e comunidades em Canaã dos Carajás - PA através
            de ações sociais, ambientais e educacionais.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#doar"
              className="inline-flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider px-6 py-3 transition-colors"
            >
              <Heart size={16} />
              Faça uma doação agora
            </a>
            <Link
              href="#acoes"
              className="inline-flex items-center gap-2 border border-white/30 hover:border-[var(--brand-yellow)] text-white hover:text-[var(--brand-yellow)] font-bold text-sm uppercase tracking-wider px-6 py-3 transition-colors"
            >
              Nossas Ações <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--brand-yellow-dark)]">
            {impacts.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3 py-6 px-6">
                <Icon size={24} className="text-[var(--brand-dark)] opacity-60" />
                <div>
                  <p className="font-black text-xl text-[var(--brand-dark)] leading-none">{value}</p>
                  <p className="text-xs text-[var(--brand-dark)]/70 font-medium mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Actions */}
      <section id="acoes" className="py-16 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              O que fazemos
            </p>
            <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase leading-tight mb-6">
              Nossas Ações Sociais
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              O Instituto Santa Fé atua em diversas frentes para promover
              desenvolvimento humano, preservação ambiental e qualidade de vida
              na comunidade de Canaã dos Carajás e região.
            </p>
            <div className="space-y-3">
              {actions.map((action) => (
                <div key={action} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[var(--brand-yellow)] shrink-0 mt-0.5" />
                  <span className="text-gray-600 text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Photo gallery placeholder */}
          <div className="space-y-3">
            <div className="bg-[var(--brand-dark)] p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: "320px" }}>
              <Camera size={48} className="text-[var(--brand-yellow)]/40 mb-4" />
              <p className="text-gray-400 text-sm">Galeria de fotos</p>
              <p className="text-gray-600 text-xs mt-1">Fotos das ações serão adicionadas em breve</p>
            </div>
            <div className="bg-[var(--brand-dark)] p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: "200px" }}>
              <PlayCircle size={48} className="text-[var(--brand-yellow)]/40 mb-4" />
              <p className="text-gray-400 text-sm">Canal do YouTube</p>
              <p className="text-gray-600 text-xs mt-1">Vídeos das ações serão vinculados em breve</p>
            </div>
          </div>
        </div>
      </section>

      {/* Empresa apoiadora */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
            Apoio institucional
          </p>
          <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase mb-4">
            Empresa Apoiadora
          </h2>
          <div className="w-14 h-1 bg-[var(--brand-yellow)] mx-auto mb-8" />
          <div className="max-w-2xl mx-auto">
            <div className="bg-[var(--brand-gray-light)] border-l-4 border-[var(--brand-yellow)] p-6 text-left">
              <p className="text-[var(--brand-dark)] font-bold mb-2">Grupo Santa Fé — Apoiador Oficial</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                O Grupo Santa Fé é o principal apoiador do Instituto, destinando
                parte de sua receita para financiar as ações sociais e ambientais
                da organização. Acreditamos que crescimento empresarial e
                responsabilidade social caminham juntos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefício fiscal para empresas */}
      <section className="py-14 bg-[var(--brand-dark)]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Para empresas
            </p>
            <h2 className="text-white font-black text-3xl md:text-4xl uppercase leading-tight mb-6">
              Converta impostos{" "}
              <span className="text-[var(--brand-yellow)]">em doações</span>
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Empresas podem destinar parte de seu imposto de renda ao Instituto
              e deduzir o valor do imposto devido, de acordo com a legislação
              fiscal vigente. Fale com nossa equipe para entender como funciona.
            </p>
            <div className="bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]/30 p-4">
              <p className="text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-wide mb-1">
                Em análise com a contabilidade
              </p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Os mecanismos tributários específicos para conversão de impostos
                em doações estão sendo validados junto à contabilidade.
                Informações detalhadas em breve.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { title: "Dedução fiscal", desc: "Reduza o imposto devido da sua empresa com doações ao instituto" },
              { title: "Impacto real", desc: "Seu investimento se transforma em ações concretas na comunidade" },
              { title: "Transparência", desc: "Relatórios periódicos de como os recursos foram utilizados" },
              { title: "Reconhecimento", desc: "Sua empresa como apoiadora do instituto em todos os materiais" },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-4 bg-white/5 border border-white/10 p-4">
                <HandHeart size={20} className="text-[var(--brand-yellow)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-bold text-sm">{title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donation section */}
      <section id="doar" className="py-16 bg-[var(--brand-yellow)]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Heart size={48} className="text-[var(--brand-dark)] mx-auto mb-4 opacity-60" />
          <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase mb-4">
            Faça uma Doação
          </h2>
          <p className="text-[var(--brand-dark-secondary)] mb-8 max-w-lg mx-auto">
            Sua contribuição, por menor que seja, transforma vidas.
            Escolha como deseja ajudar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Anonymous donation */}
            <div className="bg-white p-6 text-left">
              <p className="text-[var(--brand-dark)] font-black text-sm uppercase tracking-wide mb-2">
                Doação Anônima
              </p>
              <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                Doe pelo PIX sem necessidade de identificação.
              </p>
              <div className="bg-[var(--brand-gray-light)] p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Chave PIX</p>
                <p className="font-black text-[var(--brand-dark)] text-sm">
                  A definir — em breve
                </p>
              </div>
            </div>

            {/* Identified donation */}
            <div className="bg-white p-6 text-left">
              <p className="text-[var(--brand-dark)] font-black text-sm uppercase tracking-wide mb-2">
                Doação Identificada
              </p>
              <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                Informe seus dados, anexe o comprovante e receba o certificado de doação.
              </p>
              <a
                href="/contato"
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)] uppercase tracking-wide hover:text-[var(--brand-yellow-dark)] transition-colors"
              >
                Falar com a equipe <ArrowRight size={12} />
              </a>
            </div>
          </div>

          <p className="text-[var(--brand-dark)]/60 text-xs">
            Para doações empresariais ou parcerias institucionais, entre em contato pelo{" "}
            <a href="tel:+5594993044689" className="font-bold underline">(94) 99304-4689</a>{" "}
            ou{" "}
            <a href="mailto:comercial@gruposantafee.com.br" className="font-bold underline">
              comercial@gruposantafee.com.br
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
