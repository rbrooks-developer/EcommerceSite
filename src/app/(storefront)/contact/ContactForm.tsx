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
