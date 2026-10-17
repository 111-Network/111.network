// Copy for the Settings: Essentials and the layer pages (#/settings, #/settings/l0 .. l9).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed SETTINGS_
// (or grow the one SETTINGS_COPY object) so the copy/index.ts barrel never collides.
export const SETTINGS_COPY = {} as const
