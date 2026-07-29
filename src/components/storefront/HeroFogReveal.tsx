"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  bgColor: string;
  radius?: number;
  opacity?: number;
  blur?: number;
}

export function HeroFogReveal({ bgColor, radius = 210, opacity = 80, blur = 5 }: Props) {
  const fogRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(true);

  // Detect touch device on the client (SSR defaults to touch = hidden)
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) {
      setIsTouch(false);
    }
  }, []);

  // Add mouse listener once we know it's a pointer device and the div is mounted
  useEffect(() => {
    if (isTouch || !fogRef.current) return;
    const el = fogRef.current;

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      const r = el.dataset.radius ?? "210";
      const mask = inside
        ? `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0%, transparent 35%, black 75%)`
        : "linear-gradient(black, black)";
      el.style.maskImage = mask;
      el.style.setProperty("-webkit-mask-image", mask);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isTouch]);

  if (isTouch) return null;

  const alphaHex = Math.round((opacity / 100) * 255).toString(16).padStart(2, "0");

  return (
    <div
      ref={fogRef}
      aria-hidden="true"
      data-radius={radius}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: "none",
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        backgroundColor: `${bgColor}${alphaHex}`,
        maskImage: "linear-gradient(black, black)",
        transform: "translateZ(0)",
      }}
    />
  );
}
