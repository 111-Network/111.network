// Copy for the Nearby view (#/nearby).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed NEARBY_
// (or grow the one NEARBY_COPY object) so the copy/index.ts barrel never collides.
export const NEARBY_COPY = {} as const
