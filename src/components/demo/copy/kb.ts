// Copy for the Knowledge base view (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed KB_
// (or grow the one KB_COPY object) so the copy/index.ts barrel never collides.
export const KB_COPY = {} as const
