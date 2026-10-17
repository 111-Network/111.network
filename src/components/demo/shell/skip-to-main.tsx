"use client"

// Skip to the dashboard's main area. A button, not an <a href="#id">: on /demo the hash IS the route
// (the url router would read "#demo-main" as an unknown view), so it moves focus by id instead (real
// app/App.tsx does the same). It only shows while focused.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SkipToMainProps {
  targetId: string
  className?: string
  children: ReactNode
}

export const SKIP_CLASS =
  "sr-only bg-foreground font-mono text-xs text-background focus-visible:not-sr-only focus-visible:absolute focus-visible:start-2 focus-visible:top-2 focus-visible:z-[70] focus-visible:px-3 focus-visible:py-2 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"

export function SkipToMain({ targetId, className, children }: SkipToMainProps) {
  return (
    <button
      type="button"
      onClick={(e) => e.currentTarget.ownerDocument.getElementById(targetId)?.focus()}
      className={cn(SKIP_CLASS, className)}
    >
      {children}
    </button>
  )
}
