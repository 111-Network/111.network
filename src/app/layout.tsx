import type { Metadata, Viewport } from "next"
import { Silkscreen } from "next/font/google"
import localFont from "next/font/local"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { MotionRoot } from "@/components/common/motion-root"
import { CookieBanner } from "@/components/cookie-banner"
import { JsonLd } from "@/components/seo/json-ld"
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"
import "./globals.css"

// Geist Mono variable face (box drawing U+2500–257F and blocks U+2580–259F,
// but NOT ■ □ ▪ ▸ ◐ ✓: see DESIGN.md "Glyphs"); sets --font-geist-mono, which
// globals.css maps to --font-mono / `font-mono`.
const geistMono = GeistMono

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
})

// Only the Line face of Geist Pixel. `geist/font/pixel` declares all five
// faces, so importing it preloaded ~111 kB of unused fonts on every page.
// Same options as the package's GeistPixelLine; the font file is a copy from
// node_modules/geist (OFL, license next to it).
const geistPixelLine = localFont({
  src: "./fonts/GeistPixel-Line.woff2",
  variable: "--font-geist-pixel-line",
  weight: "500",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  keywords: [
    "mesh network",
    "peer-to-peer messaging",
    "decentralized communication",
    "end-to-end encryption",
    "offline messaging",
    "offline mesh",
    "radio mesh",
    "self-healing network",
    "local AI",
    "111 network",
    "private messaging",
    "open source communication",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistMono.variable} ${geistPixelLine.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className={`${silkscreen.variable} font-mono antialiased`}>
        <MotionRoot>
          {children}
          <CookieBanner />
        </MotionRoot>
        <JsonLd />
        <Analytics />
      </body>
    </html>
  )
}
