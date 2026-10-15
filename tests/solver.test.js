import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, conflicts } from '../solver.js';
const puzzle = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number);
test('solves a unique puzzle without changing its clues or the input', () => {
  const before = [...puzzle], result = solve(puzzle);
  assert.equal(result.kind, 'unique'); assert.deepEqual(puzzle, before);
  assert.equal(result.solution.join(''), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  assert.equal(conflicts(result.solution).size, 0);
});
test('flags both conflicting clues', () => { const b = [...puzzle]; b[1] = 5; assert.ok(conflicts(b).has(0)); assert.ok(conflicts(b).has(1)); assert.equal(solve(b).kind, 'conflict'); });
test('detects ambiguity rather than inventing an answer', () => { assert.equal(solve(Array(81).fill(0)).kind, 'multiple'); });
test('detects a contradiction without duplicate clues', () => { const b = [...puzzle]; b[2] = 1; assert.equal(conflicts(b).size, 0); assert.equal(solve(b).kind, 'impossible'); });
test('accepts a completed grid', () => { const b = solve(puzzle).solution; assert.deepEqual(solve(b), { kind: 'unique', solution: b }); });
test('rejects malformed boards', () => { assert.throws(() => solve([1])); assert.throws(() => solve(Array(81).fill(10))); });
