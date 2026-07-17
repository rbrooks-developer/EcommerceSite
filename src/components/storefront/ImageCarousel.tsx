"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CarouselConfig } from "@/types";

export function ImageCarousel({ config, bgColor }: { config: CarouselConfig; bgColor: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const {
    images, speed, direction, height, gap,
    image_fit = "contain", image_padding = 0, border_radius = 8,
    pause_on_hover, fade_edges,
  } = config;

  if (!images || images.length === 0) return null;

  const track = [...images, ...images];

  const pause  = () => { if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "paused"; };
  const resume = () => { if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "running"; };

  const isCover = image_fit === "cover";
  const itemWidth = Math.round(height * (4 / 3)); // cover mode only

  return (
    <section
      aria-label="Image carousel"
      className="relative overflow-hidden"
      style={{ height: `${height}px`, "--carousel-speed": `${speed}s`, zIndex: 46 } as React.CSSProperties}
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
            const tileStyle: React.CSSProperties = {
              width: `${itemWidth}px`,
              height: `${height}px`,
              marginRight: `${gap}px`,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              borderRadius: `${border_radius}px`,
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
              <Link key={i} href={item.link} className="carousel-tile" style={tileStyle}
                tabIndex={isFirst ? 0 : -1} aria-hidden={!isFirst}>
                {imgEl}
              </Link>
            ) : (
              <div key={i} className="carousel-tile" style={tileStyle} aria-hidden="true">{imgEl}</div>
            );
          }

          // Contain mode — natural aspect ratio, no letterboxing
          const tileStyle: React.CSSProperties = {
            height: `${height}px`,
            marginRight: `${gap}px`,
            flexShrink: 0,
            overflow: "hidden",
            borderRadius: `${border_radius}px`,
            display: "flex",
            alignItems: "center",
            padding: image_padding > 0 ? `${image_padding}px` : undefined,
            boxSizing: "border-box",
          };
          const innerRadius = image_padding > 0 ? Math.max(0, border_radius - image_padding) : undefined;
          const carouselSrc = item.url.includes("/storage/v1/object/public/")
            ? item.url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?height=${Math.round(height * 2)}&quality=80`
            : item.url;
          const imgEl = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={carouselSrc}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ height: "100%", width: "auto", display: "block", borderRadius: innerRadius ? `${innerRadius}px` : undefined }}
              aria-hidden="true"
            />
          );
          return item.link ? (
            <a key={i} href={item.link} className="carousel-tile" style={tileStyle}
              tabIndex={isFirst ? 0 : -1} aria-hidden={!isFirst}>
              {imgEl}
            </a>
          ) : (
            <div key={i} className="carousel-tile" style={tileStyle} aria-hidden="true">{imgEl}</div>
          );
        })}
      </div>
    </section>
  );
}
