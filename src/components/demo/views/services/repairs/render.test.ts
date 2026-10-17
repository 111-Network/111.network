// Server-render smoke tests of the Repairs page: it renders in node, its headings follow the shell,
// and every stage of a run shows its own controls and notes.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { DemoStoreProvider } from "../../../engine/react"
import { parsePath } from "../../../engine/router"
import { createDemoStore, type DemoStore } from "../../../engine/store"
import { DEMO_WORLD } from "../../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../../shell/context"
import RepairsPage from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

function render(store: DemoStore, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const page = createElement(RepairsPage, { route: parsePath("/services/repairs"), id: "repairs" })
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, page)))
}

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/repairs" })
const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

describe("Repairs page render", () => {
  it("opens healthy: matrix, the demo action, an empty repair, an idle rail, nothing shared", () => {
    const html = render(newStore())
    expect(html).toMatch(/<h1[^>]*>Repairs<\/h1>/)
    const t = text(html)
    expect(t).toContain("DEMO simulate a fault")
    expect(t).toContain(REPAIRS_COPY.matrix.allWell)
    expect(t).toContain(REPAIRS_COPY.run.noneTitle)
    expect(t).toContain("APPROVE ON THIS NODE")
    expect(t).toContain(REPAIRS_COPY.rail.approveHint)
    expect(t).toContain(REPAIRS_COPY.shared.emptyTitle)
    expect(t).toContain(REPAIRS_COPY.log.empty)
    expect(t).toContain("LIVE")
    expect(html).not.toMatch(/href="#(?!\/)/)
  })

  it("at the first human gate: the change, the checks, Dismiss, the bad-fix demo action and the demo reply note", () => {
    const s = newStore()
    s.dispatch({ type: "repairs/simulate", instant: true })
    const t = text(render(s))
    expect(t).toContain(REPAIRS_COPY.run.heading(REPAIRS_COPY.faults.outbox.title))
    expect(t).toContain("demo reply")
    expect(t).toContain(REPAIRS_COPY.run.diffLegend)
    expect(t).toContain("added: retry the outbox whenever any link comes back")
    expect(t).toContain("removed: stop retrying a message once its link drops")
    expect(t).toContain("failure replayed: gone")
    expect(t).toContain("Dismiss")
    expect(t).toContain("DEMO try a bad fix")
    expect(t).toContain(REPAIRS_COPY.rail.state.waitingYou)
    expect(t).toContain("Messaging needs a repair.")
    expect(t).toContain("ERROR")
  })

  it("after the bad fix: nothing leaves the sandbox and the approve button explains why", () => {
    const s = newStore()
    s.dispatch({ type: "repairs/simulate", instant: true })
    s.dispatch({ type: "repairs/badFix", instant: true })
    const t = text(render(s))
    expect(t).toContain(REPAIRS_COPY.rejected)
    expect(t).toContain(REPAIRS_COPY.run.proper)
    expect(t).toContain(REPAIRS_COPY.run.badge.rejected)
  })

  it("at the maintainers and at node B's owner: only that station's button shows", () => {
    const s = newStore()
    s.dispatch({ type: "repairs/simulate", instant: true })
    s.dispatch({ type: "repairs/passGate", index: 0, instant: true })
    let t = text(render(s))
    expect(t).toContain(REPAIRS_COPY.rail.state.waitingMaintainers)
    expect(t).toContain("next : maintainers review upstream")
    expect(t).not.toContain("APPROVE AS NODE B'S OWNER")
    s.dispatch({ type: "repairs/passGate", index: 2, instant: true })
    t = text(render(s))
    expect(t).toContain("APPROVE AS NODE B'S OWNER")
    expect(t).toContain(REPAIRS_COPY.rail.state.waitingOwner)
    s.dispatch({ type: "repairs/passGate", index: 6, instant: true })
    t = text(render(s))
    expect(t).toContain(REPAIRS_COPY.shared.entry("messaging"))
    expect(t).toContain("demo message")
    expect(t).toMatch(/repaired at \d\d:\d\d/)
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    const html = render(newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Repairs<\/h3>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })
})
