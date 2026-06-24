import Link from "next/link";
import type { FooterConfig, ContactInfo } from "@/types";

interface FooterProps {
  siteTitle: string;
  footerConfig: FooterConfig;
  contactInfo: ContactInfo;
  bgColor?: string;
  fontColor?: string;
}

export function Footer({ siteTitle, footerConfig, contactInfo, bgColor = "#ffffff", fontColor = "#111827" }: FooterProps) {
  const { links, social, copyright_text } = footerConfig ?? {};

  return (
    <footer
      className="border-t border-black/10 mt-auto"
      style={{ backgroundColor: bgColor, color: fontColor }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <p className="font-bold" style={{ color: fontColor }}>{siteTitle}</p>
            {contactInfo?.email && (
              <p className="mt-2 text-sm opacity-60">{contactInfo.email}</p>
            )}
            {contactInfo?.phone && (
              <p className="text-sm opacity-60">{contactInfo.phone}</p>
            )}
          </div>

          {/* Links */}
          {(links ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold" style={{ color: fontColor }}>Links</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.link}>
                    <Link href={link.link} className="text-sm opacity-60 hover:opacity-100 transition-opacity" style={{ color: fontColor }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Social */}
          {(social ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold" style={{ color: fontColor }}>Follow us</h3>
              <ul className="mt-3 space-y-2">
                {social.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm opacity-60 hover:opacity-100 transition-opacity" style={{ color: fontColor }}>
                      {s.platform}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-black/10 pt-6 text-center">
          <p className="text-xs opacity-50">
            {copyright_text || `© ${new Date().getFullYear()} ${siteTitle}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
