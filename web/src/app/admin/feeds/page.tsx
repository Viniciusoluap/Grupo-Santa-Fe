import { ExternalLink, Rss, CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { FeedCopyButton } from "./feed-copy-button";
import { ProspeccaoModule } from "./_components/prospeccao-module";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gruposantafe.com.br";
const BRAVE_CONFIGURED = !!process.env.BRAVE_SEARCH_API_KEY && !!process.env.ANTHROPIC_API_KEY;

const feeds = [
  {
    id: "creci",
    name: "Portal CRECI",
    description: "Feed XML para o portal oficial do CRECI — totalmente gratuito para corretores registrados",
    url: `${SITE_URL}/api/feed/zap`,
    path: "/api/feed/zap",
    color: "#1565C0",
    gratuito: true,
    instructions: [
      "Acesse portalcreci.org.br e faça login com seu CRECI",
      "Vá em Meu Painel → Integração XML",
      "Cole a URL do feed no campo indicado",
      "O portal aceita o formato ZAP — use este mesmo feed",
    ],
  },
  {
    id: "chavesnamao",
    name: "Chaves na Mão",
    description: "Feed XML no formato Chaves na Mão — gratuito após cadastro no portal",
    url: `${SITE_URL}/api/feed/chavesnamao`,
    path: "/api/feed/chavesnamao",
    color: "#E65100",
    gratuito: true,
    instructions: [
      "Cadastre sua imobiliária em chavesnamao.com.br",
      "Solicite ativação da integração XML pelo suporte",
      "Informe a URL do feed — o portal atualiza toda noite",
      "Dúvidas: help.chavesnamao.com.br",
    ],
  },
  {
    id: "olx",
    name: "OLX Imóveis",
    description: "Feed XML no formato padrão OLX — integração gratuita via developers.olx.com.br",
    url: `${SITE_URL}/api/feed/olx`,
    path: "/api/feed/olx",
    color: "#6E3ADB",
    gratuito: true,
    instructions: [
      "Acesse developers.olx.com.br (não as configurações normais da conta)",
      "Crie uma conta de desenvolvedor ou use a conta OLX existente",
      "Crie um novo anunciante via API e obtenha um access_token",
      "Envie a URL do feed ao suporte OLX para ativação da integração XML",
    ],
  },
  {
    id: "zap",
    name: "ZAP Imóveis",
    description: "Feed XML padrão ZAP ListingDataFeed — requer conta imobiliária paga",
    url: `${SITE_URL}/api/feed/zap`,
    path: "/api/feed/zap",
    color: "#E8190C",
    gratuito: false,
    instructions: [
      "Requer conta de imobiliária paga no ZAP Imóveis",
      "Acesse o painel → Configurações → Integração XML",
      "Cole a URL do feed no campo indicado",
      "O portal atualiza automaticamente a cada 24h",
    ],
  },
  {
    id: "vivareal",
    name: "Viva Real",
    description: "Feed XML padrão Viva Real / Grupo ZAP — requer conta paga",
    url: `${SITE_URL}/api/feed/vivareal`,
    path: "/api/feed/vivareal",
    color: "#00A884",
    gratuito: false,
    instructions: [
      "Requer conta paga no Viva Real",
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
    select: { id: true, status: true },
  });

  const total = imoveis.length;
  const aVenda = imoveis.filter((p) => p.status === "venda").length;
  const paraLocacao = imoveis.filter((p) => p.status === "locacao").length;

  const gratuitos = feeds.filter((f) => f.gratuito);
  const pagos = feeds.filter((f) => !f.gratuito);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Portais e Prospecção</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total} imóveis disponíveis para exportação
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Rss size={14} />
          Feeds atualizados a cada 1h
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

      {/* Free portals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} className="text-green-600" />
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Portais Gratuitos</p>
        </div>
        <div className="space-y-4">
          {gratuitos.map((feed) => (
            <FeedCard key={feed.id} feed={feed} />
          ))}
        </div>
      </div>

      {/* Paid portals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-gray-400" />
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Portais Pagos (feed disponível)</p>
        </div>
        <div className="space-y-4">
          {pagos.map((feed) => (
            <FeedCard key={feed.id} feed={feed} />
          ))}
        </div>
      </div>

      {/* Technical info */}
      <div className="bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)] p-4">
        <p className="text-sm font-bold text-[var(--brand-dark)] mb-1">Informação técnica</p>
        <p className="text-sm text-gray-600">
          Os feeds são gerados dinamicamente a partir do cadastro de imóveis. Cada portal deve ser
          configurado uma única vez com a URL do feed — as atualizações são refletidas automaticamente
          sem reconfiguração. Cache renovado a cada 1 hora.
        </p>
      </div>

      {/* AI Prospection module */}
      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Prospecção Automática</p>
        <ProspeccaoModule apiConfigurada={BRAVE_CONFIGURED} />
      </div>
    </div>
  );
}

function FeedCard({ feed }: { feed: typeof feeds[number] }) {
  return (
    <div className="bg-white border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center text-white font-black text-xs flex-shrink-0"
            style={{ backgroundColor: feed.color }}
          >
            {feed.name.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-[var(--brand-dark)]">{feed.name}</h2>
              {feed.gratuito && (
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 uppercase">Gratuito</span>
              )}
            </div>
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
  );
}
