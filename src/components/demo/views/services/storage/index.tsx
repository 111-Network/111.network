// Storage service page (#/services/storage, Layer 8). STUB: the shared frame only; the storage view
// task replaces this body (gauge, classes, free-space order, fetch the regional map).
import type { ServiceViewProps } from "../../../shell/view-types"
import { ServicePageFrame } from "../frame"

export default function StoragePage({ id }: ServiceViewProps) {
  return <ServicePageFrame id={id} />
}
