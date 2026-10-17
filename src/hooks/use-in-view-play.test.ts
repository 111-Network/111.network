import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Node-env test of the pooled observer behind useInViewPlay, with a stub
// IntersectionObserver that fires on demand.

type Entry = { target: Element; isIntersecting: boolean }

class StubObserver {
  static all: StubObserver[] = []
  observed = new Set<Element>()
  constructor(
    private readonly cb: (entries: Entry[]) => void,
    readonly options: { rootMargin?: string; threshold?: number },
  ) {
    StubObserver.all.push(this)
  }
  observe(el: Element) {
    this.observed.add(el)
  }
  unobserve(el: Element) {
    this.observed.delete(el)
  }
  disconnect() {
    this.observed.clear()
  }
  fire(target: Element, isIntersecting: boolean) {
    if (this.observed.has(target)) this.cb([{ target, isIntersecting }])
  }
}

const el = (name: string) => ({ name }) as unknown as Element
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

async function load() {
  vi.resetModules()
  return import("@/hooks/use-in-view-play")
}

beforeEach(() => {
  StubObserver.all = []
  vi.stubGlobal("IntersectionObserver", StubObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("observeInView", () => {
  it("pools one observer per option set and delivers changes", async () => {
    const { observeInView } = await load()
    const a = el("a")
    const seen: boolean[] = []
    const stop = observeInView(a, (v) => seen.push(v))
    observeInView(el("b"), () => {})
    observeInView(el("c"), () => {}, { rootMargin: "100px 0px" })
    expect(StubObserver.all).toHaveLength(2)
    StubObserver.all[0].fire(a, true)
    StubObserver.all[0].fire(a, false)
    expect(seen).toEqual([true, false])
    stop()
    expect(StubObserver.all[0].observed.has(a)).toBe(false)
  })

  it("replays the last state to a callback that joins an element already observed", async () => {
    const { observeInView } = await load()
    const section = el("section")
    observeInView(section, () => {})
    const observer = StubObserver.all[0]
    observer.fire(section, true)

    const late: boolean[] = []
    observeInView(section, (v) => late.push(v))
    expect(late).toEqual([])
    await flush()
    expect(late).toEqual([true])
    observer.fire(section, false)
    expect(late).toEqual([true, false])
  })

  it("lets a callback that joins before the first entry get it from the observer", async () => {
    const { observeInView } = await load()
    const section = el("section")
    const first: boolean[] = []
    const second: boolean[] = []
    observeInView(section, (v) => first.push(v))
    observeInView(section, (v) => second.push(v))
    await flush()
    expect(second).toEqual([])
    StubObserver.all[0].fire(section, true)
    expect(first).toEqual([true])
    expect(second).toEqual([true])
  })

  it("never replays to a callback that already unsubscribed, and keeps the element until the last one leaves", async () => {
    const { observeInView } = await load()
    const section = el("section")
    const stopA = observeInView(section, () => {})
    StubObserver.all[0].fire(section, true)
    const late: boolean[] = []
    const stopLate = observeInView(section, (v) => late.push(v))
    stopLate()
    await flush()
    expect(late).toEqual([])
    expect(StubObserver.all[0].observed.has(section)).toBe(true)
    stopA()
    expect(StubObserver.all[0].observed.has(section)).toBe(false)
  })

  it("forgets the last state once nobody observes the element", async () => {
    const { observeInView } = await load()
    const section = el("section")
    const stop = observeInView(section, () => {})
    StubObserver.all[0].fire(section, true)
    stop()
    const again: boolean[] = []
    observeInView(section, (v) => again.push(v))
    await flush()
    expect(again).toEqual([])
    expect(StubObserver.all[0].observed.has(section)).toBe(true)
  })
})
