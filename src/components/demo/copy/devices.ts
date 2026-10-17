// Copy for the Devices view and device detail (#/devices, #/devices/<id>).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed DEVICES_
// (or grow the one DEVICES_COPY object) so the copy/index.ts barrel never collides.
export const DEVICES_COPY = {} as const
