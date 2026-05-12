# Migration Plan

Rebuild 111 Network web on a fresh latest-Next.js root, porting from `_outdated-web/` piece-by-piece, then retiring it.

## Source

`_outdated-web/` — legacy Turborepo:
- `apps/website` — public site (pages: `/`, `network`, `resources`, `about`, `broadcast`, `terms`)
- `apps/admin`, `apps/map` — separate apps
- `packages/ui` — shared UI

## Steps

1. **Port the landing page + useful components.** Move `apps/website/app/page.tsx` (and its layout/styles) plus needed components (`components/*`, `components/ui/*`, `components/magicui/*`) into root `src/`. Adapt imports, install missing deps (motion, cobe, lucide-react, next-themes, radix-slot, cva, clsx, tailwind-merge).
2. Port remaining website pages (`network`, `resources`, `about`, `broadcast`, `terms`).
3. Decide on `admin` and `map` — port, separate app, or drop.
4. Retire `_outdated-web/`.

## Notes

- Root uses the latest Next.js (breaking changes vs. legacy `next@16`). Check `node_modules/next/dist/docs/` before each port.
- `_template/` is the reference for fresh-install conventions.
