import { afterEach, describe, expect, it, vi } from "vitest"
import { getActiveLayer, subscribeActiveLayer } from "./nav-spy"

// Node env: a stub IntersectionObserver lets the test drive the band.

interface Stub {
  fire: (entries: { id: string; isIntersecting: boolean }[]) => void
  observed: string[]
  options: IntersectionObserverInit | undefined
  disconnected: () => boolean
}

function stubObserver(): Stub {
  let callback: IntersectionObserverCallback = () => {}
  let options: IntersectionObserverInit | undefined
  let disconnected = false
  const observed: string[] = []
  class FakeObserver {
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      callback = cb
      options = opts
    }
    observe(el: { id: string }) {
      observed.push(el.id)
    }
    disconnect() {
      disconnected = true
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver)
  vi.stubGlobal("document", { getElementById: (id: string) => ({ id }) })
  return {
    fire: (entries) =>
      callback(
        entries.map((e) => ({ target: { id: e.id }, isIntersecting: e.isIntersecting })) as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    observed,
    get options() {
      return options
    },
    disconnected: () => disconnected,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("nav scroll-spy store", () => {
  it("observes the ten sections once, notifies on change, stops with the last subscriber", () => {
    const io = stubObserver()
    const a = vi.fn()
    const b = vi.fn()
    const offA = subscribeActiveLayer(a)
    const offB = subscribeActiveLayer(b)
    expect(io.observed).toEqual(Array.from({ length: 10 }, (_, i) => `layer-${i}`))
    expect(io.options?.rootMargin).toBe("-30% 0px -69% 0px")
    expect(getActiveLayer()).toBeNull()

    io.fire([{ id: "layer-2", isIntersecting: true }])
    expect(getActiveLayer()).toBe(2)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    // Boundary: both in the band, the deeper one wins; then the upper one leaves.
    io.fire([{ id: "layer-3", isIntersecting: true }])
    expect(getActiveLayer()).toBe(3)
    io.fire([{ id: "layer-2", isIntersecting: false }])
    expect(getActiveLayer()).toBe(3)
    expect(a).toHaveBeenCalledTimes(2)

    // Unknown targets are ignored.
    io.fire([{ id: "terminal", isIntersecting: true }])
    expect(getActiveLayer()).toBe(3)

    io.fire([{ id: "layer-3", isIntersecting: false }])
    expect(getActiveLayer()).toBeNull()

    offA()
    expect(io.disconnected()).toBe(false)
    offB()
    expect(io.disconnected()).toBe(true)
    expect(getActiveLayer()).toBeNull()
  })
})
