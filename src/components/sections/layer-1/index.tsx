import { LayerTitle } from "@/components/common/layer-header"
import { LayerSection } from "@/components/common/layer-section"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { TerminalChrome } from "@/components/common/terminal-chrome"
import { BootLog } from "@/components/sections/layer-1/boot-log"
import { BootProvider, DevicePicker } from "@/components/sections/layer-1/boot-state"
import { DeviceFacts } from "@/components/sections/layer-1/device-facts"
import { LayerStrip } from "@/components/sections/layer-1/layer-strip"
import { PaneBar } from "@/components/sections/layer-1/pane-bar"
import { SupportMark } from "@/components/sections/layer-1/support-mark"
import { SUPPORT_LABELS, type LayerSupport } from "@/lib/devices"
import { getLayer } from "@/lib/layers"

const LEGEND: readonly LayerSupport[] = ["runs", "partly", "none"]

/**
 * Layer 1 · Bootstrap: "Boot Terminal with Device Picker" (plan §5 L1, V3 remix,
 * terminal takeover). The whole section is one window: the page-level device
 * chips on top, the typed install log (or the old phone's USB-C diorama) on the
 * left, V3's title and "> label: value" facts on the right, and the ten-cell
 * layer strip at the bottom. Copy, specs and the legend render here on the
 * server; only the picker, the log, the device facts and the strip are client leaves.
 */
export function Layer1() {
  const layer = getLayer(1)

  return (
    <LayerSection n={1} variant="custom">
      {/* V3: ghost number + rule above the window. The H2 lives in the window's right column. */}
      <div aria-hidden="true" className="mb-6 flex items-end gap-6">
        <span className="font-pixel-line text-7xl leading-none font-bold text-foreground/[0.08] md:text-9xl">
          {layer.ghost}
        </span>
        <div className="flex-1 pb-2">
          <div className="h-px bg-border" />
        </div>
      </div>

      <Panel>
        <TerminalChrome title="install@111-network" subtitle="simulation" right={<SimulationChip />} />

        <BootProvider>
          {/* DOM (= mobile) order: title, picker, description, facts, log, specs, strip.
              The picker comes right after the H2 so the chips are on screen when the
              "following: … · change" links on L3, L8 and L9 land on #layer-1. From lg the
              picker spans the top, the log sits left, and the right column stacks
              title + description (one block), specs, then facts. */}
          {/* grid-cols-1 = minmax(0, 1fr): without it the implicit auto column grows to the
              log's widest line (the nowrap dot leader) and the page scrolls sideways on phones. */}
          <div className="grid grid-cols-1 lg:grid-cols-5 lg:grid-rows-[auto_auto_auto_auto_1fr_auto]">
            <div className="border-b border-border lg:col-span-2 lg:col-start-4 lg:row-start-2 lg:border-b-0 lg:border-l">
              <PaneBar>{layer.subtitle}</PaneBar>
              <div className="px-4 pt-4 pb-4 sm:px-6 sm:pt-6 lg:pb-0">
                <LayerTitle n={1} className="mt-0 text-foreground md:text-4xl" />
              </div>
            </div>

            <div className="border-b border-border px-4 py-4 sm:px-6 lg:col-span-5 lg:col-start-1 lg:row-start-1">
              <p className="mb-3 font-mono text-[10px] tracking-wider text-muted-foreground">
                <span aria-hidden="true" className="uppercase tracking-widest">
                  device
                </span>
                <span aria-hidden="true"> · </span>
                pick one; the sections further down follow it too
              </p>
              <DevicePicker />
            </div>

            <div className="border-b border-border px-4 py-4 sm:px-6 sm:pb-6 lg:col-span-2 lg:col-start-4 lg:row-start-3 lg:border-l lg:pt-3">
              <p className="max-w-prose font-mono text-xs leading-relaxed text-muted-foreground md:text-sm">
                {layer.description}
              </p>
            </div>

            <div className="border-b border-border lg:col-span-2 lg:col-start-4 lg:row-start-5 lg:border-b-0 lg:border-l">
              <PaneBar>what the installer works out</PaneBar>
              <DeviceFacts />
            </div>

            <div className="border-b border-border lg:col-span-3 lg:col-start-1 lg:row-span-4 lg:row-start-2 lg:border-b-0">
              <BootLog />
            </div>

            <div className="border-b border-border lg:col-span-2 lg:col-start-4 lg:row-start-4 lg:border-l">
              <dl className="flex flex-col gap-3 p-4 font-mono text-xs leading-relaxed sm:px-6">
                {layer.specs.map((spec) => (
                  <div key={spec.label}>
                    <dt className="inline text-muted-foreground">
                      <span aria-hidden="true">{"> "}</span>
                      {spec.label}:{" "}
                    </dt>
                    <dd className="inline font-bold text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:col-span-5 lg:col-start-1 lg:row-start-6 lg:border-t lg:border-border">
              <PaneBar marker>layers this device runs</PaneBar>
              <div className="p-4 sm:px-6">
                <LayerStrip />
              </div>
              <ul
                aria-label="Legend"
                className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground sm:px-6"
              >
                {LEGEND.map((support) => (
                  <li key={support} className="flex items-center gap-2">
                    <SupportMark support={support} />
                    {SUPPORT_LABELS[support]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </BootProvider>
      </Panel>
    </LayerSection>
  )
}
