import { renderLlmsTxt } from "./llms-txt"

// /llms.txt (plan §4.6): a static text route rendered at build time from
// site.ts and layers.ts (replaces the hand-written public/llms.txt).
export const dynamic = "force-static"

export function GET(): Response {
  return new Response(renderLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
