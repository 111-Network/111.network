import { describe, expect, it } from "vitest"
import { DEVICE_PARAM, buildDeviceUrl, parseDeviceParam } from "@/lib/device-param"
import * as store from "@/lib/device-store"

describe("device-param URL helpers", () => {
  it("reads ?device= and falls back to the default", () => {
    expect(DEVICE_PARAM).toBe("device")
    expect(parseDeviceParam("?device=old-phone")).toBe("old-phone")
    expect(parseDeviceParam("device=radio-relay")).toBe("radio-relay")
    expect(parseDeviceParam("?a=1&device=gpu-pc&b=2")).toBe("gpu-pc")
    expect(parseDeviceParam("")).toBe("laptop")
    expect(parseDeviceParam("?device=")).toBe("laptop")
    expect(parseDeviceParam("?device=toaster")).toBe("laptop")
    expect(parseDeviceParam("?device=OLD-PHONE")).toBe("laptop")
    expect(parseDeviceParam("?device=%3Cscript%3E")).toBe("laptop")
  })

  it("writes ?device= keeping other params and the hash", () => {
    expect(buildDeviceUrl({ pathname: "/", search: "", hash: "" }, "old-phone")).toBe("/?device=old-phone")
    expect(buildDeviceUrl({ pathname: "/", search: "?device=laptop", hash: "#layer-3" }, "home-server")).toBe(
      "/?device=home-server#layer-3",
    )
    expect(buildDeviceUrl({ pathname: "/x", search: "?a=1", hash: "#y" }, "radio-box")).toBe("/x?a=1&device=radio-box#y")
  })
})

describe("device-store", () => {
  it("re-exports the URL helpers for client code", () => {
    expect(store.parseDeviceParam).toBe(parseDeviceParam)
    expect(store.buildDeviceUrl).toBe(buildDeviceUrl)
    expect(store.DEVICE_PARAM).toBe(DEVICE_PARAM)
  })

  it("defaults to the laptop without a window", () => {
    expect(store.getCurrentDevice()).toBe("laptop")
  })
})
