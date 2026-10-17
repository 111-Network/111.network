// Bridge service page (#/services/bridge, Layer 6). STUB: the shared frame only; the bridge view task
// replaces this body (plug in a radio board, the preferred networks, the bridge diagram).
import type { ServiceViewProps } from "../../../shell/view-types"
import { ServicePageFrame } from "../frame"

export default function BridgePage({ id }: ServiceViewProps) {
  return <ServicePageFrame id={id} />
}
