"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  bgColor: string;
}

export function HeroFogReveal({ bgColor }: Props) {
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
      const mask = inside
        ? `radial-gradient(circle 210px at ${x}px ${y}px, transparent 0%, transparent 35%, black 75%)`
        : "linear-gradient(black, black)";
      el.style.maskImage = mask;
      el.style.setProperty("-webkit-mask-image", mask);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isTouch]);

  if (isTouch) return null;

  return (
    <div
      ref={fogRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: "none",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        backgroundColor: `${bgColor}cc`, // 80% opacity tint using site bg color
        maskImage: "linear-gradient(black, black)",
        transform: "translateZ(0)", // GPU layer for smooth mask updates
      }}
    />
  );
}
