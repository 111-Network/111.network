// "[DEMO] connect to the internet" / "[DEMO] drop the internet connection" (plan §6.3): the one
// contextual demo action of Layer 7, on the Internet gateway page and in Nearby's presence panel.
// Connecting dispatches core/internetConnected (the gateway goes STARTING -> LIVE, the messages
// slice flushes its queue); dropping dispatches core/internetLost (a pure mesh node again). It is
// the same <button> in both states, so focus stays on it when its words change.
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { DEMO_ACTIONS } from "../../../copy/core"
import { GATEWAY_COPY } from "../../../copy/gateway"
import { useDemo, useDispatch } from "../../../engine/react"
import { DemoButton } from "../../../ui/demo-button"
import { selectInternet } from "../../nearby/select"

export function InternetDemoButton() {
  const internet = useDemo(selectInternet)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const online = internet === "connected"
  const toggle = () => dispatch(online ? { type: "core/internetLost" } : { type: "core/internetConnected", instant: reduced })
  return <DemoButton onClick={toggle}>{online ? GATEWAY_COPY.disconnect : DEMO_ACTIONS.internet}</DemoButton>
}
