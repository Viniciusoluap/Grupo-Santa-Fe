import { GraduationCap, Clock, Users, MapPin, Monitor, ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cursos Profissionais",
  description: "Cursos de formação profissional do Grupo Santa Fé: Corretor de Imóveis, financiamento habitacional e mais. Presencial em Canaã dos Carajás - PA.",
};

const courses = [
  {
    title: "Formação de Corretor de Imóveis",
    badge: "Destaque",
    duration: "180h",
    modality: "Presencial / EAD",
    slots: "Turmas abertas",
    description:
      "Curso completo para formação e habilitação como Corretor de Imóveis. Conteúdo alinhado ao CRECI-PA com aulas práticas, simulações de negociação e estudo de mercado local.",
    topics: [
      "Legislação imobiliária e código de ética",
      "Técnicas de vendas e negociação",
      "Financiamento habitacional (MCMV / SBPE)",
      "Documentação e registro de imóveis",
      "Marketing digital para corretores",
      "Avaliação e precificação de imóveis",
    ],
  },
  {
    title: "Financiamento Habitacional na Prática",
    badge: "Novo",
    duration: "40h",
    modality: "Presencial / EAD",
    slots: "Turmas abertas",
    description:
      "Treinamento focado no processo completo de financiamento: MCMV Faixas 1 a 4, SBPE, uso do FGTS, análise documental e acompanhamento junto à Caixa Econômica e demais bancos.",
    topics: [
      "Minha Casa Minha Vida — Faixas 1, 2, 3 e 4",
      "SBPE — Financiamento convencional",
      "Uso do FGTS na compra do imóvel",
      "Análise de crédito e renda",
      "Documentação completa do processo",
      "Simulação e tabelas Price e SAC",
    ],
  },
  {
    title: "NR-1 — Gerenciamento de Riscos Ocupacionais",
    badge: null,
    duration: "20h",
    modality: "Presencial",
    slots: "Turmas para empresas",
    description:
      "Treinamento obrigatório para adequação à NR-1 vigente. Capacitação de colaboradores e gestores para identificação, avaliação e controle de riscos no ambiente de trabalho.",
    topics: [
      "Fundamentos da NR-1 atualizada",
      "Elaboração e gestão do PGR",
      "Identificação de perigos e riscos",
      "Medidas de prevenção e controle",
      "Registros e documentação legal",
      "Responsabilidades do empregador e trabalhador",
    ],
  },
];

export default function CursosPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
            Formação Profissional
          </p>
          <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight max-w-3xl">
            Cursos que{" "}
            <span className="text-[var(--brand-yellow)]">transformam carreiras</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl">
            Formação prática e teórica ministrada por profissionais do mercado.
            Presencial em Canaã dos Carajás - PA ou modalidade EAD.
          </p>
          <div className="flex flex-wrap gap-6 mt-8">
            {[
              { icon: GraduationCap, label: "Certificado reconhecido" },
              { icon: Clock, label: "Flexibilidade de horários" },
              { icon: Users, label: "Turmas reduzidas" },
              { icon: Monitor, label: "Presencial e EAD" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-gray-300 text-sm">
                <Icon size={16} className="text-[var(--brand-yellow)]" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="py-16 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          {courses.map(({ title, badge, duration, modality, slots, description, topics }, i) => (
            <div
              key={title}
              className="bg-white grid grid-cols-1 md:grid-cols-3 overflow-hidden"
            >
              <div className={`${i % 2 === 0 ? "bg-[var(--brand-dark)]" : "bg-[var(--brand-yellow)]"} p-8 flex flex-col justify-between`}>
                <div>
                  {badge && (
                    <span className={`inline-block text-xs font-black px-2 py-1 uppercase mb-3 ${i % 2 === 0 ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-[var(--brand-dark)] text-[var(--brand-yellow)]"}`}>
                      {badge}
                    </span>
                  )}
                  <GraduationCap
                    size={40}
                    className={i % 2 === 0 ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}
                  />
                  <h2 className={`font-black text-xl uppercase mt-4 leading-tight ${i % 2 === 0 ? "text-white" : "text-[var(--brand-dark)]"}`}>
                    {title}
                  </h2>
                  <div className={`mt-4 space-y-1 text-xs ${i % 2 === 0 ? "text-gray-400" : "text-[var(--brand-dark)]/70"}`}>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} /> {duration}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Monitor size={12} /> {modality}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={12} /> {slots}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} /> Canaã dos Carajás - PA
                    </div>
                  </div>
                </div>
                <Button
                  variant={i % 2 === 0 ? "primary" : "dark"}
                  size="sm"
                  className="mt-6 w-fit"
                  asChild
                >
                  <Link href="#agendar">
                    Quero me inscrever <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>

              <div className="md:col-span-2 p-8">
                <p className="text-gray-600 leading-relaxed mb-6">{description}</p>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Conteúdo programático
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topics.map((topic) => (
                    <div key={topic} className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-[var(--brand-yellow)] shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lead capture form */}
      <section id="agendar" className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              Inscrição
            </p>
            <h2 className="text-[var(--brand-dark)] font-black text-3xl md:text-4xl uppercase">
              Garanta sua vaga
            </h2>
            <div className="w-14 h-1 bg-[var(--brand-yellow)] mx-auto mt-3" />
            <p className="text-gray-500 mt-4">
              Preencha o formulário e entraremos em contato para confirmar turma, horários e valores.
            </p>
          </div>

          <form className="bg-[var(--brand-gray-light)] p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(94) 9 9999-9999"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Curso de interesse *
              </label>
              <select
                required
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white appearance-none"
              >
                <option value="">Selecione o curso</option>
                {courses.map((c) => (
                  <option key={c.title} value={c.title}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Modalidade preferida
              </label>
              <div className="flex gap-4">
                {["Presencial", "EAD (Online)", "Indiferente"].map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="radio" name="modality" value={m} className="accent-[var(--brand-yellow)]" />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Mensagem (opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Dúvidas, horários preferidos..."
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider py-3 transition-colors"
            >
              Solicitar Informações
            </button>
            <p className="text-xs text-gray-400 text-center">
              Retornamos em até 24h no horário comercial.
            </p>
          </form>

          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-gray-500">
            <Phone size={14} className="text-[var(--brand-yellow)]" />
            Preferir ligar? <a href="tel:+5594993044689" className="font-bold text-[var(--brand-dark)] hover:text-[var(--brand-yellow)] transition-colors">(94) 99304-4689</a>
          </div>
        </div>
      </section>
    </>
  );
}
