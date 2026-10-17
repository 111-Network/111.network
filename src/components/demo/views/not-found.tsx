// Unknown route (real app/routes.tsx NotFound). The demo opens on Overview, so that is the way back.
import { PATHS } from "../engine/router"
import { SHELL_COPY } from "../shell/copy"
import { RouteButtonLink } from "../shell/links"
import { Empty } from "../ui/empty"

export default function NotFoundView() {
  const copy = SHELL_COPY.view.notFound
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
      {copy.body}
    </Empty>
  )
}
