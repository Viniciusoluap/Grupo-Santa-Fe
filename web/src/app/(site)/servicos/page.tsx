import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import {
  Home,
  Calculator,
  Wrench,
  Building2,
  FileCheck,
  MapPin,
  ArrowRight,
  CheckCircle2,
  SearchCheck,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Serviços",
  description: "Conheça todos os serviços do Grupo Santa Fé: corretagem, financiamento habitacional, obras, projetos de engenharia e regularização imobiliária.",
};

const services = [
  {
    icon: Home,
    title: "Corretagem Imobiliária",
    slug: "corretagem",
    description:
      "Assessoria completa para compra, venda e locação de imóveis residenciais e comerciais. Nossa equipe de corretores credenciados (CRECI) conduz todo o processo com transparência e segurança.",
    items: [
      "Avaliação gratuita do seu imóvel",
      "Divulgação nos principais portais (ZAP, OLX, Viva Real)",
      "Visitas acompanhadas por corretor especialista",
      "Assessoria jurídica e documental",
      "Negociação e fechamento de contrato",
      "Pós-venda e acompanhamento",
    ],
  },
  {
    icon: Calculator,
    title: "Financiamento Habitacional",
    slug: "financiamento",
    description:
      "Facilitamos seu acesso à casa própria com orientação completa nos principais programas habitacionais. Trabalhamos com Caixa Econômica, Banco do Brasil, Itaú, Bradesco e outros.",
    items: [
      "Simulação gratuita de financiamento",
      "Programa Minha Casa Minha Vida (MCMV)",
      "Financiamento com uso do FGTS",
      "Carta de crédito para construção",
      "Acompanhamento junto ao banco",
      "Análise e organização documental",
    ],
  },
  {
    icon: Wrench,
    title: "Obras e Reformas",
    slug: "obras",
    description:
      "Construção, ampliação e reforma com gestão profissional. Da fundação ao acabamento, nossa equipe garante qualidade, prazo e preço justo.",
    items: [
      "Construção de casas e sobrados",
      "Reformas residenciais e comerciais",
      "Ampliações e acabamentos",
      "Cronograma físico-financeiro",
      "Diário de obra digital",
      "Controle de materiais e fornecedores",
    ],
  },
  {
    icon: Building2,
    title: "Projetos de Engenharia",
    slug: "projetos",
    description:
      "Projetos completos para construção, reforma e regularização. Desenvolvemos soluções técnicas personalizadas com qualidade e responsabilidade.",
    items: [
      "Projetos arquitetônicos",
      "Projetos estruturais",
      "Projetos elétricos e hidráulicos",
      "Laudos e memoriais descritivos",
      "ART e RRT de projetos",
      "Orçamentos detalhados",
    ],
  },
  {
    icon: FileCheck,
    title: "Regularização Imobiliária",
    slug: "regularizacao",
    description:
      "Regularizamos imóveis junto à Prefeitura, Cartório e Receita Federal. Resolvemos situações de irregularidade com agilidade e conhecimento técnico-jurídico.",
    items: [
      "Regularização de construções",
      "Averbação no Cartório de Registro",
      "Habite-se e certidões",
      "Usucapião extrajudicial",
      "Desmembramento e unificação",
      "Regularização de herança",
    ],
  },
  {
    icon: MapPin,
    title: "Loteamento e Lotes",
    slug: "lotes",
    description:
      "Comercializamos lotes em localizações estratégicas com toda documentação regularizada. Trabalhamos com loteamentos residenciais, comerciais e rurais.",
    items: [
      "Lotes em condomínio fechado",
      "Lotes residenciais e comerciais",
      "Chácaras e sítios",
      "Documentação 100% regularizada",
      "Financiamento direto com a construtora",
      "Assessoria de localização",
    ],
  },
  {
    icon: SearchCheck,
    title: "Avaliação Imobiliária",
    slug: "avaliacao",
    description:
      "Avaliação técnica de lotes, casas e imóveis comerciais com laudo detalhado. Utilizamos metodologia oficial para determinar o valor de mercado real do seu imóvel.",
    items: [
      "Avaliação de lotes e terrenos",
      "Avaliação de imóveis residenciais",
      "Laudo técnico de avaliação",
      "Metodologia ABNT NBR 14653",
      "Avaliação para venda ou financiamento",
      "Avaliação gratuita inicial",
    ],
  },
  {
    icon: Briefcase,
    title: "Consultoria Imobiliária",
    slug: "consultoria-imobiliaria",
    description:
      "Consultoria especializada para compra, venda, investimento e gestão de imóveis. Orientamos você nas melhores decisões para maximizar o retorno do seu investimento.",
    items: [
      "Análise de viabilidade de compra",
      "Estratégias de investimento imobiliário",
      "Gestão de carteira de imóveis",
      "Análise de mercado local",
      "Orientação jurídica e documental",
      "Planejamento de portfólio",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Consultoria Empresarial / NR-1",
    slug: "consultoria-nr1",
    description:
      "Consultoria para adequação de empresas às normas regulamentadoras, especialmente NR-1 (Gerenciamento de Riscos Ocupacionais). Treinamentos e processos para manter sua empresa em conformidade.",
    items: [
      "Diagnóstico de conformidade NR-1",
      "Elaboração do PGR (Programa de Gerenciamento de Riscos)",
      "Treinamentos obrigatórios para colaboradores",
      "Adequação de processos internos",
      "Documentação e registros legais",
      "Acompanhamento contínuo de conformidade",
    ],
  },
];

export default function ServicosPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-16">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
            O que oferecemos
          </p>
          <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight max-w-3xl">
            Soluções completas para{" "}
            <span className="text-[var(--brand-yellow)]">seu imóvel</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl">
            Do projeto à entrega das chaves — o Grupo Santa Fé acompanha cada
            etapa com expertise, compromisso e transparência.
          </p>
        </div>
      </section>

      {/* Services list */}
      <section className="py-16 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          {services.map(({ icon: Icon, title, slug, description, items }, i) => (
            <div
              key={slug}
              id={slug}
              className="bg-white grid grid-cols-1 md:grid-cols-3 overflow-hidden"
            >
              {/* Left accent */}
              <div
                className={`${i % 2 === 0 ? "bg-[var(--brand-dark)]" : "bg-[var(--brand-yellow)]"} p-8 flex flex-col justify-between`}
              >
                <div>
                  <Icon
                    size={40}
                    className={i % 2 === 0 ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}
                  />
                  <h2
                    className={`font-black text-2xl uppercase mt-4 leading-tight ${i % 2 === 0 ? "text-white" : "text-[var(--brand-dark)]"}`}
                  >
                    {title}
                  </h2>
                </div>
                <Button
                  variant={i % 2 === 0 ? "primary" : "dark"}
                  size="sm"
                  className="mt-6 w-fit"
                  asChild
                >
                  <Link href="/contato">
                    Solicitar <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>

              {/* Right content */}
              <div className="md:col-span-2 p-8">
                <p className="text-gray-600 leading-relaxed mb-6">{description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className="text-[var(--brand-yellow)] shrink-0 mt-0.5"
                      />
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase mb-4">
            Pronto para começar?
          </h2>
          <p className="text-[var(--brand-dark-secondary)] mb-8 max-w-lg mx-auto">
            Entre em contato e receba uma consultoria gratuita com nossos especialistas.
          </p>
          <Button variant="dark" size="lg" asChild>
            <Link href="/contato">Falar com Especialista</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
