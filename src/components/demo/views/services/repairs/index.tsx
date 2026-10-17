// Repairs service page (#/services/repairs, Layer 9). STUB: the shared frame only; the repairs view
// task replaces this body (health matrix, simulate a fault, sandbox, proposal, the gate rail).
import type { ServiceViewProps } from "../../../shell/view-types"
import { ServicePageFrame } from "../frame"

export default function RepairsPage({ id }: ServiceViewProps) {
  return <ServicePageFrame id={id} />
}
