// "v more" under a cut-off sidebar list (real app/Sidebar.tsx useMoreBelow), as a callback ref.
// The state is set only from observer and scroll callbacks, never synchronously in an effect: a
// ResizeObserver reports the element's size once as soon as it starts observing it.
import { useCallback, useEffect, useState } from "react"

/** True while the element has more content below its visible part. */
export function moreBelow(el: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight > 2
}

export function useMoreBelow<T extends HTMLElement>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null)
  const [more, setMore] = useState(false)
  const ref = useCallback((next: T | null) => setNode(next), [])

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return
    const update = () => setMore(moreBelow(node))
    node.addEventListener("scroll", update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(node)
    for (const child of node.children) resize.observe(child)
    const mutate = typeof MutationObserver === "undefined" ? null : new MutationObserver(update)
    mutate?.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] })
    return () => {
      node.removeEventListener("scroll", update)
      resize.disconnect()
      mutate?.disconnect()
    }
  }, [node])

  return [ref, node !== null && more]
}
