// Suporte à instalação como PWA: registro do Service Worker e captura do
// evento nativo de instalação (beforeinstallprompt), disponível apenas no
// Android/Chrome. No iOS não existe esse evento — a instalação é sempre
// manual via Safari/Chrome ("Adicionar à Tela de Início").

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

export function onInstallPromptChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (window.navigator as { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || navigatorStandalone === true;
}

export async function promptInstall() {
  if (!deferredPrompt) return "unavailable" as const;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome;
}

export function initPwa() {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(error => {
        console.error("[PWA] Falha ao registrar o Service Worker", error);
      });
    });
  }
}
