# Security policy

This file covers the **website** at https://111.network: the code in this repository, the build that deploys it, and what the pages do in a visitor's browser. The node software people install lives in [111-Network/os](https://github.com/111-Network/os) and has its own policy. Issues in the host or in GitHub itself go to those providers.

## Reporting a vulnerability

Please report privately. Do not open a public issue for a security problem.

1. Preferred: GitHub private vulnerability reporting, at <https://github.com/111-Network/111.network/security/advisories/new>. It opens a draft advisory that only maintainers can read.
2. If that form is not available, open an issue that says only that you have a security report and how we can reach you. Keep the details out of the issue; we will contact you.

Please include what you found, the URL or file involved, steps to reproduce, and what you think the impact is. A proof of concept helps; attacking live visitors, scraping, or load testing does not, and is not authorised by this policy.

What you can expect from us:

| Step | Target |
|---|---|
| First reply | within 3 days |
| Triage and severity | within 7 days |
| Fix for a confirmed problem | as fast as the fix allows; the site deploys from `main` on merge, so there is no release to wait for |
| Credit | in the advisory and the changelog, if you want it |

We follow coordinated disclosure: we ask for time to fix before details go public, and we will agree a date with you. There is no bug bounty.

## Supported versions

There are no numbered releases of the website. What is deployed is the head of `main`. Only that is supported; a fix is a commit to `main`.

The `SITE_VERSION` string shown on the pages ("V.0.0.6 Experimental") is a copy label for the network, not a release of this code.

## Scope

In scope:

- Everything under `src/`, `scripts/`, `public/` and the build configuration.
- The deployed pages, including `/demo`, `/terms`, `/llms.txt`, `/sitemap.xml`, `/robots.txt` and the manifest.
- Dependency and supply-chain problems that reach the deployed site.

Out of scope:

- The node software, the installer script and the install domain (report those to [111-Network/os](https://github.com/111-Network/os)).
- The hosting provider's infrastructure and GitHub's.
- Findings that need a compromised browser, device or network to matter, best-practice reports with no demonstrated impact, and the Terms page's legal content.

## What the site does, and does not do

Knowing the shape of the site tells you where a finding can and cannot land.

- **It is a static site.** Every route is prerendered at build time. There is no server code of ours running per request, no database, no API route, no user account, no form that submits anywhere, no upload.
- **It holds no secrets.** The only environment variable the code reads is `NEXT_PUBLIC_SITE_URL`, a public value used for canonical links on preview builds. `.env*` files are ignored by git. Nothing in the repository is meant to be confidential.
- **The demo runs in the browser only.** `/demo` is a simulation of the node dashboard: client-side state, a virtual clock, no network calls. It cannot reach a real node and nothing a visitor types leaves the page.
- **No tracking, no cookies set by us.** The pages set no cookies. Two `localStorage` keys exist: the cookie-notice choice (`111-cookie-consent`) and the demo's simple/advanced mode (`111.demo.mode`). Page views are counted by the host's cookieless analytics, loaded from our own origin (`/_vercel/insights/...`); this is described on the Terms page.
- **No third-party scripts.** Fonts are downloaded at build time and served from our origin; no font, script or style is fetched from another domain at runtime. The only inline script is the JSON-LD block, built from constants in `src/lib/site.ts`, never from input.
- **Response headers** set in `next.config.mjs` on every route: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that turns off camera, microphone, geolocation, payment and USB, and a `Content-Security-Policy` with `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` and `object-src 'none'`. `X-Powered-By` is off. TLS and `Strict-Transport-Security` are provided by the host.
- **The install command is treated as security-sensitive copy.** The command people are told to run never carries `sudo`, always comes with a "read it first" link to the script's source, and `INSTALL_LIVE` stays `false` until the installer domain actually serves the script. `pnpm check:install` fails the gate if the copyable command and the checked URL ever drift apart, and HEADs the URL once live.

## How changes are kept safe

- **One lockfile, frozen installs.** `pnpm-lock.yaml` is committed. CI-style installs (`CI=1`, and the host's build) refuse to run if the lockfile does not match `package.json`.
- **Install scripts are blocked by default.** pnpm 10 runs no dependency lifecycle script unless it is on the allow-list in `pnpm-workspace.yaml` (`allowBuilds`). Adding a package there is a review item.
- **Pinned toolchain.** `package.json` pins `packageManager` (pnpm 10.28.0) and `engines.node` (22.x), so the host builds with the same versions the gates ran on. The framework and its lint preset are pinned to exact versions, not ranges.
- **Dependency updates come as pull requests.** `.github/dependabot.yml` opens grouped weekly PRs; each has to pass the full gate below before merge. GitHub's dependency alerts and security updates should be switched on for this repository (see the owner checklist).
- **Every change runs the full gate.** `pnpm check` = typecheck, lint, 1500+ unit tests, production build, the copy check (which also scans the built HTML and `public/` text files and enforces the `/demo` import denylist), the first-load JavaScript budget and the install-URL check. `pnpm e2e` drives the real pages in a browser at phone and desktop widths.
- **Branch flow.** Work lands on `main` through pull requests. Direct pushes to `main` should be blocked (owner checklist).
- **Secrets never go in the repository.** If a secret is ever needed for the build, it goes in the host's encrypted environment settings, not in code, not in `vercel.json`, not in a committed `.env`.

## Owner checklist (repository settings, one-time)

These are GitHub settings, not code, so they cannot be shipped in a pull request. At the time of writing they are off:

- [ ] Settings → Code security → **Private vulnerability reporting**: on (makes the link in this file work).
- [ ] Settings → Code security → **Dependabot alerts** and **Dependabot security updates**: on.
- [ ] Settings → Code security → **Secret scanning** and **Push protection**: on.
- [ ] Settings → Branches → protect `main`: require a pull request, require the host's build check to pass, no force pushes.
- [ ] Host project: Preview deployments on by default for pull requests, so a change is seen before it reaches production.

## Known gaps

Listed so nobody has to rediscover them.

- **No nonce-based Content-Security-Policy yet.** The framework's bootstrap and the JSON-LD block are inline scripts, and the host's preview toolbar injects its own on preview builds. A strict `script-src` needs per-request nonces, which means giving this static site a request layer. Until then the policy carries only the directives that do not depend on nonces (listed above).
- **No CI on GitHub.** The gate runs on the developer's machine and the host runs only `build` (which includes the copy check). A GitHub Actions job running `pnpm check` and `pnpm e2e` on every pull request is the obvious next step.
- **Subresource integrity is not used**, because nothing is loaded from a third-party origin. If that ever changes, add `integrity` attributes or, better, self-host.

## Hall of thanks

Nobody yet. Be the first.
