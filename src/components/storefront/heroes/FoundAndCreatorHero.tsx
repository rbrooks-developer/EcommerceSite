import Link from "next/link";
import Image from "next/image";
import { imgUrl } from "@/lib/utils";
import { HeroRevealLayer } from "@/components/storefront/HeroFogReveal";

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
  customCursor?: boolean;
  fogRadius?: number;
  revealImageUrl?: string | null;
}

export function FoundAndCreatorHero({
  bgColor, fontColor, heroFont, logoUrl, logoSpin, siteTitle,
  displayName, tagline, goldGradient,
  customCursor, fogRadius, revealImageUrl,
}: Props) {
  const revealActive = !!(customCursor && revealImageUrl);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        minHeight: revealActive ? "calc(100svh + 4rem)" : "100svh",
        backgroundColor: bgColor,
        // Pull the section up behind the sticky header so the reveal image
        // fills the full viewport. paddingTop keeps content below the header.
        ...(revealActive ? { marginTop: "-4rem", paddingTop: "4rem" } : {}),
      }}
    >
      {/* Reveal image — behind the hero layer; only mounted when feature is on */}
      {revealActive && (
        <Image
          src={imgUrl(revealImageUrl!)}
          fill
          alt=""
          sizes="100vw"
          className="object-cover"
          style={{ zIndex: 0 }}
          priority
        />
      )}

      {/* Background layer — bgColor + glow + bottom fade; maskable when reveal is active */}
      <HeroRevealLayer
        bgColor={bgColor}
        fontColor={fontColor}
        radius={fogRadius}
        enabled={revealActive}
      />

      {/* Content — always on top, always fully visible and clickable */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
        {/* Logo */}
        {logoUrl && (
          <div
            className="relative w-28 h-28 md:w-36 md:h-36"
            style={{ filter: `drop-shadow(0 0 24px color-mix(in srgb, ${fontColor} 35%, transparent))` }}
          >
            <Image
              src={imgUrl(logoUrl)}
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
    </section>
  );
}
