"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PropertyGalleryProps {
  images: string[];
  title: string;
  typeLetter?: string;
}

export function PropertyGallery({ images, title, typeLetter }: PropertyGalleryProps) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative bg-[var(--brand-dark)] aspect-video flex items-center justify-center">
        <div className="text-[var(--brand-yellow)]/10 text-9xl font-black uppercase select-none">
          {typeLetter ?? "A"}
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-gray-400">
          Fotos em breve
        </div>
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <div>
      {/* Foto principal */}
      <div className="relative aspect-video bg-[var(--brand-dark)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt={`${title} — foto ${current + 1}`}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 transition-colors"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 transition-colors"
              aria-label="Próxima foto"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 font-mono">
              {current + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Miniaturas */}
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-16 h-12 overflow-hidden border-2 transition-all ${
                i === current
                  ? "border-[var(--brand-yellow)] opacity-100"
                  : "border-transparent opacity-60 hover:opacity-90"
              }`}
              aria-label={`Ver foto ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
