import Link from "next/link";
import Image from "next/image";

interface Props {
  bgColor: string;
  fontColor: string;
  heroFont: string;
  logoUrl: string | null;
  logoSpin: boolean;
  siteTitle: string;
  displayName: string;
  tagline: string;
  goldGradient: string;
}

export function FoundAndCreatorHero({ bgColor, fontColor, heroFont, logoUrl, logoSpin, siteTitle, displayName, tagline, goldGradient }: Props) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: "100svh", backgroundColor: bgColor }}
    >
      {/* Radial gold glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
        {/* Logo */}
        {logoUrl && (
          <div
            className="relative w-28 h-28 md:w-36 md:h-36"
            style={{ filter: `drop-shadow(0 0 24px color-mix(in srgb, ${fontColor} 35%, transparent))` }}
          >
            <Image
              src={logoUrl}
              alt={siteTitle}
              fill
              sizes="(min-width: 768px) 144px, 112px"
              className="object-contain"
              style={logoSpin ? { animation: "logo-spin-3d 3s linear infinite" } : undefined}
            />
          </div>
        )}

        {/* Title */}
        <h1
          id="hero-heading"
          className="tracking-[0.2em] text-5xl md:text-7xl lg:text-8xl leading-none uppercase"
          style={{
            fontFamily: `'${heroFont}', serif`,
            background: goldGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {displayName}
        </h1>

        {/* Divider */}
        <div
          className="w-24 h-px"
          style={{ backgroundColor: fontColor, opacity: 0.6 }}
          aria-hidden="true"
        />

        {/* Tagline */}
        {tagline && (
          <p
            className="text-sm md:text-base tracking-[0.25em] uppercase"
            style={{ color: "#9ca3af", WebkitTextFillColor: "#9ca3af" }}
          >
            {tagline}
          </p>
        )}

        {/* CTA */}
        <div className="mt-4">
          <Link href="/products" className="btn-hero">
            Shop Our Products
          </Link>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
        aria-hidden="true"
      />
    </section>
  );
}
