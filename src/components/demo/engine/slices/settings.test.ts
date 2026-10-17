// The settings slice through a memory store and the virtual scheduler: the update check (healthy
// and rollback branches, up to date on the second run, offline-first source, reduced motion),
// restart and its LAN binding, and the guards that keep the steps from crossing.
import { describe, expect, it } from "vitest"
import { SETTINGS_COPY } from "../../copy/settings"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import { initialSettings, needsSettings, OPENING_LAST_CHECK, RESTART_KEY, SETTINGS_TIMING as T, UPDATE_KEY, UPDATE_LOG_LIMIT } from "./settings"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
const upd = (store: DemoStore) => store.getSnapshot().settings.update
const causes = (store: DemoStore) => store.getSnapshot().core.events.map((e) => e.cause)
const keys = (store: DemoStore) => store.scheduler.pending().map((t) => t.key)

describe("settings slice: opening state", () => {
  it("opens idle, up to date from a check before the demo, with nothing scheduled", () => {
    const store = newStore()
    const s = store.getSnapshot().settings
    expect(s).toEqual(initialSettings())
    expect(s.update.phase).toBe("idle")
    expect(s.update.lastResult).toBe("up to date")
    expect(s.update.lastCheck).toBe(OPENING_LAST_CHECK)
    expect(OPENING_LAST_CHECK).toBeLessThan(0)
    expect(s.update.log).toEqual([])
    expect(s.restart.phase).toBe("idle")
    expect(s.lan).toEqual({ enabled: false, bound: false })
    // Nothing moves while idle.
    expect(keys(store).filter((k) => k?.startsWith("settings:"))).toEqual([])
  })

  it("adds nothing to needs-you", () => {
    expect(needsSettings()).toEqual([])
  })
})

describe("settings slice: update check", () => {
  it("steps checking -> staged -> probation -> healthy through the scheduler, one step at a time", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    expect(upd(store).phase).toBe("checking")
    expect(upd(store).run).toBe(1)
    expect(keys(store)).toContain(UPDATE_KEY)

    store.scheduler.advance(T.checkMs - 1)
    expect(upd(store).phase).toBe("checking")
    store.scheduler.advance(1)
    expect(upd(store).phase).toBe("staged")
    expect(upd(store).source).toBe("hub") // offline: from the home hub over Wi-Fi
    expect(upd(store).lastCheck).toBe(T.checkMs)

    store.scheduler.advance(T.stageMs)
    expect(upd(store).phase).toBe("probation")
    expect(upd(store).onNewer).toBe(false) // the previous version is kept until the trial ends

    store.scheduler.advance(T.trialMs)
    const u = upd(store)
    expect(u.phase).toBe("idle")
    expect(u.onNewer).toBe(true)
    expect(u.lastResult).toBe("updated")
    expect(keys(store)).not.toContain(UPDATE_KEY)

    expect(causes(store)).toEqual(expect.arrayContaining(["update-check", "settings/trial", "update-healthy"]))
    const log = u.log.map((l) => l.text)
    const L = SETTINGS_COPY.update.log
    expect(log).toEqual([L.checking, L.found(SETTINGS_COPY.update.source.hub), L.trial, L.passed])
    expect(u.log.map((l) => l.seq)).toEqual([1, 2, 3, 4])
  })

  it("rolls back when the trial is set to fail, and consumes the switch", () => {
    const store = newStore()
    store.dispatch({ type: "settings/failNext", fail: true })
    expect(upd(store).failNext).toBe(true)
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.advance(T.checkMs + T.stageMs + T.trialMs)
    expect(upd(store).phase).toBe("reverting")
    expect(upd(store).failing).toBe(true)
    expect(upd(store).failNext).toBe(false)
    // The switch cannot change while the node is going back.
    store.dispatch({ type: "settings/failNext", fail: true })
    expect(upd(store).failNext).toBe(false)

    store.scheduler.advance(T.revertMs)
    const u = upd(store)
    expect(u.phase).toBe("idle")
    expect(u.onNewer).toBe(false)
    expect(u.failing).toBe(false)
    expect(u.lastResult).toBe("rolled back")
    expect(causes(store)).toContain("update-rolled-back")
    expect(causes(store)).not.toContain("update-healthy")
  })

  it("can be set to fail during the trial itself", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.advance(T.checkMs + T.stageMs)
    expect(upd(store).phase).toBe("probation")
    store.dispatch({ type: "settings/failNext", fail: true })
    store.scheduler.runUntilIdle()
    expect(upd(store).lastResult).toBe("rolled back")
  })

  it("after an update, the next check finds nothing newer: up to date, no download, no trial", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.runUntilIdle()
    expect(upd(store).onNewer).toBe(true)
    const before = upd(store).log.length
    store.dispatch({ type: "settings/updateCheck" })
    expect(upd(store).run).toBe(2)
    store.scheduler.advance(T.checkMs)
    const u = upd(store)
    expect(u.phase).toBe("idle")
    expect(u.lastResult).toBe("up to date")
    expect(u.log.slice(before).map((l) => l.text)).toEqual([SETTINGS_COPY.update.log.checking, SETTINGS_COPY.update.log.none])
    expect(keys(store)).not.toContain(UPDATE_KEY)
  })

  it("after a rollback, the next check offers the newer version again", () => {
    const store = newStore()
    store.dispatch({ type: "settings/failNext", fail: true })
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.runUntilIdle()
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.runUntilIdle()
    expect(upd(store).lastResult).toBe("updated")
    expect(upd(store).onNewer).toBe(true)
  })

  it("takes the newer version from the internet while connected", () => {
    const store = newStore()
    store.dispatch({ type: "core/internetConnected", instant: true })
    expect(store.getSnapshot().core.internet).toBe("connected")
    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.advance(T.checkMs)
    expect(upd(store).source).toBe("internet")
  })

  it("ignores a second check while one runs", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    const running = store.getSnapshot().settings
    store.dispatch({ type: "settings/updateCheck" })
    expect(store.getSnapshot().settings).toBe(running)
    expect(upd(store).run).toBe(1)
  })

  it("ignores a stale step of an earlier run", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    const before = store.getSnapshot().settings
    store.dispatch({ type: "settings/updateStep", run: 99 })
    expect(store.getSnapshot().settings).toBe(before)
  })

  it("under reduced motion lands the end state in the same dispatch, with nothing left scheduled", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck", instant: true })
    expect(upd(store).phase).toBe("idle")
    expect(upd(store).lastResult).toBe("updated")
    expect(keys(store)).not.toContain(UPDATE_KEY)

    const rb = newStore()
    rb.dispatch({ type: "settings/failNext", fail: true })
    rb.dispatch({ type: "settings/updateCheck", instant: true })
    expect(upd(rb).phase).toBe("idle")
    expect(upd(rb).lastResult).toBe("rolled back")
    expect(keys(rb)).not.toContain(UPDATE_KEY)
  })

  it("keeps at most UPDATE_LOG_LIMIT log lines, newest last, with sequence numbers never reused", () => {
    const store = newStore()
    for (let i = 0; i < 12; i++) {
      store.dispatch({ type: "settings/updateCheck", instant: true })
    }
    const log = upd(store).log
    expect(log.length).toBe(UPDATE_LOG_LIMIT)
    const seqs = log.map((l) => l.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(seqs[seqs.length - 1]).toBe(upd(store).logSeq)
  })
})

describe("settings slice: restart and sharing", () => {
  it("restarts through the scheduler and comes back, announcing both moments", () => {
    const store = newStore()
    store.dispatch({ type: "settings/restart" })
    expect(store.getSnapshot().settings.restart.phase).toBe("restarting")
    expect(keys(store)).toContain(RESTART_KEY)
    store.scheduler.advance(T.restartMs)
    expect(store.getSnapshot().settings.restart.phase).toBe("back")
    expect(causes(store)).toEqual(expect.arrayContaining(["settings/restart", "settings/restarted"]))
    const restartEvent = store.getSnapshot().core.events.find((e) => e.cause === "settings/restart")
    expect(restartEvent?.text).toBe(SETTINGS_COPY.events.restart(DEMO_WORLD.self.name))
  })

  it("names the renamed node in the restart event, cut to a readable length", () => {
    const store = newStore()
    store.dispatch({ type: "core/renameNode", alias: "b".repeat(64) })
    store.dispatch({ type: "settings/restart", instant: true })
    const ev = store.getSnapshot().core.events.find((e) => e.cause === "settings/restart")
    expect(ev?.text).toBe(SETTINGS_COPY.events.restart("b".repeat(40)))
  })

  it("never lets a restart and an update check cross", () => {
    const store = newStore()
    store.dispatch({ type: "settings/updateCheck" })
    const s1 = store.getSnapshot().settings
    store.dispatch({ type: "settings/restart" })
    expect(store.getSnapshot().settings).toBe(s1)

    const other = newStore()
    other.dispatch({ type: "settings/restart" })
    const s2 = other.getSnapshot().settings
    other.dispatch({ type: "settings/updateCheck" })
    expect(other.getSnapshot().settings).toBe(s2)
    other.dispatch({ type: "settings/restart" })
    expect(other.getSnapshot().settings).toBe(s2)
  })

  it("applies 'share on this network' only after a restart", () => {
    const store = newStore()
    store.dispatch({ type: "settings/setLan", enabled: true })
    expect(store.getSnapshot().settings.lan).toEqual({ enabled: true, bound: false })
    const same = store.getSnapshot().settings
    store.dispatch({ type: "settings/setLan", enabled: true })
    expect(store.getSnapshot().settings).toBe(same)
    store.dispatch({ type: "settings/restart", instant: true })
    expect(store.getSnapshot().settings.lan).toEqual({ enabled: true, bound: true })
    store.dispatch({ type: "settings/setLan", enabled: false })
    expect(store.getSnapshot().settings.lan).toEqual({ enabled: false, bound: true })
  })

  it("ignores a stale restart completion", () => {
    const store = newStore()
    store.dispatch({ type: "settings/restart" })
    const before = store.getSnapshot().settings
    store.dispatch({ type: "settings/restarted", count: 7 })
    expect(store.getSnapshot().settings).toBe(before)
  })

  it("returns the same slice object for actions it does not handle", () => {
    const store = newStore()
    const before = store.getSnapshot().settings
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    store.dispatch({ type: "core/renameNode", alias: "Bench node" })
    expect(store.getSnapshot().settings).toBe(before)
  })
})
