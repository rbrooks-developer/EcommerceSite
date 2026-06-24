import Link from "next/link";
import type { FooterConfig, ContactInfo } from "@/types";

interface FooterProps {
  siteTitle: string;
  logoUrl: string | null;
  footerConfig: FooterConfig;
  contactInfo: ContactInfo;
  bgColor?: string;
  fontColor?: string;
}

export function Footer({
  siteTitle,
  logoUrl,
  footerConfig,
  contactInfo,
  bgColor = "#ffffff",
  fontColor = "#111827",
}: FooterProps) {
  const { social, copyright_text, display_name, tagline, social_handle } = footerConfig ?? {};
  const activeSocial = (social ?? []).filter((s) => s.platform && s.url);

  return (
    <footer
      className="mt-auto border-t-[4px]"
      style={{ backgroundColor: bgColor, borderColor: fontColor }}
    >
      <div className="mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Logo */}
          <Link href="/" aria-label={`${siteTitle} — home`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={siteTitle}
                className="h-16 w-auto opacity-90 hover:opacity-100 transition-opacity"
              />
            ) : (
              <span className="text-base font-bold tracking-[0.15em] uppercase" style={{ color: fontColor }}>
                {siteTitle}
              </span>
            )}
          </Link>

          {/* Center content */}
          <div className="flex flex-col items-start gap-3 text-left">
            {/* Display name */}
            <p className="text-base tracking-[0.15em]" style={{ color: fontColor }}>
              {display_name || siteTitle}
            </p>

            {/* Tagline */}
            {tagline && (
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: fontColor, opacity: 0.6 }}>
                {tagline}
              </p>
            )}

            {/* Phone */}
            {contactInfo?.phone && (
              <a
                href={`tel:${contactInfo.phone.replace(/\D/g, "")}`}
                className="text-sm transition-opacity duration-150 mt-3 hover:opacity-100"
                style={{ color: fontColor, opacity: 0.7 }}
              >
                T: {contactInfo.phone}
              </a>
            )}

            {/* Email */}
            {contactInfo?.email && (
              <a
                href={`mailto:${contactInfo.email}`}
                className="text-sm transition-opacity duration-150 hover:opacity-100"
                style={{ color: fontColor, opacity: 0.7 }}
              >
                E: {contactInfo.email}
              </a>
            )}

            {/* Divider */}
            {activeSocial.length > 0 && (
              <div className="w-full h-px" style={{ backgroundColor: fontColor, opacity: 0.3 }} aria-hidden="true" />
            )}

            {/* Social links */}
            {activeSocial.length > 0 && (
              <nav aria-label="Social media links" className="mt-1">
                <ul className="flex items-center gap-4 list-none m-0 p-0">
                  {activeSocial.map((s, i) => (
                    <>
                      <li key={s.url}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={s.platform}
                          className="transition-colors duration-150 hover:opacity-100"
                          style={{ color: fontColor }}
                        >
                          <SocialIcon platform={s.platform} />
                        </a>
                      </li>
                      {i < activeSocial.length - 1 && (
                        <li aria-hidden="true" className="text-sm select-none" style={{ color: fontColor, opacity: 0.3 }}>|</li>
                      )}
                    </>
                  ))}
                  {social_handle && (
                    <>
                      <li aria-hidden="true" className="text-sm select-none" style={{ color: fontColor, opacity: 0.3 }}>|</li>
                      <li>
                        <span className="text-xs tracking-[0.15em]" style={{ color: fontColor, opacity: 0.6 }}>
                          {social_handle}
                        </span>
                      </li>
                    </>
                  )}
                </ul>
              </nav>
            )}
          </div>

          {/* Copyright */}
          <p className="text-sm text-center" style={{ color: fontColor, opacity: 0.6 }}>
            {copyright_text || `© ${new Date().getFullYear()} ${siteTitle}. All rights reserved.`}
          </p>

        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();

  if (p.includes("instagram")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );

  if (p.includes("youtube")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );

  if (p.includes("tiktok")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.13 8.13 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/>
    </svg>
  );

  if (p.includes("facebook")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>
  );

  if (p.includes("twitter") || p === "x") return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );

  if (p.includes("linkedin")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  );

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="w-5 h-5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
