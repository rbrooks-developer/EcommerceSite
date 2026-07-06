"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

const BLUR_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

export function ProductImages({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Desktop hover-zoom refs
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
      <div className="aspect-square rounded-lg flex items-center justify-center text-gray-300">
        <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  const slides = images.map((src) => ({ src }));

  return (
    <div className="space-y-3">
      {/* Mobile: tap-to-lightbox */}
      <div
        className="relative aspect-[3/4] overflow-hidden lg:hidden cursor-zoom-in"
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          src={images[selected]}
          alt={`${name} - image ${selected + 1}`}
          fill
          className="object-contain p-4"
          sizes="100vw"
          priority
          placeholder="blur"
          blurDataURL={BLUR_URL}
        />
        <div className="absolute bottom-2 right-2 rounded-full bg-black/40 p-1.5 text-white pointer-events-none">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-3-3v2m0 4h.01" />
          </svg>
        </div>
      </div>

      {/* Desktop: hover-zoom */}
      <div
        ref={containerRef}
        className="product-zoom-container relative aspect-square overflow-hidden rounded-lg cursor-crosshair hidden lg:block"
        style={{ zIndex: 46, isolation: "isolate" }}
        onMouseEnter={(e) => zoomIn(e.clientX, e.clientY)}
        onMouseMove={(e) => pan(e.clientX, e.clientY)}
        onMouseLeave={zoomOut}
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
            sizes="50vw"
            priority
            placeholder="blur"
            blurDataURL={BLUR_URL}
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
              <Image
                src={src}
                alt={`Thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
                placeholder="blur"
                blurDataURL={BLUR_URL}
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={selected}
        slides={slides}
        plugins={[Zoom]}
        on={{ view: ({ index }) => setSelected(index) }}
        zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
        carousel={{ finite: images.length <= 1 }}
        styles={{ root: { "--yarl__color_backdrop": "rgba(0,0,0,0.92)" } }}
      />
    </div>
  );
}
