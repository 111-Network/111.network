"use client"

import { useSyncExternalStore } from "react"
import { X } from "lucide-react"

const CONSENT_KEY = "111-cookie-consent"

type ConsentValue = "accepted" | "dismissed"
// "unknown" = server render / hydration (render nothing, so nothing flashes);
// "none" = no choice stored yet (show the banner).
type ConsentSnapshot = ConsentValue | "none" | "unknown"

// Holds the choice when storage is unavailable (private mode, blocked site
// data), so the banner still closes for this page view.
let memoryChoice: ConsentValue | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function getSnapshot(): ConsentSnapshot {
  if (memoryChoice) return memoryChoice
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) return "none"
    return stored === "accepted" ? "accepted" : "dismissed"
  } catch {
    return "none"
  }
}

function getServerSnapshot(): ConsentSnapshot {
  return "unknown"
}

function saveConsent(value: ConsentValue) {
  memoryChoice = value
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // localStorage not available; memoryChoice keeps the banner closed
  }
  listeners.forEach((listener) => listener())
}

export function CookieBanner() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // "unknown" (server / hydration) and a stored choice both render nothing.
  if (consent !== "none") return null

  // CSS entrance (tw-animate-css), no framer on the first-load path; none under reduced motion.
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 z-50 max-w-sm border border-border bg-background/80 p-4 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-250 ease-out motion-reduce:animate-none"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          We use{" "}
          <span className="text-foreground">strictly necessary cookies</span>{" "}
          to operate this website.{" "}
          <a
            href="/terms"
            className="underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
          >
            Terms
          </a>
        </p>
        <button
          type="button"
          onClick={() => saveConsent("dismissed")}
          aria-label="Dismiss cookie banner"
          className="-mt-3 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-200 hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => saveConsent("accepted")}
          className="min-h-11 border border-border px-4 font-mono text-xs text-muted-foreground transition-all duration-200 hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
