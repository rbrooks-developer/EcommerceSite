"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CarouselConfig } from "@/types";

const BLUR_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

export function ImageCarousel({ config, bgColor }: { config: CarouselConfig; bgColor: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { images, speed, direction, height, gap, pause_on_hover, fade_edges } = config;

  if (!images || images.length === 0) return null;

  // Each slide is 4:3 landscape; with object-cover this handles any image ratio cleanly
  const itemWidth = Math.round(height * (4 / 3));

  // Double the array — animating by -50% brings us back to the start seamlessly
  const track = [...images, ...images];

  const pause = () => {
    if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "paused";
  };
  const resume = () => {
    if (pause_on_hover && trackRef.current) trackRef.current.style.animationPlayState = "running";
  };

  return (
    <section
      aria-label="Image carousel"
      className="relative overflow-hidden"
      style={
        { height: `${height}px`, "--carousel-speed": `${speed}s` } as React.CSSProperties
      }
    >
      {fade_edges && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10"
            style={{ background: `linear-gradient(to right, ${bgColor}, transparent)` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10"
            style={{ background: `linear-gradient(to left, ${bgColor}, transparent)` }}
          />
        </>
      )}

      <div
        ref={trackRef}
        className={`carousel-track flex h-full`}
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
          const imgEl = (
            <Image
              src={item.url}
              alt=""
              fill
              className="object-cover"
              sizes={`${itemWidth}px`}
              placeholder="blur"
              blurDataURL={BLUR_URL}
              aria-hidden="true"
            />
          );

          const containerStyle: React.CSSProperties = {
            width: `${itemWidth}px`,
            height: `${height}px`,
            marginRight: `${gap}px`,
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          };

          return item.link ? (
            <Link
              key={i}
              href={item.link}
              style={containerStyle}
              tabIndex={i < images.length ? 0 : -1}
              aria-hidden={i >= images.length}
            >
              {imgEl}
            </Link>
          ) : (
            <div key={i} style={containerStyle} aria-hidden="true">
              {imgEl}
            </div>
          );
        })}
      </div>
    </section>
  );
}
