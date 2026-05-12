# 111 Network — Design System

> Strictly derived from the root source files. Every value, token, and pattern below is actively used in the codebase. No speculative additions.

---

## 1. Brand Identity

**111 Network** is a global mesh messaging network. The visual language is terminal-native, monochrome, and engineering-first. No gradients, no rounded corners, no decorative flourishes. Every pixel communicates function.

**Mood**: Restricted-access technical archive. Cold, precise, utilitarian. The interface feels like a system monitor for decentralized infrastructure.

**Keywords**: monochrome, ASCII, terminal, mesh, decentralized, raw, engineered.

---

## 2. Color Palette

The palette is strictly **pure black and white** with a single grayscale ladder. No accent colors exist outside the destructive red.

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#000000` | Page background, void |
| `foreground` | `#ffffff` | Primary text, active fills, borders on hover |
| `card` | `#0a0a0a` | Card backgrounds, slightly lifted from void |
| `popover` | `#0a0a0a` | Dropdown / overlay surfaces |
| `secondary` | `#1a1a1a` | Secondary surfaces, terminal body tint |
| `muted` | `#1a1a1a` | Muted backgrounds |
| `muted-foreground` | `#a0a0a0` | Labels, captions, secondary text, metadata |
| `accent` | `#1a1a1a` | Accent surface (same as secondary) |
| `border` | `#262626` | All borders, dividers, grid lines |
| `input` | `#262626` | Form input borders |
| `ring` | `#ffffff` | Focus rings |
| `destructive` | `#ff3333` | Errors, alerts (rare) |

### Color Usage Patterns

- **Default state**: black bg (`#000000`) + white text (`#ffffff`).
- **Muted/secondary text**: `text-muted-foreground` (`#a0a0a0`).
- **Hover inversion**: `hover:bg-foreground hover:text-background` (white fill, black text).
- **Active/selected state**: `bg-foreground text-background` (solid white fill, black text).
- **Ghost numbers**: `text-foreground/[0.08]` (near-invisible oversized section numbers).
- **Terminal chrome dots**: three dots at `bg-foreground`, `bg-muted-foreground/50`, `bg-muted-foreground/30`.
- **Inverted bands**: full-width sections with `bg-foreground` + `text-background` (white bg, black text).

---

## 3. Typography

### Font Families

| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| Display / Headings | **Geist Pixel Line** | — | Hero titles, section H2s, ghost numbers. Loaded via `geist/font/pixel`. |
| Body / UI | **Geist Mono** | `Geist Mono Fallback`, `monospace` | All body text, labels, buttons, terminal output, metadata. |
| Pixel Accent | **Silkscreen** | `Geist Mono`, `monospace` | Nav logo (`MONO_HUB`), pixel badges. Weight 400/700. |

> **Important**: The root layout applies `font-mono` to the body. All text defaults to Geist Mono unless explicitly overridden with `font-pixel-line`.

### Type Scale

| Element | Size | Weight | Tracking | Font Family |
|---------|------|--------|----------|-------------|
| Hero H1 | `text-5xl` → `md:text-7xl` → `lg:text-9xl` | `font-bold` | `tracking-tight` | `font-pixel-line` |
| Section H2 | `text-3xl` → `md:text-5xl` | `font-bold` | `tracking-tight` | `font-pixel-line` |
| Ghost number | `text-7xl` → `md:text-9xl` | `font-bold` | — | `font-pixel-line` |
| Section subtitle | `text-[10px]` | — | `uppercase tracking-widest` | `font-mono` |
| Body text | `text-sm` → `md:text-base` | — | `leading-relaxed` | `font-mono` |
| Terminal output | `text-xs` / `text-[10px]` | — | `leading-relaxed` | `font-mono` |
| Labels / metadata | `text-[10px]` | — | `uppercase tracking-widest` | `font-mono` |
| Spec values | `text-xs` / `text-sm` | `font-bold` | — | `font-mono` |
| Nav links | `text-xs` / `text-sm` | — | — | `font-mono` |
| Footer legal | `text-[10px]` | — | — | `font-mono` |
| ASCII art | `text-[9px]` → `md:text-[11px]` | — | `leading-[12px]` / `leading-[14px]` | `font-mono` |
| ASCII logo | `text-[8px]` → `md:text-[10px]` | — | `leading-[10px]` / `leading-[12px]` | `font-mono` |

### Text Rendering

- `antialiased` applied globally on `<body>`.
- `text-balance` on hero heading.
- No line-height overrides beyond Tailwind defaults and `leading-relaxed` for body.

---

## 4. Spacing & Layout

### Container

```
max-w-7xl
mx-auto
px-4 (mobile)
lg:px-8 (desktop)
```

### Section Padding

```
py-20 (mobile sections)
lg:py-32 (desktop sections)
```

### Grid Patterns

- **Bento grid**: `grid gap-4 lg:grid-cols-3`
- **Two-column**: `grid gap-6 lg:grid-cols-2`
- **Full-width bands**: `mx-auto max-w-7xl` for content, but child elements may bleed full-width (layer stack, oscilloscope).
- **Gap sizes**: `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `gap-12`.

---

## 5. Borders, Radius & Elevation

### Border Radius

**Zero everywhere.** `--radius: 0rem`.

All corners are sharp: buttons, cards, inputs, badges, terminal windows. No `rounded-md`, no `rounded-lg`. The `button.tsx` from shadcn specifies `rounded-md` but the ascii-hub components use raw `<button>` and `<a>` tags with zero radius.

### Borders

| Thickness | Color | Usage |
|-----------|-------|-------|
| `1px` (`border`) | `border` (`#262626`) | Cards, panels, terminal chrome, section dividers |
| `1px` (`border-2`) | `foreground` (`#ffffff`) | Emphasis boxes, blueprint stamps, interactive toggles |
| `1px` (`border-b`, `border-r`) | `border` (`#262626`) | Internal panel dividers, table rows |
| `h-px` / `w-px` | `bg-border` / `bg-foreground` | Decorative rules, scroll indicator |

### Elevation (Shadows)

One shadow only, applied to cards and panels:

```
rgba(14, 63, 126, 0.04) 0px 0px 0px 1px,
rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px,
rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px,
rgba(42, 51, 70, 0.04) 0px 6px 6px -3px,
rgba(14, 63, 126, 0.04) 0px 12px 12px -6px,
rgba(14, 63, 126, 0.04) 0px 24px 24px -12px
```

> This is a **subtle layered shadow** — barely visible, adding micro-depth without breaking the flat terminal aesthetic. Used via inline `style={{ boxShadow: shadow }}` in components.

---

## 6. Component Primitives

### Terminal Chrome

Every terminal-like panel follows this header pattern:

```
┌─[dot][dot][dot]  label ~ subtitle───────────────────┐
│                                                      │
│   content                                            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Header markup pattern** (repeated across 10+ components):

```jsx
<div className="flex items-center gap-2 border-b border-border px-4 py-2">
  <div className="h-2 w-2 bg-foreground" />
  <div className="h-2 w-2 bg-muted-foreground/50" />
  <div className="h-2 w-2 bg-muted-foreground/30" />
  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
    {title} ~ terminal
  </span>
</div>
```

### Spec Table

```jsx
<div className="border border-border">
  <div className="flex items-center gap-2 border-b border-border px-4 py-2">
    <div className="h-1.5 w-1.5 bg-foreground" />
    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      Specifications
    </span>
  </div>
  <div className="divide-y divide-border">
    {specs.map((spec) => (
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50">
        <span className="font-mono text-xs text-muted-foreground">{spec.label}</span>
        <span className="font-mono text-xs text-foreground">{spec.value}</span>
      </div>
    ))}
  </div>
</div>
```

### Ghost Number Header

Every section opens with an oversized, near-transparent number:

```jsx
<div className="mb-12 flex items-end gap-6">
  <span className="font-pixel-line text-7xl font-bold leading-none text-foreground/[0.08] md:text-9xl">
    01
  </span>
  <div className="flex-1 pb-2">
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      Low-level architecture
    </span>
    <h2 className="mt-2 font-pixel-line text-3xl font-bold text-foreground md:text-5xl">
      Kernel & Systems
    </h2>
  </div>
</div>
```

### Inverted Panel

Used for emphasis bands (network header, active nav item):

```jsx
<div className="bg-foreground p-8">
  <h2 className="font-pixel-line text-3xl font-bold text-background">
    {title}
  </h2>
  <p className="font-mono text-xs text-background/60">
    {description}
  </p>
</div>
```

### Badge / Tag

```jsx
<span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
  {label}
</span>
```

### Interactive Toggle Button

```jsx
<button className={`border p-3 font-mono transition-all duration-200
  ${active
    ? "border-foreground bg-foreground text-background"
    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
  }`}>
  {label}
</button>
```

### CTA Link (Primary)

```jsx
<a className="group flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 font-mono text-sm text-background transition-all duration-200 hover:bg-transparent hover:text-foreground">
  {label}
  <span className="transition-transform duration-200 group-hover:translate-x-1">{"->"}</span>
</a>
```

### CTA Link (Secondary)

```jsx
<a className="flex items-center gap-2 border border-border px-6 py-3 font-mono text-sm text-muted-foreground transition-all duration-200 hover:border-foreground hover:text-foreground">
  {label}
</a>
```

---

## 7. Animation & Motion

### Custom Keyframes (globals.css)

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
  100% { transform: translate(0); }
}
```

### Utility Classes

| Class | Animation | Duration | Behavior |
|-------|-----------|----------|----------|
| `animate-blink` | `blink` | 1s ease-in-out | Infinite cursor blink |
| `animate-scanline` | `scanline` | 8s linear | Infinite CRT sweep |

### Framer Motion Patterns

**Scroll-triggered entrance** (used on every section):

```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
```

**Staggered children** (specs, metrics, blocks):

```jsx
<motion.div
  initial={{ opacity: 0, x: 20 }}
  whileInView={{ opacity: 1, x: 0 }}
  viewport={{ once: true }}
  transition={{ delay: 0.2 + index * 0.1 }}
>
```

**Typewriter / boot sequence** (kernel, mini-terminal):

Lines reveal one-by-one via `setInterval(..., 150-200ms)` with `motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}`.

**Live indicators**:

```jsx
<motion.div
  animate={{ opacity: [1, 0.3, 1] }}
  transition={{ repeat: Infinity, duration: 1.5 }}
  className="h-2.5 w-2.5 bg-foreground"
/>
```

**Scroll indicator bounce**:

```jsx
<motion.div
  animate={{ y: [0, 6, 0] }}
  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
/>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .animate-blink,
  .animate-scanline {
    animation: none;
  }
}
```

JS-side: `prefers-reduced-motion` disables the ASCII background animation and scanline overlay.

---

## 8. Accessibility

- **Focus states**: `focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none` on all interactive elements.
- **ARIA labels**: All icon-only buttons and ASCII art have `aria-label` / `role="img"`.
- **Selection**: Inverted selection (`bg: #ffffff`, `color: #000000`).
- **Scrollbar**: Custom thin scrollbar (4px) with `#333333` thumb on `#000000` track.
- **Motion respect**: `prefers-reduced-motion` disables animations at CSS and JS levels.

---

## 9. Tech Stack (Design-relevant)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| React | 19.2.4 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Fonts | Geist Mono, Geist Pixel Line, Silkscreen (Google Fonts) |
| UI Primitives | shadcn/ui (new-york style, neutral base, CSS variables) |
| Icons | Lucide React |

---

## 10. Do's and Don'ts

### Do
- Use `font-mono` for all UI text.
- Use `font-pixel-line` for all display headings (H1, H2, ghost numbers).
- Use `text-[10px] uppercase tracking-widest` for section labels.
- Use the terminal chrome pattern (3 dots + label) for any panel.
- Use `border border-border` for all containers.
- Use `hover:bg-foreground hover:text-background` for hover inversions.
- Use the ghost number pattern for numbered sections.
- Respect `prefers-reduced-motion`.

### Don't
- Add border radius. Keep everything sharp (`--radius: 0rem`).
- Add color. Stick to the monochrome palette.
- Use shadows other than the single defined layered shadow.
- Use the shadcn `Button` component for ascii-hub sections (it has `rounded-md`).
- Add gradients, blur effects (except `backdrop-blur-md` on nav), or decorative imagery.
- Use emoji or colored icons. Stick to monochrome Lucide icons.
