import { GITHUB_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site"

// Organization + WebSite structured data. Descriptions come from
// SITE_DESCRIPTION (the hero subtitle, plan §3.1) and sameAs from GITHUB_URL
// (the GitHub org, W8), so they follow site.ts.
export function JsonLd() {
  const organizationId = `${SITE_URL}/#organization`
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      slogan: SITE_TAGLINE,
      description: SITE_DESCRIPTION,
      sameAs: [GITHUB_URL],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": organizationId },
    },
  ]
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
