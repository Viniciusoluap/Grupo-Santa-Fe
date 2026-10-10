"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getInstallPrompt,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
} from "@/lib/pwa";

export function InstallActions() {
  const [canInstall, setCanInstall] = useState(() => Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(() => isStandalone());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const unsubscribe = onInstallPromptChange(() => {
      setCanInstall(Boolean(getInstallPrompt()));
      setInstalled(isStandalone());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  async function handleInstallClick() {
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") setInstalled(true);
    } finally {
      setInstalling(false);
    }
  }

  if (installed) {
    return (
      <Button variant="primary" size="lg" asChild>
        <Link href="/">
          <CheckCircle2 size={18} />
          Abrir aplicativo
        </Link>
      </Button>
    );
  }

  if (canInstall) {
    return (
      <Button variant="primary" size="lg" disabled={installing} onClick={handleInstallClick}>
        <Download size={18} />
        {installing ? "Instalando…" : "Instalar aplicativo"}
      </Button>
    );
  }

  return (
    <p className="text-sm text-gray-400 max-w-md">
      Seu navegador ainda não oferece a instalação automática. Siga as instruções abaixo
      para adicionar o aplicativo à tela inicial manualmente.
    </p>
  );
}
