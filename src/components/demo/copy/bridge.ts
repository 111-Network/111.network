// Copy for the Bridge service view (#/services/bridge).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed BRIDGE_
// (or grow the one BRIDGE_COPY object) so the copy/index.ts barrel never collides.
export const BRIDGE_COPY = {} as const
