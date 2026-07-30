"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  bgColor: string;
  fontColor: string;
  radius?: number;
  enabled?: boolean;
}

// Background layer: bgColor + glow + bottom fade.
// When enabled, the cursor parts the layer like fog — the hole opens smoothly
// as you enter, follows with a slight spring lag, and closes as you leave.
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

    // Target: where the cursor actually is. Current: spring-lagged position.
    let targetX = -9999, targetY = -9999;
    let currentX = -9999, currentY = -9999;
    let currentR = 0; // animates open on enter, closed on leave
    let rafId: number;

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (y >= 0 && y <= rect.height) {
        // Clamp x to hero bounds so both left and right edges hold the circle
        // instead of the right edge (scrollbar gap) collapsing it
        targetX = Math.max(0, Math.min(rect.width, x));
        targetY = y;
      } else {
        targetX = -9999;
        targetY = -9999;
      }
    }

    function tick() {
      const isInside = targetX >= 0;

      // Spring-lerp position toward cursor
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      // Animate radius: expand when inside, collapse when outside
      const targetR = isInside ? radiusRef.current : 0;
      currentR += (targetR - currentR) * 0.09;

      if (currentR > 1.5) {
        const r = Math.round(currentR);
        const x = Math.round(currentX);
        const y = Math.round(currentY);
        // Multi-stop gradient with ease-in curve: slow fog start, rapid thickening
        const mask =
          `radial-gradient(circle ${r}px at ${x}px ${y}px,` +
          ` transparent 0%,` +
          ` transparent 18%,` +
          ` rgba(0,0,0,0.04) 30%,` +
          ` rgba(0,0,0,0.18) 48%,` +
          ` rgba(0,0,0,0.52) 63%,` +
          ` rgba(0,0,0,0.84) 78%,` +
          ` black 92%)`;
        el.style.maskImage = mask;
        el.style.setProperty("-webkit-mask-image", mask);
      } else {
        el.style.maskImage = "linear-gradient(black, black)";
        el.style.setProperty("-webkit-mask-image", "linear-gradient(black, black)");
      }

      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
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
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
      />
    </div>
  );
}
