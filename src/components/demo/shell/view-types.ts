// The props every view module receives (plan §6.5). Type-only, React-free.
import type { DemoRoute } from "../engine/router"
import type { ServiceId } from "../engine/types"

/**
 * Props of a view module's default export (views/<name>/index.tsx). `route` is the current route,
 * never null (the shell renders no view until the url router has read the hash). Narrow it with
 * `route.view`: the devices view gets "devices" or "device", messages gets "messages" or
 * "conversation", kb gets "kb" / "kb-drawer" / "kb-note", settings gets "settings" or
 * "settings-layer", the services dispatcher gets "service".
 */
export interface ViewProps {
  route: DemoRoute
}

/** Props of a service page module (views/services/<page>/index.tsx): the route plus the service id. */
export interface ServiceViewProps extends ViewProps {
  id: ServiceId
}
