import React from "react";
import Link from "next/link";
import Image from "next/image";
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
              <Image
                src={logoUrl}
                alt={siteTitle}
                width={200}
                height={64}
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
    <svg viewBox="25 5 352 352" fill="currentColor" aria-hidden={true} className={cls}>
      <path fillRule="evenodd" d="M 81.691 99.501 C 63.251 104.570, 48.389 119.584, 43.453 138.131 C 41.619 145.022, 41.619 158.978, 43.453 165.869 C 46.883 178.758, 48.213 180.412, 84.394 216.809 C 116.812 249.420, 118.896 251.314, 126.500 255.063 C 146.832 265.089, 169.128 261.984, 187.250 246.604 C 190.963 243.453, 194 240.242, 194 239.468 C 194 238.695, 191.525 231.244, 188.500 222.911 C 185.475 214.578, 183 207.489, 183 207.159 C 183 206.829, 193.012 216.498, 205.250 228.646 C 217.488 240.794, 229.561 251.917, 232.080 253.362 C 248.719 262.912, 267.970 263.255, 285.387 254.313 C 291.689 251.078, 296.270 246.889, 325.555 217.581 C 352.283 190.832, 359.205 183.351, 361.717 178.500 C 373.329 156.067, 369.680 130.563, 352.412 113.476 C 341.713 102.888, 329.571 98, 313.971 98 C 297.306 98, 287.356 102.713, 271.351 118.187 L 259.927 129.232 250.168 119.762 C 233.122 103.221, 224.537 98.939, 206.982 98.223 C 197.629 97.842, 195.606 98.083, 188.714 100.396 C 178.058 103.973, 174.146 106.632, 161.899 118.622 C 156.069 124.330, 150.966 129, 150.560 129 C 150.153 129, 144.573 123.913, 138.159 117.695 C 125.999 105.908, 120.291 102.227, 109.869 99.453 C 103.263 97.694, 88.169 97.720, 81.691 99.501"/>
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
