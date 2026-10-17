// Copy for the service page template (#/services/<id> except bridge, storage, repairs).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed SERVICES_
// (or grow the one SERVICES_COPY object) so the copy/index.ts barrel never collides.
export const SERVICES_COPY = {} as const
