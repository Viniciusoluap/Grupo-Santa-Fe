"use client";

import { useRef, useState, useEffect } from "react";
import { Camera } from "lucide-react";

interface Props {
  userName: string;
}

export function FotoPerfilClient({ userName }: Props) {
  const [foto, setFoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/perfil/foto")
      .then((r) => r.json())
      .then((d: { foto?: string | null }) => {
        if (d.foto) setFoto(d.foto);
      })
      .catch(() => {});
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
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
        setPreview(canvas.toDataURL("image/jpeg", 0.8));
        setSaved(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSalvar() {
    if (!preview) return;
    setUploading(true);
    try {
      const res = await fetch("/api/perfil/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto: preview }),
      });
      const data = (await res.json()) as { ok?: boolean; foto?: string };
      if (data.ok && data.foto) {
        setFoto(data.foto);
        setPreview(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setUploading(false);
    }
  }

  const exibida = preview ?? foto;

  return (
    <div className="bg-white border border-gray-100 p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Foto de Perfil</p>
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--brand-yellow)] flex items-center justify-center flex-shrink-0">
          {exibida ? (
            <img src={exibida} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[var(--brand-dark)] font-black text-2xl">
              {userName?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="space-y-2 flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide hover:bg-gray-50 transition-colors"
          >
            <Camera size={13} /> Escolher foto
          </button>
          {preview && (
            <button
              onClick={handleSalvar}
              disabled={uploading}
              className="flex items-center gap-2 bg-[var(--brand-yellow)] px-4 py-2 text-xs font-black text-[var(--brand-dark)] uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? "Salvando..." : "Salvar foto"}
            </button>
          )}
          {saved && (
            <p className="text-xs text-green-600 font-medium">Foto atualizada com sucesso!</p>
          )}
          <p className="text-xs text-gray-400">A foto será usada no seu perfil e no menu lateral.</p>
        </div>
      </div>
    </div>
  );
}
