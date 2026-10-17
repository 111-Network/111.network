// The view registry (plan §6.5 "Bundle"; real app/routes.tsx). Every view is a lazily loaded module
// at a fixed path, views/<name>/index.tsx, with a default export taking ViewProps. Each module is its
// own chunk, loaded the first time its route opens; the heavy ones (nearby radar, repairs, storage)
// never weigh on the first load. Not found is tiny and ships with the shell.
//
// Adding a view module never needs this file: the keys are the router's viewKeyOf() values, fixed by
// the engine. A view that wants more chunks lazy-loads its own parts the same way (see
// views/services/index.tsx).
import { lazy, type ComponentType } from "react"
import type { ViewKey } from "../shell/route-keys"
import type { ViewProps } from "../shell/view-types"
import NotFoundView from "./not-found"

export type ViewComponent = ComponentType<ViewProps>

// One dispatcher for every service route; it loads the template or a custom page per service id.
const ServicesView = lazy(() => import("./services"))

export const VIEW_REGISTRY: Readonly<Record<ViewKey, ViewComponent>> = {
  agent: lazy(() => import("./agent")),
  overview: lazy(() => import("./overview")),
  devices: lazy(() => import("./devices")),
  nearby: lazy(() => import("./nearby")),
  messages: lazy(() => import("./messages")),
  kb: lazy(() => import("./kb")),
  services: ServicesView,
  bridge: ServicesView,
  storage: ServicesView,
  repairs: ServicesView,
  settings: lazy(() => import("./settings")),
  "not-found": NotFoundView,
}
