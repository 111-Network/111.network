// Devices and device detail (#/devices, #/devices/add, #/devices/<id>; Layers 1 and 6). Real
// views/devices/index.tsx: the router sends all three here and this view branches on the route.
import type { ViewProps } from "../../shell/view-types"
import { AddDevice } from "./add"
import { DeviceDetail } from "./detail"
import { DeviceList } from "./list"
import { ADD_DEVICE_ID } from "./model"

export default function DevicesView({ route }: ViewProps) {
  if (route.view === "device") {
    if (route.id === ADD_DEVICE_ID) return <AddDevice />
    return <DeviceDetail key={route.id} id={route.id} />
  }
  return <DeviceList />
}
