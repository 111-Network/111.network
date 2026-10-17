import { DEMO_READY } from "@/lib/site"

/** Finale "Now open the node." band after L9 (plan §6.7); renders nothing until DEMO_READY. P5 fills it in. */
export function DemoCtaBand() {
  if (!DEMO_READY) return null
  return null
}
