// The main area's content for one route (real app/routes.tsx AppRoutes + Frame): the registry's
// lazily loaded module inside Suspense, an error boundary, and the "advanced view" mark on an
// advanced page opened in simple mode (shown, never redirected).
import { Suspense } from "react"
import { useDemo } from "../engine/react"
import type { DemoRoute } from "../engine/router"
import { Badge } from "../ui/badge"
import { VIEW_REGISTRY } from "../views/registry"
import { SHELL_COPY } from "./copy"
import { minModeFor } from "./nav"
import { registryKeyOf } from "./route-keys"
import { selectMode } from "./select"
import { ViewBoundary } from "./view-boundary"

function Loading() {
  return (
    <p role="status" className="sr-only">
      {SHELL_COPY.view.loading}
    </p>
  )
}

export function RouteView({ route }: { route: DemoRoute }) {
  const mode = useDemo(selectMode)
  const key = registryKeyOf(route)
  // A lookup in the module-scope registry (never a component created during render).
  const View = VIEW_REGISTRY[key]
  const marked = mode === "simple" && minModeFor(route) === "advanced"
  return (
    <>
      {marked ? (
        <div className="mb-4">
          <Badge>{SHELL_COPY.view.advanced}</Badge>
        </div>
      ) : null}
      {/* Keyed by view module: a failed view gets a fresh try on the next view, and moving inside one view keeps its state. */}
      <ViewBoundary key={key}>
        <Suspense fallback={<Loading />}>
          <View route={route} />
        </Suspense>
      </ViewBoundary>
    </>
  )
}
