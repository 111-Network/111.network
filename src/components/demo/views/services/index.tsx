// The services dispatcher (real views/services/index.tsx ServicesView): "/services/<id>" -> the
// service's page. Bridge, Storage, Repairs and the Internet gateway have their own modules; every
// other service uses the template. Each page is its own lazily loaded chunk.
import { lazy, type ComponentType } from "react"
import { useDemo } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { selectServices } from "../../engine/selectors"
import { SHELL_COPY } from "../../shell/copy"
import { RouteButtonLink } from "../../shell/links"
import { servicePageOf, type ServicePageKey } from "../../shell/route-keys"
import type { ServiceViewProps, ViewProps } from "../../shell/view-types"
import { Empty } from "../../ui/empty"
import NotFoundView from "../not-found"

const SERVICE_PAGES: Readonly<Record<ServicePageKey, ComponentType<ServiceViewProps>>> = {
  template: lazy(() => import("./template")),
  bridge: lazy(() => import("./bridge")),
  storage: lazy(() => import("./storage")),
  repairs: lazy(() => import("./repairs")),
  gateway: lazy(() => import("./gateway")),
}

export default function ServicesView({ route }: ViewProps) {
  const services = useDemo(selectServices)
  if (route.view !== "service") return <NotFoundView />
  const service = services.find((s) => s.id === route.id)
  if (!service) {
    const copy = SHELL_COPY.service.noSuch
    return (
      <Empty
        kicker={copy.kicker}
        title={copy.title}
        action={
          <RouteButtonLink to={PATHS.overview} size="sm">
            {copy.action}
          </RouteButtonLink>
        }
      >
        {copy.body(route.id)}
      </Empty>
    )
  }
  const Page = SERVICE_PAGES[servicePageOf(service.id)]
  return <Page route={route} id={service.id} />
}
