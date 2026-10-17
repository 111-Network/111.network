import { TICKER_DURATION_S, TICKER_ITEMS, TICKER_LABEL, TICKER_SEPARATOR } from "./ticker-items"
import { TickerMarquee } from "./ticker-marquee"

/** One copy of the list for the marquee; every item is followed by the separator so two copies loop seamlessly. */
function MarqueeCopy({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      aria-label={duplicate ? undefined : TICKER_LABEL}
      aria-hidden={duplicate ? true : undefined}
      className="flex shrink-0 items-center"
    >
      {TICKER_ITEMS.map((item) => (
        <li key={item} className="flex shrink-0 items-center whitespace-nowrap font-mono text-xs text-muted-foreground">
          {item}
          <span aria-hidden="true" className="px-8 text-border">
            {TICKER_SEPARATOR}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Frame ticker under the hero (plan §4.3, §2.1 V2). Server-rendered copy; the
 * only client part is the marquee wrapper that pauses offscreen. Under
 * reduced motion the marquee is hidden and a static wrapped list shows
 * instead (pure CSS, so nothing flashes or mismatches on hydration).
 */
export function Ticker() {
  return (
    <div className="flex border-y border-border">
      <TickerMarquee durationS={TICKER_DURATION_S} className="motion-reduce:hidden">
        <MarqueeCopy />
        <MarqueeCopy duplicate />
      </TickerMarquee>

      <ul
        aria-label={TICKER_LABEL}
        className="mx-auto hidden max-w-7xl flex-wrap items-center justify-center gap-y-2 px-4 py-3 motion-reduce:flex lg:px-8"
      >
        {TICKER_ITEMS.map((item, i) => (
          <li key={item} className="flex items-center font-mono text-xs text-muted-foreground">
            {item}
            {i < TICKER_ITEMS.length - 1 ? (
              <span aria-hidden="true" className="px-3 text-border">
                {TICKER_SEPARATOR}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
