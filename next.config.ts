import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline + unsafe-eval for dev; in prod only unsafe-inline is needed but
      // Turbopack still uses eval — keeping both for now
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://tawk.to https://*.tawk.to https://cdn.jsdelivr.net https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tawk.to https://*.tawk.to",
      "img-src 'self' blob: data: https:",
      "font-src 'self' https://fonts.gstatic.com https://tawk.to https://*.tawk.to",
      "media-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // Allow form submissions to self + Stripe hosted checkout
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      // Stripe hosted checkout and 3DS frames; Tawk.to chat widget uses iframes
      // Note: both https://tawk.to (root) and https://*.tawk.to (subdomains) are needed
      "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://tawk.to https://*.tawk.to https://lookerstudio.google.com https://*.looker.com",
      // API connections: Supabase, Stripe, Resend, EasyPost, Tawk.to (including WebSocket for live chat)
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://api.resend.com https://api.easypost.com https://tawk.to https://*.tawk.to wss://tawk.to wss://*.tawk.to https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.facebook.com https://www.clarity.ms",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "i.ebayimg.com",
      },
    ],
    // Default is "attachment" (forces a download) — link-preview crawlers
    // need the image served inline to render it.
    contentDispositionType: "inline",
  },
};

export default nextConfig;
