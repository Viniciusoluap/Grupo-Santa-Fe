import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grupo Santa Fé",
    short_name: "Santa Fé",
    description:
      "Acesse os serviços e funcionalidades do Grupo Santa Fé direto da tela inicial do seu celular.",
    start_url: "/?pwa=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#1A1A1A",
    background_color: "#FFFFFF",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
