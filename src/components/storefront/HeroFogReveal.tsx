"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  bgColor: string;
  fontColor: string;
  radius?: number;
  enabled?: boolean;
}

export function HeroRevealLayer({ bgColor, fontColor, radius = 210, enabled = false }: Props) {
  const coverRef = useRef<HTMLDivElement>(null);
  const radiusRef = useRef(radius);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) setIsTouch(false);
  }, []);

  useEffect(() => {
    if (!enabled || isTouch || !coverRef.current) return;

    const el = coverRef.current;
    let targetX = -9999, targetY = -9999;
    let currentX = -9999, currentY = -9999;
    let currentR = 0;
    let rafId: number;

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      // Clamp to hero bounds on all 4 edges so the circle holds at every edge
      targetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      targetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    }

    function onWindowLeave() {
      targetX = -9999;
      targetY = -9999;
    }

    function tick() {
      const isInside = targetX >= 0;
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      const targetR = isInside ? radiusRef.current : 0;
      currentR += (targetR - currentR) * 0.09;

      if (currentR > 1.5) {
        const r = Math.round(currentR);
        const x = Math.round(currentX);
        const y = Math.round(currentY);
        const mask = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0%, transparent 58%, rgba(0,0,0,0.35) 72%, black 86%)`;
        el.style.maskImage = mask;
        el.style.setProperty("-webkit-mask-image", mask);
      } else {
        el.style.maskImage = "linear-gradient(black, black)";
        el.style.setProperty("-webkit-mask-image", "linear-gradient(black, black)");
      }

      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onWindowLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onWindowLeave);
      cancelAnimationFrame(rafId);
    };
  }, [enabled, isTouch]);

  const showReveal = enabled && !isTouch;

  return (
    <>
      {showReveal && (
        <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            {/*
              scale="20": enough displacement for organic water edges at the circle
              boundary, small enough that the 20px max wiggle at the hero frame
              edges (where pixels are all the same bgColor) is imperceptible.
            */}
            <filter
              id="water-distort"
              x="-15%"
              y="-15%"
              width="130%"
              height="130%"
              colorInterpolationFilters="linearRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.013 0.009"
                numOctaves="3"
                seed="4"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  values="0.013 0.009;0.021 0.015;0.011 0.019;0.019 0.011;0.013 0.009"
                  dur="12s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="20"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/*
        Wrapper applies the water filter to the masked cover div.
        At solid-color edges displacement is invisible — the organic water
        effect only appears where the mask transitions at the reveal circle.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          transform: "translateZ(0)",
          ...(showReveal ? { filter: "url(#water-distort)" } : {}),
        }}
      >
        {/* Cover: bgColor everywhere; mask-image cuts the reveal circle via rAF */}
        <div
          ref={coverRef}
          style={{ position: "absolute", inset: 0, backgroundColor: bgColor }}
        />
        {/* Glow: soft center radial */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
          }}
        />
        {/* Bottom fade: inside the wrapper so it is masked by the circle hole */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
          style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
        />
      </div>

      {/*
        Edge fades sit OUTSIDE the filtered wrapper at z:2.
        They are never distorted by the filter and cleanly cover the ≤20 px
        displacement artifacts at each hero boundary — same technique as
        the bottom fade that already fixed the bottom edge.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 right-0" style={{ height: "60px", zIndex: 2, background: `linear-gradient(to bottom, ${bgColor} 40%, transparent)` }} />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 bottom-0" style={{ width: "40px", zIndex: 2, background: `linear-gradient(to left, ${bgColor}, transparent)` }} />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 bottom-0" style={{ width: "40px", zIndex: 2, background: `linear-gradient(to right, ${bgColor}, transparent)` }} />
    </>
  );
}
