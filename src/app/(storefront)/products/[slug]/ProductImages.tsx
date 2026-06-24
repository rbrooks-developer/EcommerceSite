"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductImages({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function getPos(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function zoomIn(clientX: number, clientY: number) {
    if (!wrapperRef.current) return;
    const { x, y } = getPos(clientX, clientY);
    wrapperRef.current.style.transition = "transform 200ms ease-out";
    wrapperRef.current.style.transformOrigin = `${x}% ${y}%`;
    wrapperRef.current.style.transform = "scale(2.5)";
  }

  function pan(clientX: number, clientY: number) {
    if (!wrapperRef.current) return;
    const { x, y } = getPos(clientX, clientY);
    wrapperRef.current.style.transition = "none";
    wrapperRef.current.style.transformOrigin = `${x}% ${y}%`;
  }

  function zoomOut() {
    if (!wrapperRef.current) return;
    wrapperRef.current.style.transition = "transform 200ms ease-out";
    wrapperRef.current.style.transform = "scale(1)";
  }

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-lg flex items-center justify-center text-gray-300" style={{ backgroundColor: "var(--site-bg)" }}>
        <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="product-zoom-container relative aspect-square overflow-hidden rounded-lg cursor-crosshair"
        style={{ backgroundColor: "var(--site-bg)" }}
        onMouseEnter={(e) => zoomIn(e.clientX, e.clientY)}
        onMouseMove={(e) => pan(e.clientX, e.clientY)}
        onMouseLeave={zoomOut}
        onTouchStart={(e) => { const t = e.touches[0]; zoomIn(t.clientX, t.clientY); }}
        onTouchMove={(e) => { const t = e.touches[0]; pan(t.clientX, t.clientY); }}
        onTouchEnd={zoomOut}
      >
        <div
          ref={wrapperRef}
          className="product-zoom-wrapper absolute inset-0"
          style={{ transformOrigin: "50% 50%" }}
        >
          <Image
            src={images[selected]}
            alt={`${name} - image ${selected + 1}`}
            fill
            className="object-contain p-4"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 justify-center overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setSelected(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
                i === selected ? "border-current" : "border-transparent opacity-50"
              )}
            >
              <Image src={src} alt={`Thumbnail ${i + 1}`} fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
