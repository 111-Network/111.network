// Copy for the Messages view and conversation (#/messages, #/messages/<peer>).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed MESSAGES_
// (or grow the one MESSAGES_COPY object) so the copy/index.ts barrel never collides.
export const MESSAGES_COPY = {} as const
