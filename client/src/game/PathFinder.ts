import type { GridType, IGridPos } from "../common/types";

import { inBounds } from "../common/helpers/grid.helpers";

const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
];

function heuristic(a: IGridPos, b: IGridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function key(p: IGridPos): string {
  return `${p.x},${p.y}`;
}

export function isWalkable(grid: GridType, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;

  const t = grid[y][x];
  return t.type === "grass";
}

export function findPath(
  grid: GridType,
  start: IGridPos,
  goal: IGridPos,
  allowPhasing = true,
): IGridPos[] | null {
  if (start.x === goal.x && start.y === goal.y) return [start];

  const path = astar(grid, start, goal, false);
  if (path) return path;

  if (!allowPhasing) return null;

  return astar(grid, start, goal, true);
}

function astar(
  grid: GridType,
  start: IGridPos,
  goal: IGridPos,
  ignoreObstacles: boolean,
): IGridPos[] | null {
  const open = new MinHeap<{ pos: IGridPos; f: number }>((a, b) => a.f - b.f);
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, IGridPos>();
  const closed = new Set<string>();

  const startKey = key(start);
  gScore.set(startKey, 0);
  open.push({ pos: start, f: heuristic(start, goal) });

  while (open.size > 0) {
    const { pos: current } = open.pop()!;
    const ck = key(current);

    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(cameFrom, current);
    }

    if (closed.has(ck)) continue;
    closed.add(ck);

    const currentG = gScore.get(ck) ?? Infinity;

    for (const { dx, dy } of NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!inBounds(nx, ny)) continue;
      if (!ignoreObstacles && !isWalkable(grid, nx, ny)) continue;

      const nk = key({ x: nx, y: ny });
      if (closed.has(nk)) continue;

      const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const tentativeG = currentG + moveCost;

      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, current);
        open.push({
          pos: { x: nx, y: ny },
          f: tentativeG + heuristic({ x: nx, y: ny }, goal),
        });
      }
    }
  }

  return null;
}

function reconstruct(
  cameFrom: Map<string, IGridPos>,
  current: IGridPos,
): IGridPos[] {
  const path: IGridPos[] = [current];
  let cur = current;

  let k = key(cur);
  while (cameFrom.has(k)) {
    cur = cameFrom.get(k)!;
    k = key(cur);
    path.unshift(cur);
  }

  return path;
}

class MinHeap<T> {
  private data: T[] = [];
  private readonly compare: (a: T, b: T) => number;
  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size() {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;

    const top = this.data[0];
    const last = this.data.pop();

    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last;
      this.sinkDown(0);
    }

    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;

      if (this.compare(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;

    while (true) {
      let smallest = i;
      const l = 2 * i + 1,
        r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[smallest]) < 0)
        smallest = l;
      if (r < n && this.compare(this.data[r], this.data[smallest]) < 0)
        smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [
          this.data[smallest],
          this.data[i],
        ];
        i = smallest;
      } else break;
    }
  }
}
