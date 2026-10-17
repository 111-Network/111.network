"use client"

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
} from "react"
import { DeviceChips } from "@/components/common/device-chips"
import { INITIAL_BOOT, bootReducer, type BootAction, type BootState } from "@/components/sections/layer-1/model"
import { getCurrentDevice, subscribeDevice } from "@/lib/device-store"
import { isDeviceId } from "@/lib/devices"

interface BootContextValue {
  state: BootState
  dispatch: Dispatch<BootAction>
}

const BootContext = createContext<BootContextValue | null>(null)

/**
 * Holds the L1 widget state (runs started, the run a click armed, taps made)
 * for the picker and the log pane. It also hears every change of the followed
 * device, so a change no click asked for (?device= on load, back/forward,
 * another section) disarms typing and the log prints whole.
 */
export function BootProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bootReducer, INITIAL_BOOT)
  useEffect(() => subscribeDevice(() => dispatch({ type: "device", device: getCurrentDevice() })), [])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <BootContext value={value}>{children}</BootContext>
}

/** The L1 widget state; only inside <BootProvider>. */
export function useBoot(): BootContextValue {
  const value = use(BootContext)
  if (!value) throw new Error("useBoot must be used inside <BootProvider>")
  return value
}

/**
 * The shared page-level <DeviceChips>, plus one thing only L1 needs: a chip
 * click (pointer, Space, or an arrow key, which Radix turns into a click)
 * starts a new typed run for the clicked chip's device. The capture phase runs
 * before the chip's own handler changes the device, so the run is armed for
 * that device first and the store's change then keeps it.
 */
export function DevicePicker() {
  const { dispatch } = useBoot()
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const chip = event.target instanceof Element ? event.target.closest('[role="radio"]') : null
    const device = chip?.getAttribute("value")
    if (isDeviceId(device)) dispatch({ type: "run", device })
  }
  return (
    <div onClickCapture={onClickCapture}>
      <DeviceChips hideCaption />
    </div>
  )
}
