// Server-render smoke tests of the Agent view: it renders in node, its heading follows the shell,
// the greeting offers the starters with "Nothing is sent until you send it", replies carry the
// "demo reply" note, a prepared prompt sits in the box with its banner, and proposals show
// Accept / Dismiss / Why?.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoStoreProvider } from "../../engine/react"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import AgentView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({ mainId: "m", mainRef: { current: null }, announce: () => {}, embedded, headingBase: embedded ? 3 : 1 })

function render(store: DemoStore, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, createElement(AgentView))))
}

const newStore = () => {
  const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/" })
  store.start()
  return store
}

const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ")

describe("Agent view render", () => {
  it("opens on the greeting with the four starters, the state chip and the composer", () => {
    const html = render(newStore())
    expect(html).toMatch(/<h1[^>]*>Agent<\/h1>/)
    const t = text(html)
    expect(t).toContain("agent ~ chat")
    expect(t).toContain("ready")
    expect(t).toContain("Ask anything about this node. Try: 'check this node', 'set up my radio', 'why is the radio quiet?', 'what can this device run?'")
    expect(t).toContain("A button fills the message box. Nothing is sent until you send it.")
    expect(html).toContain('role="log"')
    expect(html).toContain('aria-label="Message to the agent"')
    expect(t).toContain("send")
    expect(html).not.toMatch(/href="#(?!\/)/)
  })

  it("takes the shell's heading level inside the L4 window", () => {
    const html = render(newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Agent<\/h3>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("a reply carries the demo reply note and its tool lines; a stream shows the stop button", () => {
    const store = newStore()
    store.dispatch({ type: "agent/send", text: "check this node", instant: true })
    let t = text(render(store))
    expect(t).toContain("demo reply")
    expect(t).toContain("[checking health]")
    expect(t).toContain("Your node is running.")
    store.dispatch({ type: "agent/send", text: "what can this device run?" })
    t = text(render(store))
    expect(t).toContain("Agent is replying:")
    expect(t).toContain("stop")
  })

  it("a prepared prompt fills the box under its banner; nothing is sent", () => {
    const store = newStore()
    store.dispatch({ type: "core/agentPrefill", text: "Set up the bridge on this node and test it.", from: "Bridge" })
    const html = render(store)
    expect(text(html)).toContain("prepared from: Bridge — edit, then send. Nothing is sent until you send it.")
    expect(html).toContain(">Set up the bridge on this node and test it.</textarea>")
    expect(store.getSnapshot().agent.rows).toHaveLength(0)
  })

  it("an open proposal shows as a card with Accept, Dismiss and Why?", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    store.dispatch({ type: "agent/send", text: "check this node", instant: true })
    const t = text(render(store))
    expect(t).toContain("1 proposal needs you")
    expect(t).toContain("Restart the mesh link")
    for (const b of ["Accept", "Dismiss", "Why?"]) expect(t).toContain(b)
    expect(t).toContain("Nothing changes on this node until you accept a proposal.")
  })
})
