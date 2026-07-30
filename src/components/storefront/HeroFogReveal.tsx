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
  const circleRef = useRef<SVGCircleElement>(null);
  const radiusRef = useRef(radius);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) setIsTouch(false);
  }, []);

  useEffect(() => {
    if (!enabled || isTouch || !coverRef.current || !circleRef.current) return;

    const cover = coverRef.current;

    let targetX = -9999, targetY = -9999;
    let currentX = -9999, currentY = -9999;
    let currentR = 0;
    let rafId: number;

    function onMove(e: MouseEvent) {
      const rect = cover.getBoundingClientRect();
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

      const circle = circleRef.current;
      if (circle) {
        circle.setAttribute("cx", String(currentX));
        circle.setAttribute("cy", String(currentY));
        circle.setAttribute("r", String(Math.max(0, currentR)));
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
        <svg
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0 }}
        >
          <defs>
            {/*
              feTurbulence generates animated fractal noise.
              feDisplacementMap uses that noise to push pixels at the circle's
              edge around — creating the flowing-water organic shape.
              The <animate> slowly shifts the noise frequency so the shape
              continuously morphs without repeating obviously.
            */}
            <filter
              id="water-distort"
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
              colorInterpolationFilters="linearRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.008"
                numOctaves="3"
                seed="4"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  values="0.012 0.008;0.020 0.014;0.010 0.018;0.018 0.010;0.012 0.008"
                  dur="14s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="45"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Soft-edge circle: opaque center fading to transparent at the rim */}
            <radialGradient id="reveal-grad" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="black" stopOpacity="1" />
              <stop offset="62%"  stopColor="black" stopOpacity="1" />
              <stop offset="78%"  stopColor="black" stopOpacity="0.55" />
              <stop offset="90%"  stopColor="black" stopOpacity="0.12" />
              <stop offset="100%" stopColor="black" stopOpacity="0" />
            </radialGradient>

            {/*
              SVG mask: white = opaque (bgColor shows), black = transparent (reveals image).
              The black circle at the cursor cuts through the cover layer.
              The water-distort filter makes its edge look like flowing water.
            */}
            <mask id="hero-reveal-mask" maskUnits="userSpaceOnUse">
              <rect x="-9999" y="-9999" width="19998" height="19998" fill="white" />
              <circle
                ref={circleRef}
                cx="-9999"
                cy="-9999"
                r="0"
                fill="url(#reveal-grad)"
                filter="url(#water-distort)"
              />
            </mask>
          </defs>
        </svg>
      )}

      <div
        ref={coverRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          backgroundColor: bgColor,
          transform: "translateZ(0)",
          ...(showReveal
            ? { mask: "url(#hero-reveal-mask)", WebkitMask: "url(#hero-reveal-mask)" }
            : {}),
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
        />
      </div>
    </>
  );
}
