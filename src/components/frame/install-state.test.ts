import { describe, expect, it } from "vitest"
import { INSTALL_COMMANDS } from "@/lib/site"
import {
  INITIAL_INSTALL_STATE,
  INSTALL_TARGET_OPTIONS,
  copyAnnouncement,
  copyButtonLabel,
  installReducer,
} from "./install-state"

describe("installReducer", () => {
  it("starts on this machine, run 0", () => {
    expect(INITIAL_INSTALL_STATE).toEqual({ target: "host", run: 0 })
  })

  it("switching the tab changes the target and retypes", () => {
    const next = installReducer(INITIAL_INSTALL_STATE, { type: "select", target: "phone" })
    expect(next).toEqual({ target: "phone", run: 1 })
    expect(installReducer(next, { type: "select", target: "host" })).toEqual({ target: "host", run: 2 })
  })

  it("selecting the current tab is a no-op (same object, no retype)", () => {
    expect(installReducer(INITIAL_INSTALL_STATE, { type: "select", target: "host" })).toBe(INITIAL_INSTALL_STATE)
  })

  it("COPY keeps the target and always retypes", () => {
    const once = installReducer(INITIAL_INSTALL_STATE, { type: "copy" })
    const twice = installReducer(once, { type: "copy" })
    expect(once).toEqual({ target: "host", run: 1 })
    expect(twice).toEqual({ target: "host", run: 2 })
  })
})

describe("install copy", () => {
  it("has one tab per command, in order, in plain words", () => {
    expect(INSTALL_TARGET_OPTIONS.map((o) => o.value)).toEqual(Object.keys(INSTALL_COMMANDS))
    expect(INSTALL_TARGET_OPTIONS.map((o) => o.label)).toEqual(["THIS MACHINE", "ATTACHED PHONE"])
  })

  it("labels and announces every copy outcome", () => {
    expect(copyButtonLabel("idle")).toBe("COPY")
    expect(copyButtonLabel("copied")).toBe("COPIED")
    expect(copyButtonLabel("selected")).toBe("SELECTED")
    expect(copyAnnouncement("idle")).toBe("")
    expect(copyAnnouncement("copied")).toMatch(/copied/)
    expect(copyAnnouncement("selected")).toMatch(/selected/)
  })
})
