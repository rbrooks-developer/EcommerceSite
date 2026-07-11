import React from "react";
import Link from "next/link";
import { SiInstagram, SiYoutube, SiTiktok, SiFacebook, SiX, SiEbay } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa6";
import type { FooterConfig, ContactInfo } from "@/types";

interface FooterProps {
  siteTitle: string;
  logoUrl: string | null;
  logoSpin?: boolean;
  footerConfig: FooterConfig;
  contactInfo: ContactInfo;
  bgColor?: string;
  fontColor?: string;
}

export function Footer({
  siteTitle,
  logoUrl,
  logoSpin = false,
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
                loading="lazy"
                decoding="async"
                className="h-16 w-auto opacity-90 hover:opacity-100 transition-opacity"
                style={logoSpin ? { animation: "logo-spin-3d 3s linear infinite" } : undefined}
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
              {(display_name || siteTitle).toUpperCase()}
            </p>

            {/* Tagline */}
            {tagline && (
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: fontColor, opacity: 0.6 }}>
                {tagline}
              </p>
            )}

            {/* Phone + Email */}
            {(contactInfo?.phone || contactInfo?.email) && (
              <div className="flex flex-col gap-1 mt-3">
                {contactInfo.phone && (
                  <a
                    href={`tel:${contactInfo.phone.replace(/\D/g, "")}`}
                    className="text-sm transition-opacity duration-150 hover:opacity-100"
                    style={{ color: fontColor, opacity: 0.7 }}
                  >
                    T: {contactInfo.phone}
                  </a>
                )}
                {contactInfo.email && (
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="text-sm transition-opacity duration-150 hover:opacity-100"
                    style={{ color: fontColor, opacity: 0.7 }}
                  >
                    E: {contactInfo.email}
                  </a>
                )}
              </div>
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
                    <React.Fragment key={s.url}>
                      <li>
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
                    </React.Fragment>
                  ))}
                  {social_handle && (
                    <>
                      <li aria-hidden="true" className="text-sm select-none" style={{ color: fontColor, opacity: 0.3 }}>|</li>
                      <li>
                        <span className="text-xs tracking-[0.15em]" style={{ color: fontColor, WebkitTextFillColor: fontColor, opacity: 0.6 }}>
                          {social_handle.toUpperCase()}
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
  const cls = "w-5 h-5";

  if (p.includes("instagram")) return <SiInstagram className={cls} aria-hidden />;
  if (p.includes("youtube"))   return <SiYoutube className={cls} aria-hidden />;
  if (p.includes("tiktok"))    return <SiTiktok className={cls} aria-hidden />;
  if (p.includes("facebook"))  return <SiFacebook className={cls} aria-hidden />;
  if (p.includes("twitter") || p === "x") return <SiX className={cls} aria-hidden />;
  if (p.includes("linkedin"))  return <FaLinkedinIn className={cls} aria-hidden />;
  if (p.includes("ebay"))      return <SiEbay className={cls} aria-hidden />;

  if (p.includes("whatnot")) return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true} className={cls}>
      <path d="M3 6l3 12 6-8 6 8 3-12h-2.2L16.5 15 12 8.5 7.5 15 5.2 6H3z"/>
    </svg>
  );

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden={true} className={cls}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
