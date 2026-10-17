// Copy for the Overview view (#/overview).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed OVERVIEW_
// (or grow the one OVERVIEW_COPY object) so the copy/index.ts barrel never collides.
export const OVERVIEW_COPY = {} as const
