/** Keep in sync with `server/index.js` WORLD / ZONES. */
export const WORLD = { width: 2400, height: 1600 } as const;

export const ZONES = {
  pickup: { x: 320, y: 340, r: 72 },
  drop: { x: 2080, y: 1260, r: 72 },
} as const;

export const MOVE_EMIT_MS = 45;
export const PLAYER_SPEED = 260;
