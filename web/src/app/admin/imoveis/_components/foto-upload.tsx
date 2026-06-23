"use client";

import { useState, useRef, useCallback } from "react";
import { ImagePlus, X } from "lucide-react";

const MIN_FOTOS = 5;
const MAX_FOTOS = 15;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_DIM = 1200;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

interface FotoUploadProps {
  name: string;
  defaultValue?: string;
}

export function FotoUpload({ name, defaultValue }: FotoUploadProps) {
  const [fotos, setFotos] = useState<string[]>(() => {
    try { return defaultValue ? JSON.parse(defaultValue) : []; } catch { return []; }
  });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const compressed = await Promise.all(imgs.slice(0, MAX_FOTOS - fotos.length).map(compressImage));
    setFotos((prev) => [...prev, ...compressed].slice(0, MAX_FOTOS));
  }, [fotos.length]);

  const remove = (i: number) => setFotos((p) => p.filter((_, j) => j !== i));
  const swap = (i: number, j: number) => setFotos((p) => {
    const a = [...p];
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(fotos)} />

      <div
        onClick={() => fotos.length < MAX_FOTOS && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 transition-colors ${
          fotos.length >= MAX_FOTOS ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${drag ? "border-[var(--brand-yellow)] bg-yellow-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}
      >
        <ImagePlus size={28} className="text-gray-400" />
        <p className="text-sm text-gray-500 font-medium">Clique ou arraste as fotos aqui</p>
        <p className="text-xs text-gray-400">
          {fotos.length}/{MAX_FOTOS} fotos · mín. {MIN_FOTOS} · máx. {MAX_FOTOS}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {fotos.length > 0 && fotos.length < MIN_FOTOS && (
        <p className="text-xs text-amber-600 mt-1.5 font-medium">
          Adicione mais {MIN_FOTOS - fotos.length} foto(s) — mínimo {MIN_FOTOS}
        </p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
          {fotos.map((src, i) => (
            <div key={i} className="relative group aspect-square bg-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-[9px] font-black px-1.5 py-0.5 uppercase leading-none">
                  Capa
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {i > 0 && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); swap(i, i - 1); }}
                    className="bg-white text-black rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center hover:bg-gray-100">
                    ←
                  </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600">
                  <X size={12} />
                </button>
                {i < fotos.length - 1 && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); swap(i, i + 1); }}
                    className="bg-white text-black rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center hover:bg-gray-100">
                    →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
