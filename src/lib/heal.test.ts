import { describe, expect, it } from "vitest"
import { HEAL_GATES, HEAL_RAIL_LINE, waitsForVisitor } from "@/lib/heal"
import { ANCHORS, ASCII_LOGO, INSTALL_COMMANDS, INSTALL_NOTES, INSTALL_READ_FIRST_URL, INSTALL_RUN, INSTALL_SCRIPT_SOURCE } from "@/lib/site"

describe("HEAL_GATES (W13)", () => {
  it("runs in the plan's order", () => {
    expect(HEAL_RAIL_LINE).toBe(
      "APPROVED HERE → PR UPSTREAM → MAINTAINERS → MERGED → VIA GATEWAY → NODE B RE-CHECKS → NODE B'S OWNER",
    )
  })

  it("has exactly two human stations, first and last, each with its button", () => {
    const human = HEAL_GATES.filter((g) => g.kind === "human")
    expect(human.map((g) => g.action)).toEqual(["APPROVE ON THIS NODE", "APPROVE AS NODE B'S OWNER"])
    expect(HEAL_GATES[0].kind).toBe("human")
    expect(HEAL_GATES[HEAL_GATES.length - 1].kind).toBe("human")
  })

  it("lets the visitor advance the maintainers with next, and nothing else waits", () => {
    expect(HEAL_GATES.find((g) => g.id === "maintainers")).toMatchObject({ kind: "upstream", action: "next" })
    expect(HEAL_GATES.map((_, i) => waitsForVisitor(i))).toEqual([true, false, true, false, false, false, true])
    expect(waitsForVisitor(99)).toBe(false)
  })
})

describe("shared install copy", () => {
  it("never puts sudo in a command and points READ IT FIRST at the source while not live", () => {
    for (const cmd of Object.values(INSTALL_COMMANDS)) expect(cmd).not.toMatch(/\bsudo\b/)
    expect(INSTALL_READ_FIRST_URL).toBe(INSTALL_SCRIPT_SOURCE)
    expect(INSTALL_NOTES.user).toBe("Run as your normal user. Never put sudo in front.")
    expect(INSTALL_RUN.host.at(-1)?.text).toBe("node online · dashboard ready")
    expect(INSTALL_RUN.phone[0].text).toContain("USB-C")
  })

  it("keeps the anchors and the logo stable", () => {
    expect(ANCHORS).toEqual({ main: "main", install: "install", terminal: "terminal" })
    expect(ASCII_LOGO.split("\n")).toHaveLength(6)
  })
})
