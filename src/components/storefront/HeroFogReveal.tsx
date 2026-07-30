"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  bgColor: string;
  fontColor: string;
  radius?: number;
  enabled?: boolean;
}

// Renders the hero background layer (bgColor + glow + bottom fade).
// When enabled=true, a cursor-driven mask cuts a hole to reveal what's behind.
export function HeroRevealLayer({ bgColor, fontColor, radius = 210, enabled = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const radiusRef = useRef(radius);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) setIsTouch(false);
  }, []);

  useEffect(() => {
    if (!enabled || isTouch || !ref.current) return;
    const el = ref.current;

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      const mask = inside
        ? `radial-gradient(circle ${radiusRef.current}px at ${x}px ${y}px, transparent 0%, transparent 35%, black 75%)`
        : "linear-gradient(black, black)";
      el.style.maskImage = mask;
      el.style.setProperty("-webkit-mask-image", mask);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled, isTouch]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        backgroundColor: bgColor,
        transform: "translateZ(0)",
      }}
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
        }}
      />
      {/* Bottom fade into page background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
      />
    </div>
  );
}
