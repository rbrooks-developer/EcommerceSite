"use client";

import { useEffect, useRef, useState } from "react";

// Cover div extends this many px beyond the visible hero in every direction.
// The displacement filter only distorts pixels in that invisible buffer zone
// (hero section overflow:hidden clips it), so the visible hero edges stay clean.
const BUFFER = 70;

interface Props {
  bgColor: string;
  fontColor: string;
  radius?: number;
  enabled?: boolean;
}

export function HeroRevealLayer({ bgColor, fontColor, radius = 210, enabled = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null); // inset:0, used for mouse-bounds tracking
  const coverRef = useRef<HTMLDivElement>(null);   // inset:-BUFFER, receives mask-image
  const radiusRef = useRef(radius);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) setIsTouch(false);
  }, []);

  useEffect(() => {
    if (!enabled || isTouch || !wrapperRef.current || !coverRef.current) return;

    const wrapper = wrapperRef.current;
    const cover = coverRef.current;

    let targetX = -9999, targetY = -9999;
    let currentX = -9999, currentY = -9999;
    let currentR = 0;
    let rafId: number;

    function onMove(e: MouseEvent) {
      const rect = wrapper.getBoundingClientRect();
      // Clamp to hero bounds on all edges
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
        // Offset by BUFFER because cover div's origin is BUFFER px above/left of hero
        const x = Math.round(currentX) + BUFFER;
        const y = Math.round(currentY) + BUFFER;
        const mask = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0%, transparent 58%, rgba(0,0,0,0.35) 72%, black 86%)`;
        cover.style.maskImage = mask;
        cover.style.setProperty("-webkit-mask-image", mask);
      } else {
        cover.style.maskImage = "linear-gradient(black, black)";
        cover.style.setProperty("-webkit-mask-image", "linear-gradient(black, black)");
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
            <filter
              id="water-distort"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
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
                scale="38"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/*
        Wrapper: normal hero bounds (inset:0), applies the water filter.
        The filter displaces pixels in the cover div — at the circle edge that
        creates the water/liquid look; at the outer edges the BUFFER absorbs the
        displacement so nothing visible moves at the hero frame boundary.
      */}
      <div
        ref={wrapperRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          transform: "translateZ(0)",
          ...(showReveal ? { filter: "url(#water-distort)" } : {}),
        }}
      >
        {/* Cover extends BUFFER px beyond wrapper; mask-image cuts the reveal hole */}
        <div
          ref={coverRef}
          style={{
            position: "absolute",
            inset: showReveal ? `-${BUFFER}px` : 0,
            backgroundColor: bgColor,
          }}
        />
        {/* Glow: soft center gradient — filter distortion on a soft gradient is imperceptible */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Bottom fade sits outside the filtered wrapper so the hero bottom edge stays clean */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
        style={{ zIndex: 2, background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
      />
    </>
  );
}
