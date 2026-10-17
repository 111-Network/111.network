// The main area's content for one route (real app/routes.tsx AppRoutes + Frame): the registry's
// lazily loaded module inside Suspense and an error boundary. No "advanced view" mark (owner,
// 2026-10-17): the only advanced pages, the services, switch the mode to advanced when opened.
import { Suspense } from "react"
import type { DemoRoute } from "../engine/router"
import { VIEW_REGISTRY } from "../views/registry"
import { SHELL_COPY } from "./copy"
import { registryKeyOf } from "./route-keys"
import { ViewBoundary } from "./view-boundary"

function Loading() {
  return (
    <p role="status" className="sr-only">
      {SHELL_COPY.view.loading}
    </p>
  )
}

export function RouteView({ route }: { route: DemoRoute }) {
  const key = registryKeyOf(route)
  // A lookup in the module-scope registry (never a component created during render).
  const View = VIEW_REGISTRY[key]
  // Keyed by view module: a failed view gets a fresh try on the next view, and moving inside one view keeps its state.
  return (
    <ViewBoundary key={key}>
      <Suspense fallback={<Loading />}>
        <View route={route} />
      </Suspense>
    </ViewBoundary>
  )
}
