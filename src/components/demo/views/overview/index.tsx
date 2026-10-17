// Overview (#/overview, the demo's landing view). STUB: the overview view task replaces this body
// (verdict, needs you with id "needs-you", services grid, nearby summary).
import { useDemo } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { selectServices, verdict } from "../../engine/selectors"
import { RouteLink } from "../../shell/links"
import { selectAlias } from "../../shell/select"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import { StatusDot } from "../../ui/status-dot"

export default function OverviewView() {
  const name = useDemo(selectAlias)
  const v = useDemo(verdict)
  const services = useDemo(selectServices)
  return (
    <ViewPlaceholder kicker="overview" title={name}>
      <p className="font-mono text-sm leading-relaxed text-foreground">{v.sentence}</p>
      <ul className="flex flex-col gap-2">
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <StatusDot state={s.state} />
            <RouteLink to={PATHS.service(s.id)}>{s.name}</RouteLink>
          </li>
        ))}
      </ul>
    </ViewPlaceholder>
  )
}
