/**
 * A deployment adapter that does nothing. `pnpm build:host` points
 * NEXT_ADAPTER_PATH at it so a local `next build` writes its output the way it
 * does on the host: the host builds with its own adapter, and with any adapter
 * set Next 16.4 writes prerendered pages and route bodies to
 * .next/server/route-cache/… instead of .next/server/app (scripts/next-output.mjs).
 * Without this a local build only ever exercises the classic layout, which is
 * how a check that read only server/app stayed green locally and failed on the host.
 *
 * Interface: node_modules/next/dist/docs/01-app/03-api-reference/07-adapters/02-creating-an-adapter.md
 */
const adapter = {
  name: "111-layout-probe",
}

export default adapter
