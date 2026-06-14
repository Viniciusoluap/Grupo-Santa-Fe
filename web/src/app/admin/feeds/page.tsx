import { ExternalLink, Rss } from "lucide-react";
import { prisma } from "@/lib/db";
import { FeedCopyButton } from "./feed-copy-button";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gruposantafe.com.br";

const feeds = [
  {
    id: "zap",
    name: "ZAP Imóveis",
    description: "Feed XML compatível com o padrão ZAP ListingDataFeed",
    url: `${SITE_URL}/api/feed/zap`,
    path: "/api/feed/zap",
    color: "#E8190C",
    instructions: [
      "Acesse o painel do ZAP Imóveis",
      "Vá em Configurações → Integração XML",
      "Cole a URL do feed no campo indicado",
      "O portal atualiza automaticamente a cada 24h",
    ],
  },
  {
    id: "olx",
    name: "OLX",
    description: "Feed XML no formato padrão OLX para anúncios imobiliários",
    url: `${SITE_URL}/api/feed/olx`,
    path: "/api/feed/olx",
    color: "#6E3ADB",
    instructions: [
      "Acesse sua conta profissional OLX",
      "Vá em Minha conta → Integração de anúncios",
      "Insira a URL do feed XML no campo de integração",
      "Aguarde a sincronização (até 4h)",
    ],
  },
  {
    id: "vivareal",
    name: "Viva Real",
    description: "Feed XML compatível com o padrão Viva Real / Grupo ZAP",
    url: `${SITE_URL}/api/feed/vivareal`,
    path: "/api/feed/vivareal",
    color: "#00A884",
    instructions: [
      "Acesse o painel do Viva Real",
      "Vá em Conta → Integração de Imóveis",
      "Cadastre a URL do feed XML",
      "O sistema sincroniza automaticamente",
    ],
  },
];

export default async function FeedsPage() {
  const imoveis = await prisma.imovel.findMany({
    where: { publicadoSite: true, status: { notIn: ["vendido", "locado"] } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, status: true, publicadoZap: true, publicadoOlx: true, publicadoViva: true },
  });

  const total = imoveis.length;
  const aVenda = imoveis.filter((p) => p.status === "venda").length;
  const paraLocacao = imoveis.filter((p) => p.status === "locacao").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Exportação para Portais</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total} imóveis disponíveis para exportação
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Rss size={14} />
          Atualização automática a cada 1h
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de Imóveis", value: total },
          { label: "À Venda", value: aVenda },
          { label: "Para Locação", value: paraLocacao },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 p-4">
            <p className="font-black text-[var(--brand-dark)] text-2xl">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Feed Cards */}
      <div className="space-y-4">
        {feeds.map((feed) => (
          <div key={feed.id} className="bg-white border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                  style={{ backgroundColor: feed.color }}
                >
                  {feed.name.slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-[var(--brand-dark)]">{feed.name}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{feed.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FeedCopyButton text={feed.url} />
                <a
                  href={feed.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={12} />
                  Visualizar XML
                </a>
              </div>
            </div>

            <div className="mt-4 bg-gray-50 px-4 py-3 flex items-center gap-3">
              <code className="text-xs text-gray-600 flex-1 truncate font-mono">{feed.url}</code>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Como integrar</p>
              <ol className="space-y-1">
                {feed.instructions.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-xs font-black text-[var(--brand-dark)] w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)] p-4">
        <p className="text-sm font-bold text-[var(--brand-dark)] mb-1">Informação técnica</p>
        <p className="text-sm text-gray-600">
          Os feeds são gerados dinamicamente a partir do cadastro de imóveis. Cada portal deve ser
          configurado uma única vez com a URL do feed — as atualizações de imóveis são refletidas
          automaticamente sem necessidade de reconfiguração. O cache do servidor é renovado a cada
          1 hora.
        </p>
      </div>
    </div>
  );
}
