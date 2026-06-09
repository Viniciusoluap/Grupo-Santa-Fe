import type { NextConfig } from "next";

const securityHeaders = [
  // Força HTTPS por 2 anos, inclui subdomínios
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Impede o site de ser carregado em iframe de outros domínios (clickjacking)
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // Impede MIME sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Controla informações enviadas no Referer
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  // Desativa recursos sensíveis não usados
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Remove header que revela Next.js
  {
    key: "X-Powered-By",
    value: "",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Garante que http:// redireciona para https://www
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://www.gruposantafee.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
