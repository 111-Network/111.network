<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project

111 Network — a global mesh messaging network (web frontend).

**Goal:** rebuild on a fresh latest-Next.js root, migrating piece-by-piece from the legacy code, then retiring it.

**Folders:**
- root — fresh Next.js, target of the rebuild.
- `_outdated-web/` — legacy Turborepo monorepo (apps/packages, Supabase). Being retired; read-only reference.
