import { describe, expect, it } from "vitest"
import { agoText, formatClock, formatClockSeconds, formatDay, formatDuration, HOUR, MIN, SEC } from "./clock"
import { createFakeDriver, createScheduler } from "./scheduler"

describe("scheduler: manual time", () => {
  it("runs tasks in due order, then schedule order", () => {
    const s = createScheduler()
    const log: string[] = []
    s.schedule(300, () => log.push("c"))
    s.schedule(100, () => log.push("a"))
    s.schedule(100, () => log.push("b"))
    s.schedule(0, () => log.push("now"))
    expect(s.advance(99)).toBe(1)
    expect(log).toEqual(["now"])
    s.advance(1)
    expect(log).toEqual(["now", "a", "b"])
    s.advance(1000)
    expect(log).toEqual(["now", "a", "b", "c"])
    expect(s.now()).toBe(1100)
  })

  it("tasks see their own due time, and tasks they schedule inside the window run too", () => {
    const s = createScheduler()
    const at: number[] = []
    s.schedule(50, () => {
      at.push(s.now())
      s.schedule(25, () => at.push(s.now()))
    })
    s.advance(200)
    expect(at).toEqual([50, 75])
  })

  it("cancels by handle and by key; a key replaces the pending task", () => {
    const s = createScheduler()
    const log: string[] = []
    const cancel = s.schedule(10, () => log.push("x"))
    s.schedule(10, () => log.push("old"), { key: "k" })
    s.schedule(20, () => log.push("new"), { key: "k" })
    s.schedule(30, () => log.push("gone"), { key: "g" })
    cancel()
    s.cancel("g")
    expect(s.pending().map((p) => p.key)).toEqual(["k"])
    s.advance(100)
    expect(log).toEqual(["new"])
  })

  it("does not move while paused; reasons stack", () => {
    const s = createScheduler()
    const log: string[] = []
    s.schedule(100, () => log.push("x"))
    s.pause("hidden")
    s.pause("view")
    expect(s.isPaused()).toBe(true)
    expect(s.advance(1000)).toBe(0)
    s.resume("hidden")
    expect(s.advance(1000)).toBe(0)
    s.resume("view")
    expect(s.isPaused()).toBe(false)
    s.advance(100)
    expect(log).toEqual(["x"])
  })

  it("runUntilIdle drains everything", () => {
    const s = createScheduler()
    let n = 0
    const step = () => {
      n++
      if (n < 5) s.schedule(1000, step)
    }
    s.schedule(1000, step)
    expect(s.runUntilIdle()).toBe(5)
    expect(s.now()).toBe(5000)
  })
})

describe("scheduler: with a driver", () => {
  it("follows the driver's time and wakes on time", () => {
    const d = createFakeDriver()
    const s = createScheduler()
    const log: number[] = []
    s.attach(d)
    s.schedule(500, () => log.push(s.now()))
    d.advance(499)
    expect(log).toEqual([])
    d.advance(1)
    expect(log).toEqual([500])
    expect(d.waiting()).toBe(0)
  })

  it("paused real time does not count", () => {
    const d = createFakeDriver()
    const s = createScheduler()
    const log: string[] = []
    s.attach(d)
    s.schedule(1000, () => log.push("due"))
    d.advance(400)
    s.pause()
    d.advance(60_000)
    expect(log).toEqual([])
    expect(s.now()).toBe(400)
    s.resume()
    d.advance(599)
    expect(log).toEqual([])
    d.advance(1)
    expect(log).toEqual(["due"])
    expect(s.now()).toBe(1000)
  })

  it("detach stops time and keeps pending tasks for the next attach", () => {
    const d = createFakeDriver()
    const s = createScheduler()
    const log: string[] = []
    s.attach(d)
    s.schedule(100, () => log.push("x"))
    s.detach()
    d.advance(10_000)
    expect(log).toEqual([])
    expect(s.pending()).toHaveLength(1)
    s.attach(d)
    d.advance(100)
    expect(log).toEqual(["x"])
  })
})

describe("clock: hand-made formatting", () => {
  it("formats the virtual clock from 09:00", () => {
    expect(formatClock(0)).toBe("09:00")
    expect(formatClock(12 * MIN + 5 * SEC)).toBe("09:12")
    expect(formatClockSeconds(12 * MIN + 5 * SEC)).toBe("09:12:05")
    expect(formatClock(-12 * MIN)).toBe("08:48")
    expect(formatClock(15 * HOUR)).toBe("00:00")
    expect(formatDay(0)).toBe("17 Oct")
    expect(formatDay(-10 * HOUR)).toBe("16 Oct")
    expect(formatDay(-20 * 24 * HOUR)).toBe("27 Sep")
  })
  it("formats ago and durations like the real dashboard", () => {
    expect(agoText(0, 5 * SEC)).toBe("just now")
    expect(agoText(0, 40 * SEC)).toBe("40 s ago")
    expect(agoText(0, 2 * MIN)).toBe("2 min ago")
    expect(agoText(0, 3 * HOUR)).toBe("3 h ago")
    expect(agoText(0, 49 * HOUR)).toBe("2 d ago")
    expect(formatDuration(45 * SEC)).toBe("45 s")
    expect(formatDuration(3 * HOUR + 5 * MIN)).toBe("3 h 5 min")
  })
})
