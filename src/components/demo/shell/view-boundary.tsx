// Keeps a view that fails (a chunk that cannot load offline, a render error) inside the main area:
// the sidebar and header keep working. RouteView keys it by the view module, so opening another
// view mounts a fresh boundary and tries again.
import { Component, type ReactNode } from "react"
import { PATHS } from "../engine/router"
import { Empty } from "../ui/empty"
import { SHELL_COPY } from "./copy"
import { RouteButtonLink } from "./links"

interface ViewBoundaryState {
  failed: boolean
}

export class ViewBoundary extends Component<{ children: ReactNode }, ViewBoundaryState> {
  state: ViewBoundaryState = { failed: false }

  static getDerivedStateFromError(): ViewBoundaryState {
    return { failed: true }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    const copy = SHELL_COPY.view.failed
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
}
