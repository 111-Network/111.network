"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

const CONSENT_KEY = "111-cookie-consent"

type ConsentValue = "accepted" | "dismissed"

export function CookieBanner() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (!stored) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const handleConsent = (value: ConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, value)
    } catch {
      // localStorage not available
    }
    setVisible(false)
  }

  if (!mounted) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="dialog"
          aria-label="Cookie consent"
          className="fixed bottom-4 left-4 z-50 max-w-sm border border-border bg-background/80 p-4 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              We use{" "}
              <span className="text-foreground">strictly necessary cookies</span>{" "}
              to operate this website.{" "}
              <a
                href="/terms"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Terms
              </a>
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleConsent("dismissed")}
              aria-label="Dismiss cookie banner"
              className="shrink-0"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConsent("accepted")}
              className="font-mono text-xs"
            >
              Accept
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
