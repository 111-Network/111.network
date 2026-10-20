# Website redesign plan: Layers 0–9 + interactive demo

Status: **draft for owner review** · 2026-10-17 · rev 2 (after a 3-judge adversarial review) · source of truth for the logic: `os/README.md`
Inputs:
- two research workflows: per-layer concepts + critic, and dashboard inventory + demo design + critic;
- an adversarial plan review (fidelity / engineering / design);
- the owner decisions below.

---

## 1. Owner decisions (locked for this plan)

| # | Decision |
|---|---|
| W1 | **Logic, not tech.** The page explains the final layer logic from `os/README.md`. No tech-stack names anywhere: no projects, protocols, algorithms, models, runtimes, libraries or file formats. Generic words are fine: long-range radio, Wi-Fi, Bluetooth, local model, keypair, signature, encrypted store. |
| W2 | **One naming exception:** a single example line in the Layer 6 section, "Works with existing mesh networks and stacks like Meshtastic, MeshCore and Reticulum (examples; the real list lives in the Knowledge Layer)". All three are in `os/0-knowledge/projects/`. Nowhere else, never in `/demo`. |
| W3 | **Depth = README + key details.** README logic plus the few locked-spec details that make a demo meaningful: the four delivery states (queued / sent / relayed / delivered), the order in which a full store frees space, "known keys are pinned", "works with no backup". Recovery edge cases (lost phrase, identity/label collision) stay in the docs. |
| W4 | **No built/planned marks.** All ten layers are shown as intended. The only disclaimer is a `SIMULATION` / `DEMO` chip on simulated components. |
| W5 | **Device categories in plain words only:** old phone, laptop, radio relay, small box with a radio, home server, PC with a graphics card. No category names or codes (no "2B", no "AI-native terminal"). The role nouns *relay, bridge, hub, gateway* appear in prose, the way `os/README.md` uses them. |
| W6 | **License wording untouched.** Every existing "Open Source" string stays: the ticker item, the footer chip, the Terms lines, the README badge, the keyword, and the terminal's `License: Open Source` line (moved into `version`, verbatim). Nothing new about licensing is added. The owner is studying the topic; see §12. |
| W7 | **Analytics kept, copy precise.** Node copy says "no telemetry", which is true of the node. The Terms privacy section gains one accurate sentence: the website counts anonymous page views through its host (cookieless). The cookie banner stays. |
| W8 | **GitHub link → org page** `https://github.com/111-Network` (verified 200). |
| W9 | **`V.0.0.6 Experimental`**, rendered from one `SITE_VERSION` constant everywhere (hero, nav popover, terminal, `llms.txt`). The badge itself blinks to catch attention. |
| W10 | **Install command copyable, with the experimental framing** (owner: "mix of live copyable and shown with pre-release tag"): `curl -fsSL https://install.111.network/install.sh \| sh` for this machine and `… \| sh -s -- --phone` for an attached phone over USB-C. Note: run as your normal user, never sudo. **As of 2026-10-17 `install.111.network` does not resolve** (verified), so the card reads an `INSTALL_LIVE` flag (§3.3). |
| W11 | **Hero:** title unchanged. Subtitle = the minimal edit (§3.1). |
| W12 | **Extras:** the updated interactive terminal (finale) + a new `/demo` route + a demo CTA in **both** places: a small link/teaser in the Layer 4 section and a big CTA band after Layer 9. No device matrix, no principles section, no build-vs-adopt section. |
| W13 | **Layer 9 human gate = both, in sequence.** The node's owner approves applying the fix locally, and the change goes upstream as a pull request for the maintainers. When a proven fix reaches another node through a gateway, that node's **own local AI re-checks it in its own sandbox**, then **its owner** approves. |
| W14 | **`/demo` is an interactive dashboard, not an animated tour.** No onboarding popups, spotlight, narration, autoplay story or transport bar; it opens straight into the dashboard. Motion happens only in response to a click, a streaming chat reply, or an incoming demo event (each incoming demo message carries a small "demo message" note). Scope = focused. |

---

## 2. Page map

```
/            nav (0–9 layer buttons) ─ hero ─ ticker ─ L0 … L9 ─ terminal ─ DEMO CTA band ─ footer   (P5: the band moved to the very end, owner 2026-10-17)
/demo        site bar ─ "DEMO · sample data · nothing leaves this page" strip ─ interactive dashboard
/terms       unchanged except one analytics sentence (W7) + its own canonical
```

- Section ids are `layer-0` … `layer-9`, with ghost numbers `00` … `09`, so the number on screen equals the layer number.
- Every layer section ends with a `<LayerFooter>`: `see it in the dashboard → /demo#/<view>` (map in §6.6).
- One data file, `src/lib/layers.ts`, holds per layer: number, slug, nav label, title, subtitle, description, 4 specs and the demo deep link. It drives the nav rail, the mobile sheet, section headers and footers, the CTA band cells and the terminal's `layers` / `layer <n>` / `goto <n>`.
- **Follow one device (through-line):** one shared `<DeviceChips>` choice at page level (store + `?device=`). Picking `old phone` in L1 preselects L3, L8, L9 and the terminal's `devices` output. Those headers show a quiet line "following: old phone · change". This carries the README's strongest idea, *each device runs only the layers it can*, from 0 to 9.

### 2.1 Visual reuse map (every existing visual has one home or is retired)

| Existing visual | Goes to | What changes |
|---|---|---|
| V1 hero ASCII field + scanline | Hero background | Moves into its own component that writes `pre.textContent` via a ref (no React state per frame); pauses offscreen and when the tab is hidden. |
| V1 hero terminal box | Hero | Becomes the install terminal: the command is the input, the typed install run is the output (§3.3). |
| V2 ticker | Frame, after hero | New items (§4.3); pauses offscreen; a static wrapped list under reduced motion. |
| V3 BootTerminal (section-protocol) | **L1 Bootstrap** | An install run per device; the bottom pane becomes the 10-cell layer strip. |
| V4 MeshBento (section-mesh) | **L7 Relay & Presence** | Fake metrics and the decorative LIVE square deleted; heartbeats + gateways. |
| V5 ChainInspector (section-ledger) | **Retired** | Its arrow-joined block row *is* the blockchain picture the final logic rejects. Only the "selected card + inspector" mechanic is rebuilt inside L0. |
| V6 TabbedPipelineIDE (section-messages) | **L9 Self-Healing** | Tabs become TALK / CHANGES / CHECKS of a pull request. |
| V7 Oscilloscope (section-offline) | **L6 Transport** | The seek readout: noise while seeking, clean carrier once joined, then a static frame. |
| V7 StepPipeline (section-offline) | **L9 Self-Healing** | The W13 **gate rail**; its human stations stay hollow until clicked. |
| V8 BlueprintSelector (section-transport) | **L6 Transport** | The gates become a priority encoder over the ordered preferred list. |
| V9 ProfilerLanes (section-identity) | **L7 Relay & Presence** | Heartbeat-over-time lanes, scripted instead of random. |
| V9 CapacityMeter (section-identity) | **L8 Storage** | A user-driven capacity gauge; "/Unlimited" removed. |
| V10 LayerCake (section-bridges) | **L6 Transport** (closer) | "Thin Bridge": two tall networks, one thin bridge band. |
| V11 PseudoTerminal | Frame finale | Commands rewritten around the layers (§4.4). |
| V12 Footer | Frame | Tech chips removed (§4.5). |
| SpecTable (unused) | L0 note record | Unchanged primitive. |
| AsciiCanvas (unused) | **L1** phone diorama | Laptop ═ USB-C ═ phone drawing. |
| MiniTerminal (unused) | Retired | L0 is a cabinet, not a terminal. |
| `sections-data.ts`, `domain-section.tsx`, `src/styles/globals.css` (stale duplicate) | **Retired** in the cleanup task at the end of P3 | Replaced by `layers.ts`; the junk `commands` arrays go with it. |

Each of the ten sections keeps a **distinct visual genre**, the old site's charm:

| L | Genre | Base |
|---|---|---|
| 0 | card-catalog cabinet with ruled index cards | new |
| 1 | terminal takeover | V3 |
| 2 | printed ID card with a seal | new |
| 3 | hardware patch bay / rack | new |
| 4 | faux browser window (live dashboard) | demo shell |
| 5 | courier tracking receipt | new |
| 6 | blueprint schematic + exploded cross-section | V8 + V7 scope + V10 |
| 7 | control-room map + profiler lanes | V4 + V9 lanes |
| 8 | disk-usage / defrag map | new + V9 meter |
| 9 | code-review / forge page + gate rail | V6 + V7 stepper |

**Chrome rule:** terminal chrome (3 dots + `~` title) appears only in the hero box, L1, panels inside the L4 window and `/demo`, and the finale terminal.

---

## 3. Hero

The owner called the hero clear: it gets the install command, the GitHub link and the new subtitle, and nothing else heavy.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ V.0.0.6 Experimental ]   (pill inverts on/off every 2 s, steps(1))     │
│                                                                          │
│ Free, Secure                                                             │
│ Communication for Everyone                                               │
│                                                                          │
│ A message network that runs on people, not servers. Any device becomes  │
│ a node, joins the mesh networks that already exist, and a local AI keeps │
│ it running. No company. No government. Just you and the world.           │
│                                                                          │
│ [ Explore the layers -> ]  [ GitHub ]                                    │
│                                                                          │
│ ┌─■□□ install ~ 111-network ──────────────────────────── SIMULATION ┐    │
│ │ [ THIS MACHINE ] [ ATTACHED PHONE ]                    [ COPY ]   │    │
│ │ $ curl -fsSL https://install.111.network/install.sh | sh          │    │
│ │ > reading hardware ............................ [ok]              │    │
│ │ > this laptop can run a small AI locally                          │    │
│ │ > identity made on this device ................ [ok]              │    │
│ │ > installing only what it needs ............... [ok]              │    │
│ │ > node online · dashboard ready_                                  │    │
│ │ Run as your normal user. Never put sudo in front.                 │    │
│ │ RE-RUN SAFE · NO TELEMETRY · READ IT FIRST ->                     │    │
│ └───────────────────────────────────────────────────────────────────┘    │
│                        scroll · start at layer 0                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Subtitle (W11)
> A message network that runs on people, not servers. Any device becomes a node, joins the mesh networks that already exist, and a local AI keeps it running. No company. No government. Just you and the world.

The same wording goes into `SITE_DESCRIPTION` (`site.ts`), `manifest.ts`, the OG/Twitter descriptions and the OG alt text.

### 3.2 Badge (W9)
The existing pill shows `V.0.0.6 Experimental` from `SITE_VERSION`. It **inverts** (`border-border text-muted-foreground` ↔ `bg-foreground text-background`) on a 2 s `steps(1)` cadence: no fade, and no blinking square, because a blinking 2 px square would read as a status dot. Under reduced motion it is static and inverted. It sits directly above the title, as today.

### 3.3 Install terminal (W10)
- **One terminal**: the existing hero box absorbs the install card. Two tabs (radiogroup via `<ChipGroup>`): `THIS MACHINE` / `ATTACHED PHONE`. The command line is the input. The output below it is a typed install run in plain words. Switching a tab, or pressing `COPY`, retypes the output, so the copy action produces the lesson.
- The phone tab's output: "plug the phone in over USB-C" → "the installer shows each tap only you can make" → "phone online · dashboard ready".
- `COPY` copies the exact string and shows `COPIED` for 2 s, with an `aria-live` announcement. If the clipboard is unavailable it selects the text instead. Clicking the command line also copies.
- The command wraps at 375 px (`whitespace-pre-wrap break-all`); the copied string is never altered.
- Platform copy stays plain ("this machine" / "an attached phone"); no OS names (W1).
- Constants in `site.ts`: `INSTALL_COMMANDS = { host, phone }`, `INSTALL_LIVE`, `INSTALL_SCRIPT_SOURCE`. Only the hero, the nav popover and the terminal print the command string; everything else links to `#install`.
- **While `INSTALL_LIVE` is false** (it is today): the command stays visible and copyable, and one extra line reads "installer publishes with the first release". `READ IT FIRST ->` points at the shim source in the GitHub repo instead of the dead host. When the domain serves the script, flip the flag; `pnpm check` then HEADs the URL and fails if it does not answer 200.
- No version string inside the terminal. No HEAL tab (L9 owns that story).

### 3.4 CTAs
`Explore the layers ->` targets `#layer-0`, which also fixes the dead `#kernel-systems` anchor. `GitHub` goes to the org (W8). The demo is reached from the nav, the L4 section and the finale band, as the owner placed it.

### 3.5 Cooler hero idea: your call, not in P1
The hero's random ASCII noise could become a quiet **click-to-hop node field** (S–M):
- About 12 seeded `■` node glyphs sit on a fixed layout over a dim `·` field (only the field regenerates).
- A click anywhere sends one packet glyph hop by hop along a precomputed path toward the top edge (the "wider world"), lighting each node for one frame.
- No pointer tracking, and no loop while idle; under reduced motion it is a static frame.

It reuses the current string-frame renderer. The alternative is no hero extra.

---

## 4. Frame

### 4.1 Nav
> **As built (P5, owner 2026-10-17):** the 28 px square rail was replaced by the old header's text style: one button per layer, dim number + uppercase label, hover inverted, active solid. Every label shows from 1280 px (10 px type; 12 px from 1536 px, where the header widens to 96rem); below 1280 px the numbers show and only the active layer adds its label. The xl readout is gone. DEMO · TERMINAL · INSTALL · GitHub stay on the right.

- **Desktop:** `> 111.network` · a rail of ten 28 px square anchors `0`…`9` (tooltip = layer name; `aria-current` on the active one; at xl a readout "L3 · LOCAL INTELLIGENCE") · `DEMO` (behind a `DEMO_READY` flag until P5) · `TERMINAL` · an inverted `INSTALL` button that opens a popover with the same install terminal (Radix popover is already a dependency; force zero radius) · a GitHub icon (org).
- A 2 px, ten-segment depth strip on the header's bottom edge fills with scroll progress.
- **Mobile:** logo · `L3/9` readout · `INSTALL` (links to `#install`) · `MENU`. The menu is a full-height, focus-trapped sheet with a 2×5 grid of layer tiles, then DEMO / TERMINAL.
- **Fixes:** real anchors with `scroll-margin-top`; an IntersectionObserver scroll-spy instead of `offsetTop` + `setTimeout(300)`; `history.replaceState` hashes so every layer is deep-linkable; `behavior: auto` under reduced motion.
- Short nav labels: KNOWLEDGE, BOOTSTRAP, IDENTITY, INTELLIGENCE, DASHBOARD, MESSAGING, TRANSPORT, RELAY, STORAGE, SELF-HEALING.

### 4.2 Section header and footer (shared)
`<LayerHeader>` renders the ghost number `0N`, the subtitle label, the pixel H2 and the description. `<LayerFooter>` renders the demo deep link from `layers.ts`, but only once `DEMO_READY` is true, so no link points at a missing `/demo` during P1–P4. A section may restyle the header to keep its genre (an inverted band in L7, a stamp box in L6).

### 4.3 Ticker
New items: Offline First /// Any Device Is A Node /// One Command /// Keys Made On Your Device /// No Phone Number. No Email. /// Local AI /// Local Dashboard /// End-To-End Encrypted /// Store & Forward /// Delivery Is Non-Negotiable /// No Rate Limits /// No Forced Expiry /// Existing Networks Are Allies /// Radio / Wi-Fi / Bluetooth /// Heartbeats /// Gateways To The World /// Self-Healing /// Humans Have The Final Say /// Adopt, Don't Reinvent /// Runs On People /// Open Source (kept, W6).

Removed because they contradict the logic: Satellite; Anonymous (the identity is a stable keypair, so it is pseudonymous); Decentralized (replaced by "Runs On People").

### 4.4 Terminal (finale)
- Welcome line: `111 Network demo terminal. Type help. Nothing here touches a network.`
- Commands:
  - `help`
  - `layers`
  - `layer <n>`: prints the summary plus `-> #layer-n`
  - `goto <n>` (alias `open`): scrolls there
  - `devices`: plain words; follows the page-level device
  - `install`, `phone`
  - `sudo`: prints "never put sudo in front"
  - `whoami`: a grouped label such as `k7m2-qx6d-4a` (base32 alphabet a–z, 2–7 only), never hex
  - `heal`: a simulation with the W13 gate sequence
  - `policy`: rate limits / forced expiry / content policy: none · pruning: by capacity only
  - `demo`, `uninstall`, `about`, `clear`
  - `version`: `V.0.0.6 Experimental`, keeping the line `License:    Open Source` verbatim (W6)
  - `ascii`: the 111 block logo
- Deleted: `stack` (its `Protocol: 111 Mesh v0.0.5` line is a fake protocol and version; its license line moves to `version`), `nodes`, `inspect`, and the invented tally in `status`.
- A11y: `role="region"` (not `application`), polite announcements, and typing only in response to input.

### 4.5 Footer
- Keep the ASCII 111 logo, the tagline, "Built by people, not providers.", back-to-top and the Terms link. GitHub goes to the org.
- Replace the **Built With** chips (Next.js, React, TypeScript, Tailwind are tech stack, W1) with an **Explore** column: Layers · Demo · Terminal · Install (→ `#install`). The existing "Open Source" chip stays as a single badge (W6).

### 4.6 Metadata and stale copy
- `layout.tsx` keywords: drop "distributed ledger" and "satellite messaging"; add "offline mesh", "self-healing network" and "local AI". "open source communication" stays (W6).
- `public/llms.txt`: rewritten around the ten layers, `V.0.0.6 Experimental` and /demo.
- `manifest.ts`, OG alt text and the `site.ts` description: use the new subtitle.
- `sitemap.ts`: add `/demo` in P5.
- **Terms:** add one sentence about cookieless page-view analytics (W7). Add its own `alternates.canonical: "/terms"` and `openGraph.url`; today it inherits `/`. The "open-source" lines stay (W6). **The owner reviews the analytics sentence before shipping.**
- `docs/DESIGN.md`: add the new component patterns, the chrome rule and the motion rule; change the brand line "global mesh messaging network" to the hero subtitle's framing.
- Out of scope unless asked: the repo `README.md` manifesto (daily shouts, world map, email/phone identity) is stale.

---

## 5. Layer sections

Each section lists the logic it must land, its copy, its component and must-avoid notes. Simulated components carry a `SIMULATION` chip (W4). The ASCII below is a wireframe only; build real DOM.

### L0 · Knowledge: *Archive Drawers* (new · card-catalog cabinet · M)
**Logic:** the foundation every layer reads from. Many small notes, one topic each, linked and indexed, and graded by evidence (candidate / testing / proven; reputation alone reaches testing at most). It drives "adopt before build". Its first reader is the agent. Hubs hold a full copy; light devices borrow.

**Copy:** *Knowledge · What every layer reads.* "The foundation every other layer reads from. A curated library of small notes on existing projects, hardware and protocols, each graded by the evidence behind it. The local agent reasons from it, the installer pulls recipes from it, and it settles one question again and again: if a solid project already exists, use it."
Specs: Format **Small notes, one topic each** · Grades **Candidate, Testing, Proven** · Reader **Agent first, human second** · Rule **Adopt before build**.

**Component.** No terminal chrome:
- **Drawers:** six fronts (tall `border border-border` pulls, an inverted label plate, an `h-1 w-6 bg-foreground` handle; the open drawer inverts): PROJECTS, DEVICES, RECIPES, PROTOCOLS, LOCAL MODELS, CONCEPTS.
- **Cards:** clicking a drawer deals out ruled index cards (`divide-y` lines, typed title, grade mark top-right). Clicking a card opens its note (SpecTable record): What it is · Use when · Do NOT use when · Evidence (alternatives compared / bench test / field log, checked only where earned).
- **`HUMAN │ AGENT` toggle:** swaps the full note for the agent's one-line index view.
- **Search slot:** prints a dashed-border **call slip** whole: `READ INDEX → SEARCH "radio" → OPEN ONE → STOP`.

Rules:
- **Three grades only, in grayscale:** dashed outline = candidate, half fill = testing, solid inverted = proven. No "hold", no hatching (gradients are banned), never status dots.
- Card names are role names ("Long-range mesh firmware", "Phone-first mesh stack"), never product names.
- An honest sample: most cards are candidate, a few testing, and one proven card is labelled `example`. Concepts carry no grade.

### L1 · Bootstrap: *Boot Terminal with Device Picker* (V3 remix · terminal takeover · M)
**Logic:** one command or one tap, on a fresh or used device. It detects the hardware, works out what the device can be, creates the identity and installs only what fits, with no configuration. A phone is provisioned over USB-C from a computer. The bootstrapper is the one custom piece, and it is replaceable.

**Copy:** *Bootstrap · One command, one node.* "One command turns a fresh or already-used machine into a node. It reads the hardware, works out what the device can be, creates its identity and installs only what fits. A phone is set up over USB-C from a computer, with a few taps only a human can make. Nothing to configure, and re-running is safe."
Specs: Entry point **One command or one tap** · Setup **None required** · Installs **Only what the device needs** · Telemetry **None**.

**Component:** the V3 window (`install@111-network ~ simulation`).
- **Device chips:** the shared `<DeviceChips>` (W5): `old phone` · `laptop` · `small box with a radio` · `home server` · `PC with a graphics card` · `radio relay`. A click retypes the log for that device at 150 ms per line; a `REPLAY` button reruns it.
- **Right column:** keeps V3's title and `> label: value` specs.
- **Bottom pane:** the ten-cell strip (runs / partly, via a nearby node / not run), transcribed from the README table through an internal device→category map that is never shown.

Chip behaviour:
- `radio relay`: the log reads "set up once from a nearby computer", which is true to the README table and the identity spec.
- `old phone`: the log is replaced by the AsciiCanvas diorama `LAPTOP ══ USB-C ══ PHONE`. The visitor presses `TAP` for each step only a human can do, and the dot goes NOT SET → STARTING (grey blink) → LIVE.
- `small box with a radio`: the facts show "radio + Wi-Fi that can host a hotspot (or ethernet)" before the log says "it also bridges radio and Wi-Fi" (the bootstrap rule).

Rules:
- No hardware numbers (no core counts, no GB).
- The gateway role is never "recorded at install". It is granted by connectivity and shown only as "can become a gateway while it has internet". "Also does the job of …" lines are computed from the attached parts.

### L2 · Identity: *Issued By Nobody* (new · printed ID card + seal · M)
**Logic:** created automatically at setup. Cryptographic and wallet-style, it authenticates the node and vouches for its traffic. Offline-first, with no phone number, email or central authority. The same keypair can anchor the node globally when it acts as a gateway. A backup is optional, and everything works without one.

**Copy:** *Identity · Your keys, made here.* "Every node makes its own cryptographic identity when it is set up. No sign-up, no phone number, no email, no authority to ask. Others know the node by its public half; the private half never leaves it. Back it up when you care to. Until then, everything just works."
Specs: Created **At setup, no sign-up** · Sign-up **None: no phone, no email** · Backup **Optional** · Impostors **Known keys are pinned, never swapped** (W3).

**Component:**
- `1 INSTALL`: the card prints out of a slot. The label decodes from noise; the secret half is a blocked bar marked "stays here"; ISSUED BY *nobody*; PHONE / EMAIL / REGISTRY are struck through as "not needed".
- `2 ANNOUNCE`: a nearby peer checks the card: seal VOUCHED, verdict ACCEPTED, key pinned.
- `3 TAMPER`: edit the announcement text (a toy checksum labelled demo) → seal BROKEN with a one-shot `glitch` keyframe (`animate-glitch-once`, 300 ms, finite, off under reduced motion) → REJECTED.
- `4 SWAP KEY`: the same, already known node re-announces with a different key → REJECTED: "pinned keys never change; first key seen wins".

Rules:
- Show only the grouped label, in the base32 alphabet a–z, 2–7 (e.g. `k7m2-qx6d-4a`), never a hex address. The label is display-only; the demo never treats it as proof of identity.
- The seal is a small inverted square + word (the border-2 stamp box is L6's signature).
- Wording: "vouches for the node". No "signs everything" slogan. Drop "anonymous" site-wide.
- The status dot in the chrome goes NOT SET → LIVE; verdicts are words, not red dots.

### L3 · Local Intelligence: *Patch Bay: Borrow a Brain* (new · rack / switchboard · M)
**Logic:** a local model is the primary interface and the health monitor. It runs where capacity allows **and** the user agrees. Lighter devices route agent requests to a nearby hub over the local mesh. It diagnoses problems, tests fixes in a sandbox and prepares changes for human review. The model itself can grow over time.

**Copy:** *Local Intelligence · Your node's own mind.* "A local model runs on the node as its agent: your main way to talk to the system and its constant health monitor. It runs where the device can handle it and you agree. Lighter devices borrow a nearby hub's model over the local mesh. No cloud in the loop. It can propose fixes; a human decides."
Specs: Runs when **The device can and you agree** · Light devices **Borrow a nearby hub** · Cloud **None in the loop** · Final say **A human, always**.

**Component:** a rack.
- **Hardware:** a device panel and a hub panel, each with a row of hollow jacks (`h-3 w-3 border border-foreground`), inverted tape-strip labels and four `h-1 w-1` screw dots.
- **The cable** is a 2 px `bg-foreground` path. It exists only while consent is on and a hub is chosen.
- **Device behaviour (follows `<DeviceChips>`):**
  - radio relay: no agent
  - old phone: borrows
  - laptop: has its own brain
  - small box with a radio: borrows
  - home server: small brain here, heavy work asks a bigger hub
  - PC with a graphics card: big brain, lends it
- **Consent switch:** off = NOT SET, "you decide".
- **`pull the plug`:** red ERROR "hub unreachable", at once, no hang.
- **A question** sends one short inverted segment along the cable and back; then the answer prints whole.

Rules:
- Hubs are "neighbours", never "servers".
- No tool names or counts, no model sizes.
- Offload goes over the local mesh / Wi-Fi to a nearby hub, never over a long-range radio relay.

### L4 · Interface & Dashboard: *Node Window teaser* (demo shell · faux browser · S once the demo exists)
**Logic:** a local, offline-first, web-based dashboard served by the node and opened in any browser on the laptop or phone. It shows chat, node and mesh status and agent notifications, and it gives the agent a stable function surface. A nearby hub serves it to devices too small to host it. It follows the design system.

**Copy:** *Interface & Dashboard · Your node's face.* "Every node serves its own dashboard. Open it in any browser on your laptop or phone: no account, no cloud, no internet. It shows what is running, who is near, and lets you talk to the local agent. Too small to host it? A nearby hub serves it for you."
Specs: Served by **The node itself, or a nearby hub** · Opens in **Any browser** · Works **Fully offline** · One tap away **Overview and Agent**.

**Component:** a compact faux-browser window (`max-w-4xl`) that renders the **real `/demo` shell** with its own store (`router: "memory"`, `layout: "rail"`; the teaser never touches `location.hash`).
- Clicking the rail switches between Overview, Agent and Nearby. Clicking a NOT SET service shows "Set up with the agent". Nothing autoplays.
- It is loaded with `next/dynamic` (`ssr: false`) inside a client wrapper only when the section enters the viewport, behind a same-height static placeholder.
- Under it sits the small CTA (W12): `Open the full dashboard demo ->` (`/demo#/overview`).
- This is the only home section with browser chrome.

### L5 · Messaging & Data: *Courier Receipt* (new · courier tracking receipt · M)
**Logic:** end-to-end encrypted, signed payloads, with reliable delivery first and latency second. Store-and-forward across mixed transports, stored encrypted on the device. No rate limits, no forced expiry, no governance rules; pruning is by capacity. The same fabric carries human messages, agent operations, knowledge sync, updates and validated patches.

**Copy:** *Messaging & Data · Delivery first, speed second.* "Every message is sealed end to end, signed and kept encrypted on your device. It hops through whatever links exist and counts as delivered only when the recipient's node confirms. No rate limits, no expiry, no rules: only what the link can physically carry. Messages are just the first cargo."
Specs: Delivery **Reliable first, speed second** · Privacy **Sealed and signed, end to end** · Limits **Physics and capacity only** · Carries **One fabric, five kinds of traffic**.

**Component:** a vertical courier tracking receipt. There is no 2D map; the map genre belongs to L7.
- **Stations:** `YOU (laptop)` → `HUB (stays on, holds a sealed copy)` → `RELAY (repeats it)` → `THEIR BRIDGE (a small box with a radio; passes it to Wi-Fi)` → `THEM (their phone)`.
- **Controls:**
  - a sample message line with an `edit` affordance (no length limit)
  - `SEND`
  - three link toggles: Wi-Fi / Bluetooth / long-range radio
  - one `WAIT A YEAR` button: advances "waiting for: 1 year" while `expiry: none` stays lit and the state does not change
- **States (W3), shortened from the dashboard's wording** (`/demo` uses it verbatim):
  - queued: "In your outbox: no path to them yet."
  - sent
  - relayed: "A mailbox node saved it and will hold it for them."
  - delivered: "Their node acknowledged it. Only that says delivered."

  The sender's copy dissolves only on DELIVERED.
- **Station expand lines:**
  - HUB: "sees: who it is for, a size · can read it: no · can change it: no"
  - RELAY / BRIDGE: "sees: a locator, a size, noise · can read it: no · can change it: no"
- **Below:** a static row of the five cargo kinds.

Purge from the old V6/V7 copy: NaCl, satellite uplink, 64 KB, 30 days, "Best Effort", "encrypted at every hop", "100 m – 10 km".

### L6 · Transport & Bridge: *Priority Seek Board* + *Thin Bridge* (V8 + V7 scope + V10 · L)
**Logic:** existing meshes are pure transport (and knowledge sources). A node keeps a short, ordered preferred list curated in the Knowledge Layer and joins in sequence: when it finds a network it starts heartbeats; when it finds none it falls back down the list. Bridges join physically incompatible channels (long-range radio ↔ Wi-Fi/Bluetooth). They stay thin, translate only the minimal common format, and never reimplement radio or routing.

**Copy:** *Transport & Bridge · Ride what already exists.* "111 does not reinvent the network. It rides the ones that already exist, as plain transport. A node tries a short, ordered list of preferred networks: when it finds one it joins and starts talking; when it finds none it moves down the list. Where radio and Wi-Fi cannot hear each other, a thin bridge passes only the bare minimum across." Then the W2 line.
Specs: Networks **Reused, never rebuilt** · Joining **Preferred list, in order** · Bridge **Bare minimum only** · Runs on **Bridge boxes and hubs**.

**Component A, seek board (V8):**
- Blueprint grid and a stamp-box title. Four example networks (Network A–D, labelled by generic medium) toggle "in range".
- One priority-encoder box `1 > 2 > 3 > 4, first hit wins` outputs `JOIN #n` or `NONE IN RANGE → messages wait on the device`.
- A seek ladder steps down the list: no signal / FOUND (inverted) / not tried.
- The V7 oscilloscope is the readout window: noise while seeking, a clean carrier when joined, a few heartbeat ticks (handing over to L7), then a static frame. Drop `shadowBlur`, size by devicePixelRatio, and run only during a seek.

**Component B, Thin Bridge (V10):**
- Three full-bleed `<button>` bands: a tall dim NETWORK A (long-range radio), a thin inverted BRIDGE, and a tall dim NETWORK B (Wi-Fi / Bluetooth).
- A sealed packet drops through. Only its outer wrapper swaps at the bridge; the payload never changes.
- Bridge detail: "does: carry the bare minimum across, buffer briefly · does not: reinvent the radio, reinvent routing, read the payload".
- Optional `MAKE THE BRIDGE DO MORE` → "REFUSED: bridges stay thin".

Rules:
- Delete: the Email/Satellite toggles, the random 32-tick strip, V10's L0–L4 labels, "ledger", the fake hex register and "Built into every device".
- If effort is tight, cut the Thin Bridge first.

### L7 · Relay & Presence: *Presence Map* + *Heartbeat Lanes* (V4 + V9 lanes · M)
**Logic:** nodes announce reachability through heartbeats. Nodes with internet advertise it and become gateways. Gateways sync the offline mesh with the global network through an asynchronous store-and-forward transport: intermittent gateways flush their queues when connectivity appears; permanent gateways stream broadcasts and encrypted messages in real time. A node that loses connectivity stays a pure mesh participant. Paths form dynamically.

**Copy:** *Relay & Presence · Always here, sometimes online.* "Every node keeps announcing that it is reachable. Any node that also has internet says so and becomes a gateway between the offline mesh and the wider world. Laptops and phones flush their queues whenever they get online; always-on gateways stream messages in live. Lose the connection and you simply stay a mesh node."
Specs: Presence **Continuous heartbeats** · Gateway **Earned by internet access** · Modes **Flush later or stream live** · Offline **Still a mesh node**.

**Component:** V4's inverted header band, labelled HEARTBEAT.
- **The map:** role-tagged square nodes (laptop, phone, relay, radio box, home server) under a "wider world" band.
- **Clicking a node** selects it; under the map a radiogroup row offers `NO INTERNET │ SOMETIMES │ ALWAYS` for that node. Clicking a relay shows "Relays only repeat. They cannot be gateways."
- **`SEND TO THE OUTSIDE`** sends a packet along "a path formed from what is reachable now". With no gateway online it waits at the last node (dashed WAITING) and resumes when one appears.
- **`move out of range`** silences a node; after a few beats it shows red ERROR "unreachable" and the links reroute.
- **Right column:** V9 lanes as heartbeat-over-time, scripted from the map state: sometimes = bursts, always = solid, out of range = gone (legend Heard / Quiet / Gone).

Rules:
- Delete the four fake metrics (7/8, 1,247, 6.2, 0.001%) and the decorative LIVE square.
- What the always-on gateway streams stays abstract: "messages and updates".
- Status dots only on dark cards (green on white fails contrast).
- Heartbeat rings start in view and stop offscreen.
- Below 640 px: the map is `aspect-[4/3]`, role labels sit under the squares and the lanes stack beneath.

### L8 · Storage & Shared State: *Store Map* (new + V9 meter · M)
**Logic:** each node keeps an encrypted local store, pruned by capacity, not by rules. Knowledge hubs host large shared datasets: offline encyclopedias, regional maps, software updates, troubleshooting patches. A lightweight append-only shared log *may* be used for the small subset of state that benefits from collective consistency. It is always adopted, never a custom consensus.

**Copy:** *Storage & Shared State · Pruned by capacity only.* "Every node keeps its own encrypted store. Nothing expires on a timer and no rule decides what you may keep: when space runs short, the node frees room by capacity alone. Big shared libraries such as offline maps and encyclopedias live on hubs. A small append-only log may hold the few things that need shared agreement."
Specs: Store **Encrypted on the device** · Pruning **By capacity only** · Hubs **Host the big libraries** · Shared log **Optional, append-only, small**.

**Component:** a grid of CSS square cells is one device's store.
- **Device size (follows `<DeviceChips>`):** radio relay (dim, empty: "forwards without keeping") · old phone (small) · laptop · home server (large).
- **Named batches:** each click pours one: `regional map` · `messages carried for others` · `your history` · `an update`. The pressure line is crossed on about the 4th click, so every prune has a visible cause. `FILL IT` runs the remaining pours as one click-driven sequence.
- **Free-space order (W3):**
  1. copies already handed over + public data you can fetch again
  2. superseded updates
  3. your own history, oldest first, after an "export offered" chip
  4. NEVER: anything not yet delivered, yours or carried for others

  When only those cells remain: red ERROR "Store full: new data refused".
- **Gauge and narration:** the V9 strip is the gauge row; an aria-live line narrates each prune.
- **Hub shelf** (maps · encyclopedias · updates · patches): solid inverted = hosted here (home server), dashed = ask a nearby hub. **The only dot in L8 is the store's red ERROR.**
- **Shared log:** one caption plus a tiny static glyph "A │ B: same entries, same order".

Rules: no sizes, thresholds or percentages; no idle auto-demo.

### L9 · Self-Healing & Evolution: *Pull Request Bench* + *Gate Rail* (V6 + V7 stepper · M–L)
**Logic:** the agent watches every layer the device runs. On a failure it diagnoses, generates a fix, validates it in a sandbox and packages it as a pull request. Humans are the final gate. Proven fixes spread through gateways, so one repair heals others. The same loop improves the agent, the Knowledge Layer and the bridging logic, always scoped to the layers the device runs.

**Copy:** *Self-Healing & Evolution · Fixes itself, asks first.* "The local agent watches the health of every layer your device runs. When something breaks it diagnoses the problem, builds a fix and tests it in a safe sandbox. You approve it on your node, and it goes upstream as a pull request for the maintainers. When a proven fix reaches another node, that node's own agent checks it again and its owner has the final say."
Specs: Validates **In a sandbox first** · Final say **People, always** · Shares **Proven fixes, via gateways** · Evolves **Agent, knowledge, bridges**.

**Component:**
- **Left:** a layer health board (L5–L8 dots) with `BREAK A LAYER` (three canned faults), over an agent log that renders whole.
- **Right:** V6's shell as a pull request:
  - tabs TALK / CHANGES / CHECKS
  - a plain-English diff: additions inverted, removals struck through and muted; no code, no numbers
  - a checks strip: applied in a sandbox · failure replayed: gone · other layers untouched
- **Gate rail (V7 stepper, W13):** `APPROVED HERE → PR UPSTREAM → MAINTAINERS → MERGED → VIA GATEWAY → NODE B RE-CHECKS → NODE B'S OWNER`.
  - Machine stations fill solid when reached.
  - The two human stations stay hollow (`border border-foreground`) until their button is clicked: `APPROVE ON THIS NODE` (enabled only after the checks pass) and `APPROVE AS NODE B'S OWNER`.
  - `MAINTAINERS → MERGED` is shown as a step the visitor advances with `next`, labelled "maintainers review upstream".
- **`TRY A BAD FIX`** stops at the sandbox: "fix rejected: nothing leaves the sandbox". `DISMISS` leaves the dot red.
- **Device toggle (follows `<DeviceChips>`):** on an old phone the build step reads "asked a nearby hub".
- **Evolution tiles** underneath: AGENT · KNOWLEDGE · BRIDGES.

Rules: no browser chrome (L4 owns it); TALK is a log, not a chat box.

---

## 6. `/demo`: interactive dashboard (W14)

### 6.1 What it is
A clickable copy of the node dashboard with sample data, covering the whole intended system: all ten layers, built or not. It opens straight onto **Overview** (`#/overview`). This is the one deliberate deviation from the real default route, recorded in the parity table. There is no intro modal, tour, spotlight, narration or autoplay. It mirrors the real UI's structure (`os/4-interface/ui/src`: shell, nav, views, primitives) and extends it with the intended surfaces of Layers 6–9. Inputs for those surfaces:
- `os/README.md`, the final word on logic
- `os/plan/cross-layer/devices.md` (the Layer 6 opener brief)
- `os/5-messaging/README.md`, for mailbox and announce roles

### 6.2 Frame
```
> 111.network                                        INSTALL   GitHub
DEMO · sample data · nothing leaves this page    (one 10px strip, no modal)
┌─────────────────┬────────────────────────────────────────────────────┐
│ Workshop laptop │ Overview                                     [1]   │
│ LAPTOP  ▪ LIVE  │────────────────────────────────────────────────────│
│ OVERVIEW        │ Your node is running. It is alone on the mesh      │
│ AGENT           │ right now: no nearby nodes heard.                  │
│ DEVICES         │ ┌ needs you ────────────────────────────────────┐  │
│ NEARBY          │ │ ▪ Long-range radio  NOT SET  [Set up with the │  │
│ MESSAGES        │ │                               agent]          │  │
│ ─ services ─    │ └───────────────────────────────────────────────┘  │
│ ▪ Local AI agent│ services  ▪ Local AI agent LIVE  ▪ Mesh link LIVE  │
│ ▪ Long-range rad│           ▪ Internet gateway NOT SET  …            │
│ ▸ SETTINGS      │                                                    │
│ [SIMPLE|ADV] << │                                                    │
└─────────────────┴────────────────────────────────────────────────────┘
```
- The page is `h-dvh flex flex-col`. The site bar (logo → home, `INSTALL` popover, GitHub org) and the DEMO strip are `shrink-0`; the shell root is `flex-1 min-h-0 @container`.
- The NodeChip badge reads in plain words (`LAPTOP`), never a category code.
- Status dots always carry labels. Destructive red is used where the real dashboard uses it (DESIGN.md allows it). Zero radius. No shadcn components.

### 6.3 Interaction model
- **Everything is clickable:** sidebar, views, tabs, disclosures, toggles, two-step confirms, SIMPLE│ADVANCED, rail collapse and the mobile drawer.
- **Motion only as a response:** state changes from a click (STARTING blink → LIVE), the agent's reply streaming word by word, a message's state glyph stepping queued → sent → relayed → delivered, and radar blips caused by a named event (§6.4).
- **Demo actions are contextual buttons tagged `DEMO`**, inside the view where they make sense; never a popup menu:
  - Devices and Bridge: `[DEMO] plug in a radio board`
  - Repairs: `[DEMO] simulate a fault`
  - Internet gateway: `[DEMO] connect to the internet`
  - Storage: `[DEMO] fetch the regional map`
  - Install & updates: `[DEMO] check for updates`
  - Nearby: `[DEMO] listen for a minute`
- **Incoming demo events** are few, and each has a cause. Ada replies a few seconds after you message her; one welcome message sits in Messages at the start. Every incoming item carries a small `demo message` note; agent replies carry `demo reply`.
- **Canned chat:**
  - An ordered intent table (regex → reply script), with starters: "check this node", "set up my radio", "why is the radio quiet?", "what can this device run?".
  - At most 4 tool lines per reply, using only real tool kinds in plain words: reading knowledge, checking health, reading logs, writing a proposal.
  - Unknown input gets "This is a demo, I only know a few questions. Try one of these:" plus the starters.
- **Proposals** use Accept / Dismiss with the real two-step pattern. Accept → STARTING → LIVE, and the header badge and "Needs you" update everywhere at once.

### 6.4 Views (focused v1)
| View | Layers | Built in reality | Notes |
|---|---|---|---|
| Overview (`/demo` opens here) | 4 + all | built | Verdict sentence (real rules: "connected to nearby nodes" comes from the transport being joined, not from hub enrollment), needs-you, services grid, nearby summary. |
| Agent (`#/`) | 3, 4 | built | Chat, streaming, tool lines, proposal cards, "Nothing is sent until you send it". |
| Devices + detail | 1, 6 | mixed | `[DEMO] plug in a radio board` → consent "allow once?" → identify → flash (typed device-name confirm, as in the real UI) → region pick. |
| Nearby | 5, 7 | mixed | RADAR │ LIST, no continuous sweep. Blips have named causes only: (1) after the radio board is flashed, the first heard nodes blip in one by one (`demo node`); (2) SEND in Messages → the hub blips when its custody ACK lands; (3) `[DEMO] connect to the internet` → the gateway overlay; (4) `[DEMO] listen for a minute` → one finite burst. Relay row: "forwards sealed traffic, cannot read it". |
| Messages + conversation | 5, 2 | building | The real state sentences verbatim (`views/messages/model.ts`), custody line, Ada/Bram, message requests accept/ignore, demo notes. |
| Knowledge base | 0 | built | Index by drawer, note view, grades as in L0. |
| Service page template | 0,1,3,5,6,7 | built | Local AI agent, Local model, Mesh link, Long-range radio, Knowledge base, Internet gateway, Messaging. |
| Bridge (new service) | 6 | not built | **Starts NOT SET "needs a radio"**, with `[DEMO] plug in a radio board` on the page. Once the radio is in and the facts show Wi-Fi that can host a hotspot (or ethernet): the preferred networks tried in order (Network A/B/C) and the bridge diagram. |
| Presence + Internet gateway | 7 | not built | Heard nodes. `[DEMO] connect to the internet` → gateway overlay and the queue flushes. The laptop's chip does **not** change, because the gateway is an overlay role. |
| Storage (new service) | 8 | mixed | Gauge, classes, free-space order, `[DEMO] fetch the regional map` from a hub over Wi-Fi; big datasets are "not practical over long-range radio". |
| Repairs (new service) | 9 | not built | Health matrix, `[DEMO] simulate a fault` → diagnose → sandbox → proposal → the W13 gate rail → "fixes shared" log. |
| Settings: Essentials + L0–L9 pages | all | mixed | Each layer page: plain description, status, and "Ask the agent about {layer}" → Agent with a prepared prompt. |
| Install & updates (Settings L1) | 1 | built | `[DEMO] check for updates` → probation → healthy (or rollback). |
| Identity (Settings L2) | 2 | built | Grouped label, editable alias, public card plate, "back up any time from the node itself" (no word count, no CLI string). |

v2, not in v1: map tiles, relations graph, topology view, phone-pairing window, device-category switcher, shared-log viewer, evolution timeline, the hosted partner-network panel.

### 6.5 Architecture
- **Route.** `src/app/demo/page.tsx` is a Server Component that exports `metadata`: title "Live demo", canonical `/demo`, and full `openGraph` + `twitter` objects (metadata merges shallowly, so the root's canonical `/` must not leak). It renders the frame text and mounts one client island, `<DemoApp/>`. Read `node_modules/next/dist/docs/` first (AGENTS.md: this Next.js has breaking changes).
- **Store.** `createDemoStore(world, { router: "url" | "memory", layout: "auto" | "rail" | "docked" | "drawer" })` is a factory, not a singleton, read through `useSyncExternalStore`.
  - `getServerSnapshot` returns `{ view: null }`: the shell renders chrome with an empty main until the client snapshot resolves. The hash cannot be read on the server.
  - `/demo` uses `router: "url"`. It parses `location.hash` and listens to `hashchange` + `popstate`. In-page navigation uses `history.pushState` followed by `store.navigate`, because App Router pushState does not fire `hashchange`.
  - The L4 teaser uses `router: "memory"` and `layout: "rail"`.
  - Rail and mode state start from server defaults; `localStorage` is read in an effect, never in `useState` initializers.
  - The reducer, the **pausable scheduler** (timers stop on `document.hidden` or offscreen), the seeded PRNG and the hash parser are plain TS modules with no React or Next imports, so vitest runs them in node. Times come from a fixed virtual epoch and are formatted by hand.
- **Porting the real shell is a rewrite with rules, not a copy:**
  1. The root is `@container`. Every `lg:` becomes `@min-[1024px]:` and every `max-lg:` becomes `@max-[1023px]:` (not Tailwind's named container sizes).
  2. Every `dvh` height becomes `h-full` / `cqh` of the shell root.
  3. `matchMedia` becomes a `ResizeObserver` on the shell root, unless `layout` is forced.
  4. The drawer and its overlay are `absolute inset-*` inside a `relative overflow-hidden` root, with no body scroll lock and `inert` on the shell's main only. Nothing inside the shell is `position: fixed`.
  5. The NodeChip category badge becomes plain words.
- **Primitives ported** from `os/4-interface/ui/src/components`: status-dot, terminal-chrome, panel, spec-table, badge, button, segmented, toggle, disclosure, mini-terminal, sparkline, diff-view, empty, section-header, attention-badge, copy-button.
- **Motion and imports.** `src/components/demo/**` imports neither `framer-motion` nor `lucide-react`. Inside the shell, motion is limited to CSS transitions, `animate-blink`, the streaming buffer and the state-glyph steps; no `whileInView`, no entrance animations (the real dashboard has none). An import-denylist check covers that directory. The L4 window chrome may animate in; the shell inside it may not.
- **Parity table** `docs/demo-parity.md`: one row per demo file mapped to its real source file, plus a "viewport → container" column and a "mirrors dashboard as of 2026-10" note. The first rows are the motion rule and the Overview-first deviation.
- **Copy.** All copy lives in one file, `src/components/demo/copy.ts`. The cast is sample data: Workshop laptop (this node), Ada, Bram, Workshop hub, Ridge repeater (a relay), Valley hub. Sample labels use only `a–z2–7`, enforced by a vitest regex. Enrollment codes are not derived from labels.
- **Cookie banner** (`cookie-banner.tsx`): on `/demo` it is offset or moved to the top via `usePathname()`, so it never covers the dashboard.
- **Bundle.** Lazy-load the heavy views (radar canvas, repairs, storage) per route; P4 states a `/demo` budget.

### 6.6 Home ↔ demo deep links
L0 → `#/kb` · L1 → `#/settings/l1` · L2 → `#/settings/l2` · L3 → `#/` · L4 → `#/overview` · L5 → `#/messages` · L6 → `#/services/bridge` · L7 → `#/nearby` · L8 → `#/services/storage` · L9 → `#/services/repairs`.

### 6.7 Finale CTA band (after L9)
A full-width inverted band:
- Pixel H2 **"Now open the node."**
- One line: "An interactive copy of the dashboard, with every layer in it. Sample data, and nothing leaves the page."
- Ten cells, `00 KNOWLEDGE` … `09 SELF-HEALING` (`grid-cols-2 sm:grid-cols-5`). Each links to its §6.6 deep link; hover inverts.
- A primary `Open the demo ->`. Hovering it lights the ten cells once, in order.
- A small `install ->` link to `#install`. The command string itself is not repeated.

### 6.8 Demo must-fix list (from the adversarial reviews)
- Offload to hubs only over Wi-Fi/LAN, never over a long-range relay path.
- The laptop "also bridges radio and Wi-Fi" only when its facts show a radio plus Wi-Fi that can host a hotspot, or ethernet (the bootstrap rule).
- Use the real queued sentences verbatim; never invent reason codes.
- Keep storage numbers consistent, and make no airtime claims that break physics.
- KB samples are mostly candidate/testing, with no "proven" tallies.
- Relay copy: "forwards sealed traffic; cannot read it". No "read 0" counter.
- Bridge buffer copy: "nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries".
- Omit pair-code and enrollment lockouts entirely; they read like runtime policies.
- No CLI strings (`111 identity backup`), no `.local` hostnames, no recovery-word count.
- Keyboard: no shortcut double-fire on buttons; Escape closes the drawer; focus is trapped in the drawer.
- A real node waits indefinitely at the human gate, so there is no auto-continue.

---

## 7. Cross-cutting rules (both pages)

- **Font:** in P0, switch the body font to `geist/font/mono` (the package is already a dependency). The Google `latin` subset lacks the box-drawing and block glyphs (█ ░ ─ ═) that the ASCII logo and the terminal need; the variable face has them (U+2500–259F) plus ▲ ▶ ▼ ◀ ● ○ and the arrows. It does **not** have ■ □ ▪ ▸ ◐ ✓: draw pips, grades, node markers and strip cells as CSS squares, or use only the covered glyphs (safe set in DESIGN.md "Glyphs"; `scripts/check-glyphs.mjs`, run by `pnpm test`, fails on any other code point in `src` strings). The family name stays the same, so `--font-mono` keeps working. Only the Line face of Geist Pixel is loaded (`next/font/local`).
- **Status dots:** add the missing tokens `--color-status-live/unset/error` (documented in DESIGN.md, absent from `globals.css`) and one `<StatusDot>`:
  - `h-2 w-2`, always with a text label; transitional = grey + blink; only on dark surfaces.
  - Only for service/node state: never for grades, delivery pips, shelves or badges.
- **Motion budget:**
  - At most two JS-driven loops (RAF / interval / framer `repeat: Infinity`) in view at once; CSS `animate-blink` is exempt.
  - Every loop runs only in view (shared `useInViewPlay`) and stops when the tab is hidden.
  - `<MotionRoot>` (`MotionConfig reducedMotion="user"`) wraps the app, plus `useReducedMotion()` gates on opacity pulses.
  - Data is seeded (no `Math.random` in render paths).
- **Reduced motion:** typing prints whole, travel cuts to the destination, the oscilloscope draws one static frame, and every lesson stays readable through text.
- **A11y:**
  - Every control is a real `<button>` or `<a>` with the existing focus ring.
  - Chip rows use `<ChipGroup>`: unstyled Radix `RadioGroup` with roving tabindex and site chip classes, not the rounded shadcn one.
  - Each interactive component has one polite `aria-live` line.
  - The terminal is `role="region"`.
- **Mobile (375 px):** no horizontal page scroll and 44 px targets. ASCII mockups are guidance only: build real DOM and use CSS shapes for indicators.
- **Honesty:** `SIMULATION` / `DEMO` chips on simulated components. No statistic that reads as real network data, and no number unless it is in the locked docs.
- **Copy check:** `scripts/copy-denylist.json` + `scripts/check-copy.mjs`, run after `next build` inside the `build` script, so a Vercel deploy fails on a leak. Two lists:
  - `text` (all words: satellite, ledger, blockchain, proof of stake, 64 KB, 30 days, V.0.0.5, category codes and names, model sizes …) and `names` (stack proper nouns: the three W2 names, radio/standard brands, runtimes, frameworks, hosts, protocols …; also their ALL-CAPS and version-suffixed spellings).
  - Both lists are scanned over the built output (the text nodes and text attributes of `.next/server/app/*.html`, every text route body such as `llms.txt`, the manifest, robots and sitemap, the `public/` text files and the `*.alt.txt` files) **and** over the string literals in `src/**/*.{ts,tsx}` (not minified chunks), because most interactive copy is client-only and never reaches the HTML.
  - Rules: each W2 name appears exactly once, on the home page only; "Vercel" only in `/terms`; "GitHub" allowed everywhere.
  - The same script runs the `/demo` import denylist (framer-motion, lucide-react).
- **Shadow:** move the eight copy-pasted `shadow` constants into one `--shadow-panel` token.

---

## 8. Build phases (per `os/plan/EXECUTION.md`: small tasks, criteria, checks, disjoint files)

"Green" means `pnpm check`, which runs `typecheck && lint && test && build` (and build includes `check-copy`). P0 removes `typescript.ignoreBuildErrors` from `next.config.mjs`.

| Phase | Tasks | Owns | Check | Size |
|---|---|---|---|---|
| **P0 Foundations** | `package.json` scripts + vitest (`vitest.config.ts`, `@` alias, node env); remove `ignoreBuildErrors`; full-glyph mono font; `layers.ts` (next to the old file, nothing deleted yet); `site.ts` constants (`GITHUB_URL` org, `INSTALL_COMMANDS`, `INSTALL_LIVE`, `INSTALL_SCRIPT_SOURCE`, `SITE_VERSION`, `DEMO_PATH`, `DEMO_READY`); status tokens + `StatusDot`; `--shadow-panel`; `useInViewPlay` / `usePageVisible` / reduced-motion hooks; `<MotionRoot>`; `<ChipGroup>`; `<DeviceChips>` + page-level device store; `<LayerHeader>` / `<LayerFooter>`; **`page.tsx` rewritten once** to import ten stub modules `src/components/sections/layer-N/index.tsx` (each renders only header + footer); copy check + denylists; a home first-load JS budget | `package.json`, `next.config.mjs`, `vitest.config.ts`, `src/lib/*`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/common/*`, `src/components/sections/layer-*/index.tsx` (stubs), `scripts/*` | `pnpm check` green | M |
| **P1 Frame** | nav rail + mobile sheet + install popover; hero (badge, subtitle, install terminal, CTAs, field isolated in its own component); ticker; terminal; footer; metadata / llms (a `force-static` route from `SITE_VERSION`) / manifest; Terms analytics sentence + canonical (owner reviews). `<MotionRoot>` is already mounted (P0). New code goes in `src/components/frame/*` (the five P0 files plus new siblings); each task stops re-exporting, then deletes, its legacy `ascii-hub` file | `src/components/frame/{navigation,hero,ticker,terminal,footer}*`, the matching legacy `ascii-hub` file (delete), `layout.tsx`, `public/llms.txt` → `src/app/llms.txt/route.ts`, `manifest.ts`, `terms/page.tsx` | `pnpm check`; 375 px + 1280 px screenshots; keyboard pass | M |
| **P2 Layers 0, 1, 2, 3, 5** | one task per section, in parallel; each replaces only its own stub folder | `sections/layer-0…3,5/*` | `pnpm check`; per-section reduced-motion + 375 px screenshots | L |
| **P3 Layers 6, 7, 8, 9** + **cleanup** | one task per section; then a cleanup task deletes `sections-data.ts`, `domain-section.tsx`, `ascii-hub/sections/*`, `mini-terminal.tsx`, `src/styles/globals.css` once nothing imports them | `sections/layer-6…9/*`; cleanup: the files it deletes | `pnpm check` | L |
| **P4 `/demo`** | engine (store, scheduler, router, PRNG); frame; shell port per the §6.5 rules + primitives; views in §6.4, split into core views / messaging / L6–L9 surfaces / settings; cookie-banner offset | `src/app/demo/*`, `src/components/demo/*`, `docs/demo-parity.md`, `cookie-banner.tsx` | `pnpm check`; vitest for the reducer, scheduler, hash parser and labels; a scripted click-through of every view at 375 px and 1280 px, including the drawer | L |
| **P5 L4 + CTA band** | L4 section (lazy demo window, rail layout); finale band; flip `DEMO_READY`; add `/demo` to `sitemap.ts`; verify every `<LayerFooter>` link | `sections/layer-4/*`, `demo-cta-band`, `sitemap.ts`, `site.ts` flag | `pnpm check`; deep-link click test; home first-load budget re-checked | S–M |
| **P6 Verify** | a fable judge panel on the full page (logic vs README, tech leaks, design system, perf/a11y); Lighthouse mobile; one fix round | — | panel findings closed | M |

Order rationale:
- P0 fixes `page.tsx` and the stubs once, so the parallel section tasks never touch the same file.
- The demo comes before L4 because L4 reuses its shell.
- Old files are deleted only after every visual is ported.

Commit per verified task in the website repo, with no attribution lines.

---

## 9. Open items: defaulted unless you say otherwise
1. **Hero extra (§3.5):** the click-to-hop node field (S–M), or nothing. Not built until you choose.
2. **Install domain:** `install.111.network` does not resolve today. The card ships copyable, with "installer publishes with the first release" and `READ IT FIRST` pointing at GitHub, until you flip `INSTALL_LIVE`.
3. The W2 example line names Meshtastic, MeshCore and Reticulum. Change or trim it?
4. The website `README.md` manifesto is stale but out of scope unless you ask.
5. Layer 6–9 copy is derived from `os/README.md`, with `os/plan/cross-layer/devices.md` and the messaging spec as supporting inputs. You sign it off on the built sections.
6. The demo cast names (Ada, Bram, Workshop laptop, Ridge repeater, Valley hub) are sample data and easy to rename.

## 10. Risks
- **Scope:** `/demo` is the biggest piece (L). The §6.4 view list is the cap.
- **Drift:** the demo ports the real dashboard's primitives; the parity table keeps the mapping visible.
- **Honesty vs illusion:** Layers 6–9 look as real as Layers 0–4 (W4). The `DEMO` / `SIMULATION` chips and the "sample data" strip carry the disclaimer.
- **Performance:** there are many interactive components on one page, so the motion budget, the in-view gating and the lazy L4 window are mandatory.

## 11. What gets deleted
- Files: `sections-data.ts`, `domain-section.tsx`, the eight old `section-*.tsx` (after their visuals are ported), `mini-terminal.tsx`, `src/styles/globals.css`.
- Copy and features: the "Built With" tech chips; every ledger / proof-of-stake / block line; email/phone identity linking; 30-day expiry; 64 KB caps; satellite/email transports; fake live metrics; the `V.0.0.5` strings; the terminal `stack` command (its license line is kept under `version`); the dead `#kernel-systems` anchor.

## 12. Note for the owner: open source vs source-available (W6)
This plan does not change it; the note is for your study. "Open source" usually means the Open Source Initiative's definition. Anyone may use, change and redistribute the code **for any purpose**, and the license may not discriminate against people, groups or fields of use (OSD clauses 5–6). "Source-available" means the code is public to read, but its use is restricted. A license that bans commercial or military use is therefore source-available, not open source, even though the source is visible.
