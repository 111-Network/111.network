// The demo's pausable scheduler over a VIRTUAL clock (plan §6.5). Plain TS: no React, no window.
//
// - Time is virtual ms since the demo epoch (clock.ts formats it). It never reads Date.now.
// - Time moves only while a driver is attached AND nothing pauses it (the tab is hidden, the shell
//   is offscreen, a test said so). Paused time does not count: a step due in 2 s is still 2 s away
//   after a minute in a background tab.
// - Order is deterministic: by due time, then by schedule order.
// - The real-time driver (setTimeout + performance.now) is injected, so tests use the fake driver
//   or no driver at all and call advance().
// Views never call setTimeout/setInterval for demo behaviour: they dispatch an action and their
// slice schedules the next step, or they use store.schedule().

/** Something that can wake the scheduler. Real: setTimeout. Tests: createFakeDriver(). */
export interface SchedulerDriver {
  /** Monotonic real ms (any origin). */
  now(): number
  /** Call `wake` once, `ms` real ms from now. Returns a cancel. */
  wakeAfter(ms: number, wake: () => void): () => void
}

export interface ScheduledTask {
  id: number
  key: string | null
  label: string | null
  /** Virtual ms at which it runs. */
  due: number
}

export interface Scheduler {
  /** Current virtual time (ms since the demo epoch). */
  now(): number
  /** Run `run` after `delayMs` of virtual time. A pending task with the same key is replaced. Returns a cancel. */
  schedule(delayMs: number, run: () => void, opts?: { key?: string; label?: string }): () => void
  /** Drop the pending task with this key, if any. */
  cancel(key: string): void
  cancelAll(): void
  /** Pending tasks in run order (copies). */
  pending(): ScheduledTask[]
  /** Stop time for `reason` (default "manual"). Several reasons stack: time moves only when none is left. */
  pause(reason?: string): void
  resume(reason?: string): void
  isPaused(): boolean
  /** Attach a driver: virtual time follows real time from now on (unless paused). */
  attach(driver: SchedulerDriver): void
  /** Detach the driver: time stops; pending tasks are kept for the next attach. */
  detach(): void
  /**
   * Move virtual time forward by `ms`, running every task that falls due, in order (tasks scheduled
   * by those tasks run too when they fall inside the window). Does nothing while paused. Returns
   * how many tasks ran. For tests and the fake driver; works with or without a driver.
   */
  advance(ms: number): number
  /** advance() until nothing is pending (or `maxMs` of virtual time has passed). Returns tasks run. */
  runUntilIdle(maxMs?: number): number
}

interface Task extends ScheduledTask {
  run: () => void
}

/** A runaway guard: one wake never runs more than this many tasks. */
const MAX_RUNS_PER_STEP = 10_000

export function createScheduler(opts: { start?: number } = {}): Scheduler {
  let t = opts.start ?? 0
  let driver: SchedulerDriver | null = null
  let lastSync = 0
  let wakeCancel: (() => void) | null = null
  let nextId = 1
  let inRun = false
  const pausedBy = new Set<string>()
  const queue: Task[] = []

  const running = (): boolean => driver !== null && pausedBy.size === 0

  function now(): number {
    if (!running() || driver === null) return t
    return t + Math.max(0, driver.now() - lastSync)
  }

  /** Fold the real time that passed into `t` (no tasks run). */
  function sync(): void {
    if (!running() || driver === null) return
    const real = driver.now()
    t += Math.max(0, real - lastSync)
    lastSync = real
  }

  function disarm(): void {
    wakeCancel?.()
    wakeCancel = null
  }

  function arm(): void {
    disarm()
    if (!running() || driver === null || queue.length === 0) return
    const delay = Math.max(0, queue[0].due - now())
    wakeCancel = driver.wakeAfter(delay, onWake)
  }

  function runDue(limit: number): number {
    let ran = 0
    inRun = true
    try {
      while (queue.length > 0 && queue[0].due <= limit && ran < MAX_RUNS_PER_STEP) {
        const task = queue.shift() as Task
        t = Math.max(t, task.due)
        ran++
        task.run()
      }
    } finally {
      inRun = false
    }
    t = Math.max(t, limit)
    return ran
  }

  function onWake(): void {
    wakeCancel = null
    sync()
    try {
      runDue(t)
    } finally {
      arm()
    }
  }

  function removeKey(key: string): void {
    const i = queue.findIndex((x) => x.key === key)
    if (i >= 0) queue.splice(i, 1)
  }

  function insert(task: Task): void {
    // Stable: after every task due at the same time or earlier.
    let i = queue.length
    while (i > 0 && queue[i - 1].due > task.due) i--
    queue.splice(i, 0, task)
  }

  const scheduler: Scheduler = {
    now,
    schedule(delayMs, run, o = {}) {
      const key = o.key ?? null
      if (key !== null) removeKey(key)
      const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0
      const task: Task = { id: nextId++, key, label: o.label ?? null, due: now() + delay, run }
      insert(task)
      if (!inRun) arm()
      return () => {
        const i = queue.indexOf(task)
        if (i >= 0) {
          queue.splice(i, 1)
          if (!inRun) arm()
        }
      }
    },
    cancel(key) {
      removeKey(key)
      if (!inRun) arm()
    },
    cancelAll() {
      queue.length = 0
      disarm()
    },
    pending() {
      return queue.map(({ id, key, label, due }) => ({ id, key, label, due }))
    },
    pause(reason = "manual") {
      if (pausedBy.has(reason)) return
      sync()
      pausedBy.add(reason)
      disarm()
    },
    resume(reason = "manual") {
      if (!pausedBy.delete(reason) || pausedBy.size > 0) return
      if (driver !== null) lastSync = driver.now()
      arm()
    },
    isPaused() {
      return pausedBy.size > 0
    },
    attach(d) {
      if (driver === d) return
      scheduler.detach()
      driver = d
      lastSync = d.now()
      arm()
    },
    detach() {
      sync()
      disarm()
      driver = null
    },
    advance(ms) {
      if (pausedBy.size > 0) return 0
      sync()
      const ran = runDue(t + Math.max(0, Number.isFinite(ms) ? ms : 0))
      if (driver !== null) lastSync = driver.now()
      arm()
      return ran
    },
    runUntilIdle(maxMs = 24 * 60 * 60 * 1000) {
      const stop = now() + maxMs
      let ran = 0
      let steps = 0
      while (queue.length > 0 && pausedBy.size === 0 && queue[0].due <= stop && steps++ < MAX_RUNS_PER_STEP) {
        ran += scheduler.advance(Math.max(0, queue[0].due - now()))
      }
      return ran
    },
  }
  return scheduler
}

/** The browser driver: setTimeout wakes, performance.now time. Created only on the client (store.start). */
export function realTimeDriver(): SchedulerDriver {
  return {
    now: () => (typeof performance !== "undefined" ? performance.now() : 0),
    wakeAfter(ms, wake) {
      const handle = setTimeout(wake, ms)
      return () => clearTimeout(handle)
    },
  }
}

export interface FakeDriver extends SchedulerDriver {
  /** Move fake real time forward, firing wakes in order. */
  advance(ms: number): void
  /** Wakes waiting to fire. */
  waiting(): number
}

/** A deterministic driver for tests: real time moves only when advance() is called. */
export function createFakeDriver(): FakeDriver {
  let clock = 0
  let nextId = 1
  const wakes: { id: number; at: number; fn: () => void }[] = []
  return {
    now: () => clock,
    wakeAfter(ms, fn) {
      const w = { id: nextId++, at: clock + Math.max(0, ms), fn }
      wakes.push(w)
      return () => {
        const i = wakes.indexOf(w)
        if (i >= 0) wakes.splice(i, 1)
      }
    },
    advance(ms) {
      const target = clock + Math.max(0, ms)
      for (;;) {
        let next: (typeof wakes)[number] | null = null
        for (const w of wakes) if (w.at <= target && (next === null || w.at < next.at || (w.at === next.at && w.id < next.id))) next = w
        if (next === null) break
        wakes.splice(wakes.indexOf(next), 1)
        clock = Math.max(clock, next.at)
        next.fn()
      }
      clock = target
    },
    waiting: () => wakes.length,
  }
}
