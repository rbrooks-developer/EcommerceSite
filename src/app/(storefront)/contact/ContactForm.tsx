"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { submitContactForm, subscribeToNewsletter } from "@/lib/actions/contact";
import { SiInstagram, SiYoutube, SiTiktok, SiFacebook, SiX, SiEbay } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa6";

interface SocialLink {
  platform: string;
  url: string;
}

interface Props {
  heading: string;
  subheading: string;
  bodyText: string;
  email: string | null;
  social: SocialLink[];
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--checkout-input-bg, color-mix(in srgb, var(--site-fg) 8%, var(--site-bg)))",
  color: "var(--site-fg)",
  border: "1px solid color-mix(in srgb, var(--site-fg) 25%, transparent)",
};

const btnStyle: React.CSSProperties = {
  backgroundColor: "var(--site-fg)",
  color: "var(--site-bg)",
  fontFamily: "inherit",
};

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

export function ContactForm({ heading, subheading, bodyText, email, social }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [message, setMessage] = useState("");
  const [formPending, setFormPending] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterPending, setNewsletterPending] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormPending(true);
    setFormError(null);
    const result = await submitContactForm({ firstName, lastName, email: formEmail, message });
    setFormPending(false);
    if (result.ok) {
      setFormSuccess(true);
      setFirstName(""); setLastName(""); setFormEmail(""); setMessage("");
    } else {
      setFormError(result.error ?? "Something went wrong.");
    }
  }

  async function handleNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setNewsletterPending(true);
    setNewsletterError(null);
    const result = await subscribeToNewsletter(newsletterEmail);
    setNewsletterPending(false);
    if (result.ok) {
      setNewsletterSuccess(true);
      setNewsletterEmail("");
    } else {
      setNewsletterError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">

      {/* Main two-column layout */}
      <div className="flex flex-col md:flex-row gap-12 md:gap-16">

        {/* Left: info */}
        <div className="md:w-2/5 space-y-5">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight" style={{ color: "var(--site-fg)" }}>
            {heading}
          </h1>
          <p className="text-base font-semibold italic" style={{ color: "var(--site-fg)" }}>
            {subheading}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--site-fg)", opacity: 0.65 }}>
            {bodyText}
          </p>

          {email && (
            <div className="flex items-center gap-2 pt-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0" style={{ color: "var(--site-fg)" }}>
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <a href={`mailto:${email}`} className="text-sm hover:underline" style={{ color: "var(--site-fg)" }}>
                {email}
              </a>
            </div>
          )}

          {social.length > 0 && (
            <div className="flex items-center gap-4 pt-2">
              {social.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.platform}
                  className="transition-opacity hover:opacity-60"
                  style={{ color: "var(--site-fg)" }}
                >
                  <SocialIcon platform={s.platform} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: form */}
        <div className="md:w-3/5">
          {formSuccess ? (
            <div className="rounded-lg p-6 text-sm text-center" style={{ ...inputStyle }}>
              <p className="font-semibold text-base mb-1" style={{ color: "var(--site-fg)" }}>Message sent!</p>
              <p style={{ color: "var(--site-fg)", opacity: 0.6 }}>Thank you for reaching out. We&apos;ll get back to you soon.</p>
              <button
                onClick={() => setFormSuccess(false)}
                className="mt-4 text-xs underline"
                style={{ color: "var(--site-fg)", opacity: 0.5 }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* First + Last Name */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color: "var(--site-fg)", opacity: 0.7 }}>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                    style={{ ...inputStyle, height: "38px" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color: "var(--site-fg)", opacity: 0.7 }}>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                    style={{ ...inputStyle, height: "38px" }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--site-fg)", opacity: 0.7 }}>Email *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                  style={{ ...inputStyle, height: "38px" }}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--site-fg)", opacity: 0.7 }}>Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={3}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current resize-none"
                  style={inputStyle}
                />
              </div>

              {formError && (
                <p className="text-xs" style={{ color: "var(--site-fg)", opacity: 0.6 }}>{formError}</p>
              )}

              <div className="flex justify-end">
                <Button type="submit" loading={formPending} className="font-semibold" style={btnStyle}>
                  Send
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Newsletter section */}
      <div
        className="mt-6 rounded-lg p-6"
        style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" }}
      >
        <div className="max-w-md">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--site-fg)" }}>
            Subscribe to our Newsletter
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--site-fg)", opacity: 0.6 }}>
            Stay up to date with our latest news and offers.
          </p>

          {newsletterSuccess ? (
            <p className="text-sm font-medium" style={{ color: "var(--site-fg)" }}>
              You&apos;re subscribed! Thank you for signing up.
            </p>
          ) : (
            <form onSubmit={handleNewsletter} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: "var(--site-fg)", opacity: 0.6 }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                  style={inputStyle}
                />
              </div>
              <Button type="submit" loading={newsletterPending} className="font-semibold" style={btnStyle}>
                Subscribe
              </Button>
            </form>
          )}
          {newsletterError && (
            <p className="text-xs mt-2" style={{ color: "var(--site-fg)", opacity: 0.6 }}>{newsletterError}</p>
          )}
        </div>
      </div>

    </div>
  );
}
