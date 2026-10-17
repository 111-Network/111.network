// The shell's one polite live region (real app/LiveRegion.tsx). One per shell, not per page: the
// L4 window and /demo never share a store. It says what changed without moving focus:
// - a navigation ("Opened Devices."), except the first route of the page load;
// - every new store event (each one has a cause and a plain sentence, see copy/core EVENT_TEXT;
//   radar blips arrive as "node-heard" events);
// - anything a view passes to useAnnounce().
// Throttled to one message per 2 s of DEMO time (the newest wins); timers run on the demo
// scheduler, so they pause with it and never use a raw setTimeout.
import { useEffect, useState } from "react"
import type { DemoStore } from "../engine/store"
import { routeTitle } from "../engine/selectors"
import { createAnnouncer, createRegionWriter, type Announcer, type RegionWriter, type SetTimer } from "./announcer"
import { SHELL_COPY } from "./copy"

interface LiveRegionEngine {
  announce: Announcer
  writer: RegionWriter
}

function createEngine(store: DemoStore, set: (text: string) => void): LiveRegionEngine {
  const setTimer: SetTimer = (fn, ms) => store.scheduler.schedule(ms, fn)
  const writer = createRegionWriter({ set, setTimer })
  const announce = createAnnouncer({ emit: (text) => writer.show(text), now: () => store.scheduler.now(), setTimer })
  return { announce, writer }
}

/** The region's text and the announcer that feeds it. Listens to the store's navigation and events. */
export function useLiveRegion(store: DemoStore): [string, (text: string) => void] {
  const [text, setText] = useState("")
  const [engine] = useState(() => createEngine(store, setText))

  useEffect(() => {
    const { announce } = engine
    let core = store.getSnapshot().core
    let routeSeen = core.route !== null
    const off = store.subscribe(() => {
      const next = store.getSnapshot()
      const c = next.core
      if (c === core) return
      if (c.navCount !== core.navCount && c.route !== null) {
        // The first route of a page load (the url router reading the hash) is not news.
        if (routeSeen) announce(SHELL_COPY.announce.view(routeTitle(next)))
        routeSeen = true
      }
      if (c.eventSeq !== core.eventSeq) {
        // Every new event, oldest first: the throttle says the first at once and holds the newest.
        const since = core.eventSeq
        for (const e of c.events) if (e.seq > since && e.text) announce(e.text)
      }
      core = c
    })
    return () => {
      off()
      engine.announce.dispose()
      engine.writer.cancel()
    }
  }, [store, engine])

  return [text, engine.announce]
}

/** The visually hidden region itself. Keep it mounted outside anything that can turn inert. */
export function LiveRegion({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  )
}
