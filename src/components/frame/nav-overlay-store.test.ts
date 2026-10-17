import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isNavOverlayOpen,
  markNavFocusHandoff,
  setNavOverlayOpen,
  subscribeNavOverlays,
  takeNavFocusHandoff,
} from "./nav-overlay-store"

afterEach(() => {
  setNavOverlayOpen("install", false)
  setNavOverlayOpen("menu", false)
  takeNavFocusHandoff("install")
  takeNavFocusHandoff("menu")
})

describe("nav overlay open state", () => {
  it("starts closed", () => {
    expect(isNavOverlayOpen("install")).toBe(false)
    expect(isNavOverlayOpen("menu")).toBe(false)
  })

  it("opens and closes each overlay on its own", () => {
    setNavOverlayOpen("install", true)
    expect(isNavOverlayOpen("install")).toBe(true)
    expect(isNavOverlayOpen("menu")).toBe(false)
    setNavOverlayOpen("install", false)
    expect(isNavOverlayOpen("install")).toBe(false)
  })

  it("notifies subscribers only on a real change, and stops after unsubscribe", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNavOverlays(listener)
    setNavOverlayOpen("menu", true)
    setNavOverlayOpen("menu", true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setNavOverlayOpen("menu", false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("focus handoff", () => {
  it("is false until marked, then true exactly once", () => {
    expect(takeNavFocusHandoff("install")).toBe(false)
    markNavFocusHandoff("install")
    expect(takeNavFocusHandoff("menu")).toBe(false)
    expect(takeNavFocusHandoff("install")).toBe(true)
    expect(takeNavFocusHandoff("install")).toBe(false)
  })
})
