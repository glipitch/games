import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticCandidate, SnapshotQueue } from '../automatic.js';
const board = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number);
const result = () => ({ board: [...board], uncertain: new Set(), confidence: board.map(n => n ? 95 : 0), verified: board.map(Boolean), detected: board.filter(Boolean).length, orientation: 0 });

test('every admitted photograph is retained and processed in capture order', () => {
  const queue = new SnapshotQueue(2), a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
  assert.equal(queue.push(a), true); assert.equal(queue.push(b), true); assert.equal(queue.push(c), false);
  assert.equal(queue.take(), a); assert.equal(queue.push(c), true); assert.equal(queue.take(), b); assert.equal(queue.take(), c);
  assert.equal(queue.length, 0); assert.equal(queue.take(), undefined);
});
test('only explicit cancellation clears pending photographs', () => {
  const queue = new SnapshotQueue(); queue.push({ puzzle: 'first' }); queue.push({ puzzle: 'another' });
  assert.equal(queue.take().puzzle, 'first'); queue.clear(); assert.equal(queue.length, 0);
});
test('a successful photo needs verified confident clues and a unique solution', () => {
  const weak = result(); weak.confidence[0] = 74;
  const unverified = result(); unverified.verified[0] = false;
  const missingConfidence = result(); delete missingConfidence.confidence;
  const uncertain = result(); uncertain.uncertain.add(0);
  const missingClue = result(); missingClue.board[0] = 0;
  const conflicting = result(); conflicting.board[1] = 5;
  const ambiguous = result(); ambiguous.board = [...'534678912672195348' + '0'.repeat(63)].map(Number); ambiguous.detected = 18; ambiguous.verified.fill(true); ambiguous.confidence.fill(95);
  for (const item of [weak, unverified, missingConfidence, uncertain, missingClue, conflicting, ambiguous]) assert.equal(automaticCandidate(item), null);
  assert.deepEqual(automaticCandidate(result()).board, board);
});
