"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CarouselConfig } from "@/types";

export function ImageCarousel({ config, bgColor }: { config: CarouselConfig; bgColor: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const {
    images, speed, direction, height, gap,
    image_fit = "contain", image_padding = 0,
    pause_on_hover, fade_edges,
  } = config;

  if (!images || images.length === 0) return null;

  const track = [...images, ...images];

  const pause  = () => { if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "paused"; };
  const resume = () => { if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "running"; };

  // Cover mode: fixed 4:3 frame that fills and may crop
  // Contain mode: natural-width image — no letterboxing, gap is always exactly `gap`px
  const isCover = image_fit === "cover";
  const itemWidth = Math.round(height * (4 / 3)); // only used in cover mode

  return (
    <section
      aria-label="Image carousel"
      className="relative overflow-hidden"
      style={{ height: `${height}px`, "--carousel-speed": `${speed}s` } as React.CSSProperties}
    >
      {fade_edges && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10"
            style={{ background: `linear-gradient(to right, ${bgColor}, transparent)` }} />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10"
            style={{ background: `linear-gradient(to left, ${bgColor}, transparent)` }} />
        </>
      )}

      <div
        ref={trackRef}
        className="carousel-track flex h-full items-center"
        style={{
          width: "max-content",
          animationName: direction === "left" ? "carousel-scroll-left" : "carousel-scroll-right",
          animationDuration: "var(--carousel-speed)",
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
        }}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
      >
        {track.map((item, i) => {
          const isFirst = i < images.length;

          if (isCover) {
            // Fixed-width container — image fills frame, may crop top/bottom
            const containerStyle: React.CSSProperties = {
              width: `${itemWidth}px`,
              height: `${height}px`,
              marginRight: `${gap}px`,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              backgroundColor: bgColor,
              padding: image_padding > 0 ? `${image_padding}px` : undefined,
            };
            const imgEl = (
              <Image
                src={item.url} alt="" fill
                className="object-cover"
                sizes={`${itemWidth}px`}
                aria-hidden="true"
              />
            );
            return item.link ? (
              <Link key={i} href={item.link} style={containerStyle} tabIndex={isFirst ? 0 : -1} aria-hidden={!isFirst}>
                {imgEl}
              </Link>
            ) : (
              <div key={i} style={containerStyle} aria-hidden="true">{imgEl}</div>
            );
          }

          // Contain mode — natural aspect ratio, zero letterboxing
          // Using <img> so width is driven by the image's own proportions at the given height.
          const pad = image_padding;
          const wrapStyle: React.CSSProperties = {
            height: "100%",
            marginRight: `${gap}px`,
            flexShrink: 0,
            padding: pad > 0 ? `${pad}px` : undefined,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
          };
          const imgEl = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt=""
              style={{ height: "100%", width: "auto", display: "block" }}
              aria-hidden="true"
            />
          );
          return item.link ? (
            <a key={i} href={item.link} style={wrapStyle} tabIndex={isFirst ? 0 : -1} aria-hidden={!isFirst}>
              {imgEl}
            </a>
          ) : (
            <div key={i} style={wrapStyle} aria-hidden="true">{imgEl}</div>
          );
        })}
      </div>
    </section>
  );
}
