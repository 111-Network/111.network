// Copy for the Agent view (#/).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed AGENT_
// (or grow the one AGENT_COPY object) so the copy/index.ts barrel never collides.
export const AGENT_COPY = {} as const
