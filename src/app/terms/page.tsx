import type { Metadata } from "next"
import { SITE_NAME, SITE_URL, TERMS_LAST_UPDATED } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `Terms of Service · ${SITE_NAME}`,
  description: `Terms of Service and Privacy Policy for ${SITE_NAME}.`,
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 lg:px-8 lg:py-24">
      <header className="mb-16">
        <h1 className="font-pixel text-lg uppercase tracking-wider text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Last updated: {TERMS_LAST_UPDATED}
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Agreement to Terms
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            By accessing or using 111.network ("the Site"), you agree to be
            bound by these Terms of Service. If you do not agree to these
            Terms, you must not access or use the Site. These Terms apply to
            all visitors, users, and others who access the Site.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Description of Service
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            111 Network is an open-source project building a global mesh
            messaging network. The website (111.network) provides public
            information about the project, its technology, and its mission. No
            user accounts, messaging, or data transmission services are
            currently offered through this website.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Use of the Website
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            The Site is provided free of charge for informational purposes. You
            agree not to: (a) use the Site for any unlawful purpose; (b)
            attempt to disrupt, interfere with, or gain unauthorized access to
            any part of the Site or its underlying infrastructure; (c)
            reproduce, duplicate, copy, sell, or exploit any portion of the
            Site without express written permission.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Intellectual Property
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            All content on this website, including text, code, graphics, and
            the 111 Network name and logo, is the property of 111 Network or
            its licensors. The project is open-source; source code is
            available under the applicable open-source license on GitHub.
            Content from this website may not be reproduced, distributed, or
            transmitted without prior written permission.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Privacy &amp; Cookie Policy
          </h2>
          <div className="mt-3 flex flex-col gap-3 font-mono text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Data Collection.</strong>{" "}
              We do not collect personal data, use tracking cookies, analytics
              cookies, or advertising cookies. We do not build profiles, track
              behaviour across sites, or share data with third-party advertisers.
            </p>
            <p>
              <strong className="text-foreground">Strictly Necessary Cookies.</strong>{" "}
              We store only strictly necessary cookies required for the core
              functionality of this website (e.g., your cookie consent
              preference). These cookies do not track you across websites and
              do not contain personal information.
            </p>
            <p>
              <strong className="text-foreground">Third Parties.</strong>{" "}
              We do not sell, rent, or share data with third parties. The site
              is hosted on Vercel; their infrastructure may process minimal
              technical data (such as IP address and request logs) as
              necessary for hosting. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Vercel&apos;s Privacy Policy
              </a>{" "}
              for details.
            </p>
            <p>
              <strong className="text-foreground">Your Rights.</strong>{" "}
              You have the right to know what data we hold (we do not hold any
              personally identifiable information) and to request deletion of
              any data. To exercise these rights, contact us through our
              GitHub repository.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Security Focus
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            The entire mission of 111 Network is security and safety in digital
            communication. Our architecture is designed with end-to-end
            encryption, zero-knowledge principles, and decentralized
            infrastructure. No central server holds message content. This
            commitment to cybersecurity is foundational to every design
            decision.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Disclaimer of Warranties
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT
            NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE MAKE NO WARRANTY THAT
            THE SITE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Limitation of Liability
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            IN NO EVENT SHALL 111 NETWORK, ITS CONTRIBUTORS, OR AFFILIATES BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF THE
            WEBSITE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Governing Law
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            These Terms shall be governed by and construed in accordance with
            the laws of the jurisdiction where 111 Network is primarily
            operated, without regard to its conflict of law principles.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Changes to These Terms
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            We may update these Terms at any time. Changes will be posted on
            this page with an updated "Last updated" date. Continued use of
            the Site after changes constitutes acceptance of the revised
            Terms.
          </p>
        </section>

        <section>
          <h2 className="font-pixel text-sm uppercase tracking-widest text-foreground">
            Contact
          </h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            For questions about these Terms, please contact us through our{" "}
            <a
              href="https://github.com/111-Network/111.network"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
