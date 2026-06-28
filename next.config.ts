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
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://*.tawk.to https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
      "img-src 'self' blob: data: https:",
      "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
      "media-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // Allow form submissions to self + Stripe hosted checkout
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      // Stripe hosted checkout and 3DS frames; Tawk.to chat widget uses iframes
      "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.tawk.to",
      // API connections: Supabase, Stripe, Resend, EasyPost, Tawk.to (including WebSocket for live chat)
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://api.resend.com https://api.easypost.com https://*.tawk.to wss://*.tawk.to",
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
    ],
  },
};

export default nextConfig;
