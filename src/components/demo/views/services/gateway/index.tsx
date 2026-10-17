// Internet gateway service page (#/services/gateway, Layer 7). STUB: the shared frame only; its view
// task replaces this body (connect to the internet, the overlay role, the queue flush).
import type { ServiceViewProps } from "../../../shell/view-types"
import { ServicePageFrame } from "../frame"

export default function GatewayPage({ id }: ServiceViewProps) {
  return <ServicePageFrame id={id} />
}
