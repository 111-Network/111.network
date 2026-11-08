/** @type {import('next').NextConfig} */

// Response headers on every route (SECURITY.md, "What the site does"). The
// site is prerendered and loads no third-party script, so these are safe to
// set globally. A nonce-based Content-Security-Policy is a listed follow-up;
// the directives here are the ones that do not depend on nonces.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
]

const nextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
