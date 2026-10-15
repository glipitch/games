export function conflicts(board) {
  const bad = new Set();
  for (let i = 0; i < 81; i++) {
    if (!board[i]) continue;
    const r = Math.floor(i / 9), c = i % 9;
    for (let j = i + 1; j < 81; j++) {
      if (board[j] !== board[i]) continue;
      const rr = Math.floor(j / 9), cc = j % 9;
      if (r === rr || c === cc || (Math.floor(r / 3) === Math.floor(rr / 3) && Math.floor(c / 3) === Math.floor(cc / 3))) { bad.add(i); bad.add(j); }
    }
  }
  return bad;
}

// Minimum-remaining-values search, stopping at two solutions to detect ambiguity.
export function solve(board) {
  if (board.length !== 81 || board.some(n => !Number.isInteger(n) || n < 0 || n > 9)) throw new Error('Invalid board');
  if (conflicts(board).size) return { kind: 'conflict', solution: null };
  const cells = [...board], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  cells.forEach((n, i) => { if (n) { const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3); rows[r] |= 1 << n; cols[c] |= 1 << n; boxes[b] |= 1 << n; } });
  let count = 0, solution = null;
  function search() {
    let best = -1, mask = 0, fewest = 10;
    for (let i = 0; i < 81; i++) {
      if (cells[i]) continue;
      const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const m = 1022 & ~(rows[r] | cols[c] | boxes[b]);
      let size = 0; for (let bits = m; bits; bits &= bits - 1) size++;
      if (!size) return;
      if (size < fewest) { best = i; mask = m; fewest = size; if (size === 1) break; }
    }
    if (best === -1) { count++; solution ??= [...cells]; return; }
    const r = Math.floor(best / 9), c = best % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (let n = 1; n <= 9 && count < 2; n++) {
      const bit = 1 << n; if (!(mask & bit)) continue;
      cells[best] = n; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      search();
      cells[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
  }
  search();
  return { kind: count === 0 ? 'impossible' : count === 1 ? 'unique' : 'multiple', solution };
}
