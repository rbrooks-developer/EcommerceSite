"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const BLUR_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

export function ProductImages({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const [touchZoomed, setTouchZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

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

  // iOS Safari ignores touch-action CSS and passive-listener prevention at the element level.
  // The only reliable fix is locking document.body with position:fixed while the finger is
  // on the image (same pattern used by react-modal, framer-motion, etc.).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let savedScrollY = 0;

    function lockBody() {
      savedScrollY = window.scrollY;
      Object.assign(document.body.style, {
        overflow: "hidden",
        position: "fixed",
        top: `-${savedScrollY}px`,
        width: "100%",
      });
    }

    function unlockBody() {
      Object.assign(document.body.style, {
        overflow: "",
        position: "",
        top: "",
        width: "",
      });
      window.scrollTo(0, savedScrollY);
    }

    function blockMove(e: TouchEvent) {
      e.preventDefault();
    }

    el.addEventListener("touchstart", lockBody, { passive: true });
    el.addEventListener("touchend", unlockBody, { passive: true });
    el.addEventListener("touchcancel", unlockBody, { passive: true });
    el.addEventListener("touchmove", blockMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", lockBody);
      el.removeEventListener("touchend", unlockBody);
      el.removeEventListener("touchcancel", unlockBody);
      el.removeEventListener("touchmove", blockMove);
      unlockBody();
    };
  }, []);

  // Mobile/tablet: tap to zoom in (stays zoomed), drag to pan, tap again to zoom out
  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    touchMovedRef.current = false;
    if (!touchZoomed) zoomIn(t.clientX, t.clientY); // preview zoom at touch point
  }

  function handleTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    const start = touchStartRef.current;
    if (start) {
      if (Math.abs(t.clientX - start.x) > 5 || Math.abs(t.clientY - start.y) > 5)
        touchMovedRef.current = true;
    }
    if (touchZoomed) pan(t.clientX, t.clientY);
  }

  function handleTouchEnd() {
    const wasTap = !touchMovedRef.current;
    if (!touchZoomed) {
      if (wasTap) {
        setTouchZoomed(true); // confirm zoom, image stays zoomed
      } else {
        zoomOut(); // drag on un-zoomed: cancel preview
      }
    } else {
      if (wasTap) {
        zoomOut();
        setTouchZoomed(false);
      }
      // drag while zoomed: stay zoomed, user was panning
    }
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

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="product-zoom-container relative aspect-square overflow-hidden rounded-lg cursor-crosshair"
        style={{ backgroundColor: "var(--product-detail-bg, transparent)", zIndex: 46, isolation: "isolate", touchAction: "none" }}
        onMouseEnter={(e) => zoomIn(e.clientX, e.clientY)}
        onMouseMove={(e) => pan(e.clientX, e.clientY)}
        onMouseLeave={zoomOut}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
              onClick={() => { setSelected(i); if (touchZoomed) { zoomOut(); setTouchZoomed(false); } }}
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
    </div>
  );
}
