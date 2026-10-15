import { solve } from './solver.js';

// Camera movement cannot invalidate an immutable photo already captured.
export function automaticCandidate(result) {
  if (!result || result.uncertain.size || result.board.length !== 81) return null;
  const occupied = result.board.flatMap((n, i) => n ? [i] : []);
  if (occupied.length < 17 || occupied.length !== result.detected) return null;
  if (occupied.some(i => !result.verified?.[i] || !Number.isFinite(result.confidence?.[i]) || result.confidence[i] < 75)) return null;
  const solved = solve(result.board);
  return solved.kind === 'unique' ? { board: [...result.board], solution: solved.solution, orientation: result.orientation } : null;
}

// Admit only as many photos as can be processed, preserving every admitted photo.
export class SnapshotQueue {
  constructor(capacity = 2) { this.capacity = capacity; this.items = []; }
  get length() { return this.items.length; }
  push(photo) { if (this.length >= this.capacity) return false; this.items.push(photo); return true; }
  take() { return this.items.shift(); }
  clear() { this.items.length = 0; }
}
