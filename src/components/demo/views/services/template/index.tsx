// Service page template (#/services/<id> for agent, model, mesh, radio, kb, messaging). STUB: the
// shared frame only; the services view task replaces this body (control panel, actions, panels).
import type { ServiceViewProps } from "../../../shell/view-types"
import { ServicePageFrame } from "../frame"

export default function ServiceTemplatePage({ id }: ServiceViewProps) {
  return <ServicePageFrame id={id} />
}
