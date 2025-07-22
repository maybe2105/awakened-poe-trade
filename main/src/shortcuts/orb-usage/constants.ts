export const MOUSE_TIMEOUT = 200;

export const STASH = {
  start: {
    x: 58,
    y: 200,
  },
  end: {
    x: 828,
    y: 975,
  },
  gridSize: 70,
};

export const STASH_BOUNDS = {
  minX: STASH.start.x - 200, // 200px buffer around stash
  maxX: STASH.end.x + 200,
  minY: STASH.start.y - 200,
  maxY: STASH.end.y + 200,
};
