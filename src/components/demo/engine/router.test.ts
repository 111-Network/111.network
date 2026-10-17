import { describe, expect, it } from "vitest"
import { DEFAULT_PATH, PATHS, cleanPath, formatRoute, hashFor, isActive, parseHash, parsePath, pathFromHash, sameRoute, viewKeyOf } from "./router"

describe("router: default route", () => {
  it("opens Overview on an empty hash (the one deliberate deviation)", () => {
    expect(DEFAULT_PATH).toBe("/overview")
    expect(parseHash("").view).toBe("overview")
    expect(parseHash("#").view).toBe("overview")
    expect(pathFromHash("")).toBe("/overview")
  })

  it("keeps #/ as the Agent", () => {
    const r = parseHash("#/")
    expect(r.view).toBe("agent")
    expect(r.path).toBe("/")
  })
})

describe("router: parse", () => {
  it("parses every route of the demo", () => {
    expect(parseHash("#/overview")).toMatchObject({ view: "overview", path: "/overview" })
    expect(parseHash("#/devices")).toMatchObject({ view: "devices" })
    expect(parseHash("#/devices/radio-board")).toMatchObject({ view: "device", id: "radio-board" })
    expect(parseHash("#/nearby")).toMatchObject({ view: "nearby" })
    expect(parseHash("#/messages")).toMatchObject({ view: "messages" })
    expect(parseHash("#/messages/ada")).toMatchObject({ view: "conversation", peer: "ada" })
    expect(parseHash("#/kb")).toMatchObject({ view: "kb" })
    expect(parseHash("#/kb/recipes")).toMatchObject({ view: "kb-drawer", drawer: "recipes" })
    expect(parseHash("#/kb/recipes/set-up-a-radio-board")).toMatchObject({ view: "kb-note", drawer: "recipes", note: "set-up-a-radio-board" })
    expect(parseHash("#/services/bridge")).toMatchObject({ view: "service", id: "bridge" })
    expect(parseHash("#/settings")).toMatchObject({ view: "settings" })
    for (let n = 0; n <= 9; n++) expect(parseHash(`#/settings/l${n}`)).toMatchObject({ view: "settings-layer", layer: n })
  })

  it("sends unknown and malformed routes to not-found", () => {
    for (const h of ["#/nope", "#/settings/l10", "#/settings/lx", "#/devices/a/b", "#/kb/a/b/c", "#/services", "#/overview/x", "#/devices/%E0%A4%A"]) {
      expect(parseHash(h).view).toBe("not-found")
    }
  })

  it("splits off a query and keeps the second fragment", () => {
    const r = parseHash("#/overview#needs-you")
    expect(r).toMatchObject({ view: "overview", path: "/overview", fragment: "needs-you" })
    expect(parsePath("/devices?x=1").path).toBe("/devices")
    expect(parsePath("/devices/").path).toBe("/devices")
    expect(parsePath("devices").view).toBe("devices")
    expect(cleanPath("")).toBe("/")
  })

  it("decodes and re-encodes segments", () => {
    const r = parsePath(PATHS.conversation("ada lovelace"))
    expect(r).toMatchObject({ view: "conversation", peer: "ada lovelace" })
    expect(r.path).toBe("/messages/ada%20lovelace")
  })
})

describe("router: round trips", () => {
  const paths = [
    "/",
    "/overview",
    "/devices",
    PATHS.device("radio-board"),
    "/nearby",
    "/messages",
    PATHS.conversation("bram"),
    "/kb",
    PATHS.kbDrawer("concepts"),
    PATHS.kbNote("concepts", "thin-bridge"),
    PATHS.service("storage"),
    "/settings",
    PATHS.settingsLayer(2),
    PATHS.needsYou,
  ]
  it("format(parse(path)) is the path", () => {
    for (const p of paths) expect(formatRoute(parsePath(p))).toBe(p)
  })
  it("parse(hashFor(path)) matches parse(path)", () => {
    for (const p of paths) expect(sameRoute(parseHash(hashFor(p)), parsePath(p))).toBe(true)
  })
  it("a hash passed to parsePath by mistake still opens its route, never the Agent", () => {
    for (const p of paths) expect(sameRoute(parsePath(hashFor(p)), parsePath(p))).toBe(true)
    expect(parsePath("#/devices")).toMatchObject({ view: "devices", fragment: null })
    expect(parsePath("#/kb")).toMatchObject({ view: "kb" })
    expect(parsePath("#/overview#needs-you")).toMatchObject({ view: "overview", fragment: "needs-you" })
    expect(parsePath("#/")).toMatchObject({ view: "agent", fragment: null })
  })
})

describe("router: helpers", () => {
  it("isActive matches children except for / and /settings", () => {
    expect(isActive("/devices", "/devices/radio-board")).toBe(true)
    expect(isActive("/", "/devices")).toBe(false)
    expect(isActive("/settings", "/settings/l1")).toBe(false)
    expect(isActive("/settings", "/settings")).toBe(true)
  })
  it("maps routes to the view that renders them", () => {
    expect(viewKeyOf(parsePath("/services/bridge"))).toBe("bridge")
    expect(viewKeyOf(parsePath("/services/storage"))).toBe("storage")
    expect(viewKeyOf(parsePath("/services/repairs"))).toBe("repairs")
    expect(viewKeyOf(parsePath("/services/radio"))).toBe("services")
    expect(viewKeyOf(parsePath("/messages/ada"))).toBe("messages")
    expect(viewKeyOf(parsePath("/settings/l3"))).toBe("settings")
    expect(viewKeyOf(parsePath("/kb/a/b"))).toBe("kb")
    expect(viewKeyOf(parsePath("/zzz"))).toBe("not-found")
  })
})
