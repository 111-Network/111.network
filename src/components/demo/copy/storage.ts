// Copy for the Storage service view (#/services/storage).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed STORAGE_
// (or grow the one STORAGE_COPY object) so the copy/index.ts barrel never collides.
export const STORAGE_COPY = {} as const
