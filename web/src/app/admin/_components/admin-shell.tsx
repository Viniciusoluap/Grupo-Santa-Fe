"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { NotificacaoConteudo } from "@/components/notificacao-conteudo";
import Link from "next/link";
import { Menu, Bell, X, Camera, User } from "lucide-react";
import { Sidebar } from "@/components/admin/sidebar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/auth";

interface NotificacaoItem {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criadoEm: string;
}

export function AdminShell({ children, rotasPermitidas }: { children: React.ReactNode; rotasPermitidas: string[] }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fotoModal, setFotoModal] = useState(false);
  const [userFoto, setUserFoto] = useState<string | null>(null);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [uploading, setUploading] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = session?.user?.name ?? "Usuário";
  const userRole = ((session?.user as { role?: UserRole })?.role) ?? "admin";

  // Fundo atrás da página igual ao do painel (sem faixa branca no overscroll do iPad).
  useEffect(() => {
    document.documentElement.classList.add("area-admin");
    return () => document.documentElement.classList.remove("area-admin");
  }, []);

  // Fetch photo on mount
  useEffect(() => {
    fetch("/api/perfil/foto")
      .then((r) => r.json())
      .then((d: { foto?: string | null }) => {
        if (d.foto) setUserFoto(d.foto);
      })
      .catch(() => {});
  }, []);

  // Fetch notifications
  const fetchNotificacoes = useCallback(async () => {
    try {
      const res = await fetch("/api/notificacoes");
      const data = (await res.json()) as { notificacoes?: NotificacaoItem[] };
      setNotificacoes(data.notificacoes ?? []);
      setAgora(Date.now());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchNotificacoes, 0);
    const interval = setInterval(fetchNotificacoes, 60000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [fetchNotificacoes]);

  async function handleMarcarLidas() {
    await fetch("/api/notificacoes/ler", { method: "POST" });
    setNotificacoes([]);
    setBellOpen(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Resize to 200x200 with canvas crop
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        setPreviewFoto(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSalvarFoto() {
    if (!previewFoto) return;
    setUploading(true);
    try {
      const res = await fetch("/api/perfil/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto: previewFoto }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        foto?: string;
        error?: string;
      };
      if (data.ok && data.foto) {
        setUserFoto(data.foto);
        setFotoModal(false);
        setPreviewFoto(null);
      }
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  }

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  function tempoRelativo(dateStr: string) {
    const diff = agora - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `há ${d}d`;
    if (h > 0) return `há ${h}h`;
    if (min > 0) return `há ${min}min`;
    return "agora";
  }

  return (
    <div className="min-h-screen flex bg-[var(--brand-gray-light)] print:block print:min-h-0 print:bg-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Close bell/profile dropdowns on outside click — z-10 stays below header z-20 */}
      {(bellOpen || profileOpen) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setBellOpen(false);
            setProfileOpen(false);
          }}
        />
      )}

      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto print:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          userName={userName}
          userRole={userRole} rotasPermitidas={rotasPermitidas}
          userFoto={userFoto}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-20 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-[var(--brand-dark)] p-1"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3 relative">
            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen(!bellOpen);
                  setProfileOpen(false);
                  if (!bellOpen) fetchNotificacoes();
                }}
                className="relative text-gray-600 hover:text-[var(--brand-dark)] p-1.5"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Bell dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-10 w-[22rem] max-w-[calc(100vw-1rem)] bg-white border border-gray-200 shadow-xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-black text-[var(--brand-dark)] text-xs uppercase tracking-wide">
                      Notificações {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarcarLidas}
                          className="text-xs text-gray-600 hover:text-[var(--brand-dark)] font-medium"
                        >
                          Marcar lidas
                        </button>
                      )}
                      <button
                        onClick={() => setBellOpen(false)}
                        className="text-gray-500 hover:text-gray-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {notificacoes.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell size={24} className="text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-600">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notificacoes.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-start gap-3 ${
                            !n.lida ? "bg-blue-50/30" : ""
                          }`}
                          onClick={() => {
                            if (n.link) window.location.href = n.link;
                            setBellOpen(false);
                          }}
                        >
                          <NotificacaoConteudo tipo={n.tipo} titulo={n.titulo} mensagem={n.mensagem} link={n.link} quando={tempoRelativo(n.criadoEm)} />
                        </div>
                      ))
                    )}
                  </div>
                  <Link href="/admin/notificacoes" onClick={() => setBellOpen(false)} className="block text-center text-xs font-bold text-[var(--brand-dark)] hover:bg-gray-50 border-t border-gray-100 py-2.5">
                    Ver todas as notificações
                  </Link>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setBellOpen(false);
                }}
                className="w-8 h-8 rounded-full overflow-hidden bg-[var(--brand-yellow)] flex items-center justify-center hover:ring-2 hover:ring-[var(--brand-yellow)] hover:ring-offset-1 transition-all"
              >
                {userFoto ? (
                  <img
                    src={userFoto}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[var(--brand-dark)] font-black text-xs">
                    {userName?.[0]?.toUpperCase()}
                  </span>
                )}
              </button>

              {/* Profile dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-10 w-56 bg-white border border-gray-200 shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-bold text-[var(--brand-dark)] text-sm">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-600 capitalize">{userRole}</p>
                  </div>
                  <button
                    onClick={() => {
                      setFotoModal(true);
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Camera size={15} /> Alterar foto
                  </button>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <User size={15} /> Meu perfil
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>

      {/* Photo upload modal */}
      {fotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-sm mx-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-wide">
                Alterar Foto de Perfil
              </h2>
              <button
                onClick={() => {
                  setFotoModal(false);
                  setPreviewFoto(null);
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--brand-yellow)] flex items-center justify-center">
                  {previewFoto ? (
                    <img
                      src={previewFoto}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : userFoto ? (
                    <img
                      src={userFoto}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[var(--brand-dark)] font-black text-3xl">
                      {userName?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wide py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Camera size={14} /> Escolher foto
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setFotoModal(false);
                    setPreviewFoto(null);
                  }}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs uppercase py-2.5 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarFoto}
                  disabled={!previewFoto || uploading}
                  className="flex-1 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2.5 hover:bg-[var(--brand-yellow-dark)] disabled:opacity-40 transition-colors"
                >
                  {uploading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
