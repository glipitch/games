import { solve } from './solver.js';

const canvas = (w, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });

export function threshold(image, radius = 12, offset = 14) {
  const { width: w, height: h, data } = image;
  const gray = new Uint8Array(w * h), integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      gray[y * w + x] = Math.round(data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114);
      sum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + sum;
    }
  }
  const binary = new Uint8Array(w * h), stride = w + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1), y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
    binary[y * w + x] = gray[y * w + x] < mean - offset ? 1 : 0;
  }
  return binary;
}

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function quadrilateral(points) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const lower = [], upper = [];
  for (const p of points) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...points].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length < 4) return null;
  function simplify(chain, epsilon) {
    if (chain.length <= 2) return chain;
    let farthest = 0, distance = 0;
    const a = chain[0], b = chain.at(-1), length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = 1; i < chain.length - 1; i++) { const d = Math.abs(cross(a, b, chain[i])) / length; if (d > distance) { distance = d; farthest = i; } }
    if (distance <= epsilon) return [a, b];
    return [...simplify(chain.slice(0, farthest + 1), epsilon).slice(0, -1), ...simplify(chain.slice(farthest), epsilon)];
  }
  let opposite = 1;
  for (let i = 2; i < hull.length; i++) if (Math.hypot(hull[i].x - hull[0].x, hull[i].y - hull[0].y) > Math.hypot(hull[opposite].x - hull[0].x, hull[opposite].y - hull[0].y)) opposite = i;
  let epsilon = .8, reduced;
  do {
    reduced = [...simplify(hull.slice(0, opposite + 1), epsilon).slice(0, -1), ...simplify([...hull.slice(opposite), hull[0]], epsilon).slice(0, -1)];
    epsilon *= 1.5;
  } while (reduced.length > 18);
  // Maximise enclosed area instead of repeatedly dropping local corners:
  // rounded/antialiased corner pixels must not collapse into an inner diamond.
  let best = null, area = 0;
  for (let a = 0; a < reduced.length - 3; a++) for (let b = a + 1; b < reduced.length - 2; b++) for (let c = b + 1; c < reduced.length - 1; c++) for (let d = c + 1; d < reduced.length; d++) {
    const quad = [reduced[a], reduced[b], reduced[c], reduced[d]], size = polygonArea(quad);
    if (size > area) { best = quad; area = size; }
  }
  if (!best) return null;
  let start = 0;
  for (let i = 1; i < 4; i++) if (best[i].x + best[i].y < best[start].x + best[start].y) start = i;
  return [...best.slice(start), ...best.slice(0, start)];
}
const polygonArea = points => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
const center = points => points.reduce((p, q) => ({ x: p.x + q.x / 4, y: p.y + q.y / 4 }), { x: 0, y: 0 });
function joinGaps(bits, w, h) {
  // Group fragmented thin lines using a one-pixel halo. The final outline is
  // fitted to the original ink, so this does not expand the detected corners.
  let source = bits;
  for (const horizontal of [true, false]) {
    const next = new Uint8Array(bits.length), step = horizontal ? 1 : w;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, before = horizontal ? x > 0 : y > 0, after = horizontal ? x < w - 1 : y < h - 1;
      const a = before ? source[p - step] : 0, b = source[p], c = after ? source[p + step] : 0;
      next[p] = a | b | c;
    }
    source = next;
  }
  return source;
}
function gridsFromCells(white, w, h, queue, expansion = 5, step = 1.8) {
  // Grid borders can touch captions or a second diagram. Enclosed cell spaces
  // still form their own lattice, even when the dark outlines are connected.
  const cells = [];
  for (let start = 0; start < white.length; start++) {
    if (!white[start]) continue;
    let head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0, edge = false;
    queue[0] = start; white[start] = 0;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const q of [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && white[q]) { white[q] = 0; queue[tail++] = q; }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (edge || bw < 5 || bh < 5 || bw > Math.min(w, h) * .23 || bh > Math.min(w, h) * .23 || bw / bh < .3 || bw / bh > 3 || tail < bw * bh * .45) continue;
    const left = new Int32Array(bh).fill(w), right = new Int32Array(bh).fill(-1);
    for (let i = 0; i < tail; i++) { const p = queue[i], y = Math.floor(p / w) - minY, x = p % w; left[y] = Math.min(left[y], x); right[y] = Math.max(right[y], x); }
    const outline = [];
    for (let y = 0; y < bh; y++) if (right[y] >= 0) outline.push({ x: left[y], y: y + minY }, { x: right[y], y: y + minY });
    const quad = quadrilateral(outline);
    if (!quad || polygonArea(quad) < 20 || tail < polygonArea(quad) * .6) continue;
    const ux = quad[1].x + quad[2].x - quad[0].x - quad[3].x, uy = quad[1].y + quad[2].y - quad[0].y - quad[3].y;
    const vx = quad[2].x + quad[3].x - quad[0].x - quad[1].x, vy = quad[2].y + quad[3].y - quad[0].y - quad[1].y;
    const ul = Math.hypot(ux, uy), vl = Math.hypot(vx, vy);
    cells.push({ quad, center: center(quad), u: { x: ux / ul, y: uy / ul }, v: { x: vx / vl, y: vy / vl }, width: ul / 2, height: vl / 2 });
  }
  const parents = cells.map((_, i) => i);
  function root(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j];
    if (Math.min(a.width, b.width) / Math.max(a.width, b.width) < .6 || Math.min(a.height, b.height) / Math.max(a.height, b.height) < .6) continue;
    if (a.u.x * b.u.x + a.u.y * b.u.y < .96 || a.v.x * b.v.x + a.v.y * b.v.y < .96) continue;
    const dx = b.center.x - a.center.x, dy = b.center.y - a.center.y, det = a.u.x * a.v.y - a.u.y * a.v.x;
    const du = Math.abs((dx * a.v.y - dy * a.v.x) / det) / ((a.width + b.width) / 2);
    const dv = Math.abs((dy * a.u.x - dx * a.u.y) / det) / ((a.height + b.height) / 2);
    if ((du >= .75 && du <= step && dv < .3) || (dv >= .75 && dv <= step && du < .3)) parents[root(j)] = root(i);
  }
  const groups = new Map();
  cells.forEach((cell, i) => { const key = root(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(cell); });
  const candidates = [];
  for (const group of groups.values()) {
    if (group.length < 49 || group.length > 100) continue;
    const quad = quadrilateral(group.flatMap(cell => cell.quad)); if (!quad) continue;
    const middle = center(quad), edge = quad.reduce((sum, p, i) => sum + Math.hypot(p.x - quad[(i + 1) % 4].x, p.y - quad[(i + 1) % 4].y), 0) / 4;
    const factor = 1 + expansion / edge;
    candidates.push(quad.map(p => ({ x: middle.x + (p.x - middle.x) * factor, y: middle.y + (p.y - middle.y) * factor })));
  }
  return candidates;
}
function gridCandidates(source, { target = { x: .5, y: .5 }, previous = null, contrast = 14 } = {}) {
  const scale = Math.min(1, 650 / Math.max(source.width, source.height));
  const small = canvas(Math.round(source.width * scale), Math.round(source.height * scale));
  const ctx = small.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, small.width, small.height);
  const w = small.width, h = small.height, ink = threshold(ctx.getImageData(0, 0, w, h), 12, contrast), bits = joinGaps(ink, w, h);
  const whiteFine = Uint8Array.from(bits, n => n ? 0 : 1), whiteWide = Uint8Array.from(joinGaps(bits, w, h), n => n ? 0 : 1);
  const queue = new Int32Array(w * h), candidates = [];
  for (let start = 0; start < bits.length; start++) {
    if (!bits[start]) continue;
    let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0;
    queue[0] = start; bits[start] = 0;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && bits[q]) { bits[q] = 0; queue[tail++] = q; }
      }
    }
    const bw = maxX - minX, bh = maxY - minY;
    if (bw < w * .16 || bh < h * .16 || bw / bh < .3 || bw / bh > 3 || tail < (bw + bh) * 1.5) continue;
    const left = new Int32Array(h).fill(w), right = new Int32Array(h).fill(-1);
    for (let i = 0; i < tail; i++) { const p = queue[i]; if (!ink[p]) continue; const y = Math.floor(p / w), x = p % w; left[y] = Math.min(left[y], x); right[y] = Math.max(right[y], x); }
    const outline = [];
    for (let y = minY; y <= maxY; y++) if (right[y] >= 0) outline.push({ x: left[y], y }, { x: right[y], y });
    const quad = quadrilateral(outline)?.map(p => ({ x: p.x / scale, y: p.y / scale }));
    if (quad && validCorners(quad) && polygonArea(quad) > source.width * source.height * .025) candidates.push(quad);
  }
  for (const quad of [...gridsFromCells(whiteFine, w, h, queue), ...gridsFromCells(whiteWide, w, h, queue, 7, 2)]) {
    const points = quad.map(p => ({ x: p.x / scale, y: p.y / scale }));
    if (validCorners(points)) candidates.push(points);
  }
  const aim = { x: target.x * source.width, y: target.y * source.height }, length = Math.min(source.width, source.height), last = previous && center(previous);
  function rank(quad) {
    const p = center(quad), inside = quad.every((a, i) => cross(a, quad[(i + 1) % 4], aim) >= 0);
    const keep = last && Math.hypot(p.x - last.x, p.y - last.y) < length * .08 ? .15 : 0;
    return (inside ? 2 : 0) - Math.hypot(p.x - aim.x, p.y - aim.y) / length + Math.sqrt(polygonArea(quad) / (source.width * source.height)) * .2 + keep;
  }
  return candidates.sort((a, b) => rank(b) - rank(a)).slice(0, 12);
}

export function detectCorners(source, fallback = true) {
  const candidates = gridCandidates(source);
  // Photo review should select an actual grid before considering a page border.
  for (const points of candidates) if (checkGrid(source, points, true).valid) return points;
  for (const points of gridCandidates(source, { contrast: 7 })) if (checkGrid(source, points, true).valid) return points;
  return candidates[0] ?? (fallback ? [{ x: source.width * .08, y: source.height * .08 }, { x: source.width * .92, y: source.height * .08 }, { x: source.width * .92, y: source.height * .92 }, { x: source.width * .08, y: source.height * .92 }] : null);
}

// A framing/quality check, not an OCR or solvability check. Keep it local and
// small enough to run a few times a second without loading the OCR engine.
export function assessFrame(frame, options = {}) {
  const candidates = gridCandidates(frame, options);
  let nearestFailure = null;
  // Rejecting a clipped neighbor must not hide another complete grid in view.
  for (let points of candidates) {
    if (options.previous) {
      let best = points, distance = Infinity;
      for (let k = 0; k < 4; k++) {
        const ordered = [...points.slice(k), ...points.slice(0, k)];
        const d = ordered.reduce((sum, p, i) => sum + Math.hypot(p.x - options.previous[i].x, p.y - options.previous[i].y), 0);
        if (d < distance) { distance = d; best = ordered; }
      }
      points = best;
    }
    const result = checkGrid(frame, points);
    if (result.valid) return result;
    nearestFailure ??= result;
  }
  for (const points of gridCandidates(frame, { ...options, contrast: 7 })) {
    const result = checkGrid(frame, points);
    if (result.valid) return result;
  }
  return nearestFailure ?? { valid: false, message: 'Fit the whole 9 × 9 grid in the frame.', corners: null };
}

function checkGrid(frame, points, photo = false) {
  const fail = (message, corners = points) => ({ valid: false, message, corners });
  if (!points || !validCorners(points)) return fail('Fit the whole 9 × 9 grid in the frame.');
  const length = Math.min(frame.width, frame.height), pad = length * .01;
  if (!photo && points.some(p => p.x < pad || p.y < pad || p.x > frame.width - pad || p.y > frame.height - pad)) return fail('Move back to include all four corners.');
  const edges = points.map((p, i) => Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y));
  if (!photo && (Math.min(...edges) < length * .23 || polygonArea(points) < length ** 2 * .085)) return fail('Move closer to the grid.');
  const size = 360, grid = rectify(frame, points, size), ctx = grid.getContext('2d', { willReadFrequently: true }), image = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size); let light = 0;
  for (let i = 0; i < gray.length; i++) { gray[i] = image.data[i * 4] * .299 + image.data[i * 4 + 1] * .587 + image.data[i * 4 + 2] * .114; light += gray[i]; }
  light /= gray.length;
  if (!photo && light < 55) return fail('Add more light.');
  let sharp = 0, lapMean = 0, samples = 0;
  for (let y = 4; y < size - 4; y++) for (let x = 4; x < size - 4; x++) {
    const p = y * size + x, lap = gray[p - 1] + gray[p + 1] + gray[p - size] + gray[p + size] - 4 * gray[p];
    sharp += lap * lap; lapMean += lap; samples++;
  }
  const sharpness = sharp / samples - (lapMean / samples) ** 2;
  if (!photo && sharpness < 45) return fail('Hold still and let the camera focus.');
  const bits = threshold(image, 10, 10);
  function lines(horizontal) {
    let count = 0;
    for (let k = 1; k < 9; k++) {
      let best = 0;
      for (let p = k * 40 - 10; p <= k * 40 + 10; p++) {
        let score = 0;
        for (let q = 12; q < size - 12; q++) {
          let hit = 0;
          for (let d = -2; d <= 2; d++) hit |= horizontal ? bits[(p + d) * size + q] : bits[q * size + p + d];
          score += hit;
        }
        best = Math.max(best, score);
      }
      if (best > (size - 24) * .5) count++;
    }
    return count;
  }
  if (lines(true) < 7 || lines(false) < 7) return fail('Keep all nine rows and columns visible.');
  let clues = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    let ink = 0;
    for (let y = r * 40 + 10; y < r * 40 + 30; y++) for (let x = c * 40 + 10; x < c * 40 + 30; x++) ink += bits[y * size + x];
    if (ink > 12 && ink < 280) clues++;
  }
  if (clues < 10) return fail('Include the printed numbers in the frame.');
  return { valid: true, message: 'Grid ready. Take photo.', corners: points, sharpness };
}

export function validCorners(points) {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area > 2000;
}

export function rectify(source, points, size = 900) {
  if (!validCorners(points)) throw new Error('Place the four corners around the grid, without crossing them.');
  const targets = [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]], matrix = [];
  targets.forEach(([x, y], i) => {
    const { x: u, y: v } = points[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col; for (let row = col + 1; row < 8; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const divisor = matrix[col][col]; if (Math.abs(divisor) < 1e-10) throw new Error('Adjust the corners to surround the grid.');
    for (let j = col; j <= 8; j++) matrix[col][j] /= divisor;
    for (let row = 0; row < 8; row++) if (row !== col) { const factor = matrix[row][col]; for (let j = col; j <= 8; j++) matrix[row][j] -= factor * matrix[col][j]; }
  }
  const m = matrix.map(row => row[8]), src = source.getContext('2d').getImageData(0, 0, source.width, source.height);
  const dest = canvas(size), ctx = dest.getContext('2d'), output = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = m[6] * x + m[7] * y + 1;
    const xx = Math.max(0, Math.min(source.width - 1, Math.round((m[0] * x + m[1] * y + m[2]) / d)));
    const yy = Math.max(0, Math.min(source.height - 1, Math.round((m[3] * x + m[4] * y + m[5]) / d)));
    const a = (y * size + x) * 4, b = (yy * source.width + xx) * 4;
    output.data[a] = src.data[b]; output.data[a + 1] = src.data[b + 1]; output.data[a + 2] = src.data[b + 2]; output.data[a + 3] = 255;
  }
  ctx.putImageData(output, 0, 0); return dest;
}

export function extractDigits(grid) {
  const w = grid.width, image = grid.getContext('2d').getImageData(0, 0, w, w), bits = threshold(image, 18, 10), cell = w / 9, result = [];
  // Paper can bow between the four corners. Follow the nearby grid lines
  // in each cell rather than assuming all nine rows remain perfectly even.
  function boundary(index, band, horizontal) {
    if (index === 0) return 0;
    if (index === 9) return w - 1;
    const expected = Math.round(index * cell), from = Math.round((band + .15) * cell), to = Math.round((band + .85) * cell);
    let best = expected, score = 0;
    for (let p = expected - 28; p <= expected + 28; p++) {
      let count = 0;
      for (let q = from; q < to; q++) {
        let hit = 0;
        for (let d = -2; d <= 2; d++) hit |= horizontal ? bits[(p + d) * w + q] : bits[q * w + p + d];
        count += hit;
      }
      // Prefer the expected position when several pixels lie on one thick line.
      const weighted = count - Math.abs(p - expected) * .04;
      if (weighted > score) { score = weighted; best = p; }
    }
    return score > (to - from) * .4 ? best : expected;
  }
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9), col = i % 9, margin = Math.round(cell * .07);
    const left = boundary(col, row, false), right = boundary(col + 1, row, false), top = boundary(row, col, true), bottom = boundary(row + 1, col, true);
    const x0 = left + margin, y0 = top + margin, cw = right - left - margin * 2, ch = bottom - top - margin * 2;
    const seen = new Uint8Array(cw * ch), parts = []; let largest = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (seen[y * cw + x] || !bits[(y0 + y) * w + x0 + x]) continue;
      const component = [y * cw + x]; seen[y * cw + x] = 1; let edge = 0;
      for (let head = 0; head < component.length; head++) {
        const p = component[head], xx = p % cw, yy = Math.floor(p / cw);
        if (xx === 0 || yy === 0 || xx === cw - 1 || yy === ch - 1) edge++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = xx + dx, ny = yy + dy, q = ny * cw + nx;
          if (nx >= 0 && nx < cw && ny >= 0 && ny < ch && !seen[q] && bits[(y0 + ny) * w + x0 + nx]) { seen[q] = 1; component.push(q); }
        }
      }
      if (edge < Math.min(cw, ch) * .4 && component.length >= cell * cell * .001) {
        parts.push(component); if (component.length > largest.length) largest = component;
      }
    }
    if (largest.length < cell * cell * .005) { result.push(null); continue; }
    let minX = cw, minY = ch, maxX = 0, maxY = 0;
    for (const p of largest) { minX = Math.min(minX, p % cw); maxX = Math.max(maxX, p % cw); minY = Math.min(minY, Math.floor(p / cw)); maxY = Math.max(maxY, Math.floor(p / cw)); }
    // Keep detached strokes (especially open printed 4s and blurred 5s).
    // Taking only the largest component used to turn these into other digits.
    const mainComponent = largest;
    for (const component of parts) {
      if (component === mainComponent) continue;
      let ax = cw, ay = ch, bx = 0, by = 0;
      for (const p of component) { ax = Math.min(ax, p % cw); bx = Math.max(bx, p % cw); ay = Math.min(ay, Math.floor(p / cw)); by = Math.max(by, Math.floor(p / cw)); }
      const gapX = Math.max(0, ax - maxX, minX - bx), gapY = Math.max(0, ay - maxY, minY - by);
      if (Math.hypot(gapX, gapY) < cell * .09 && Math.max(maxX, bx) - Math.min(minX, ax) < cell * .78) {
        minX = Math.min(minX, ax); maxX = Math.max(maxX, bx); minY = Math.min(minY, ay); maxY = Math.max(maxY, by); largest = largest.concat(component);
      }
    }
    if (maxY - minY < cell * .22 || maxX - minX > cell * .78) { result.push(null); continue; }
    if ((minX + maxX) / 2 < cw * .25 || (minX + maxX) / 2 > cw * .75 || (minY + maxY) / 2 < ch * .2 || (minY + maxY) / 2 > ch * .8) { result.push(null); continue; }
    if (largest.length < cell * cell * .008 && (maxY - minY < cell * .4 || maxX - minX > cell * .2)) { result.push(null); continue; }
    const glyph = canvas(cw, ch), gc = glyph.getContext('2d'), ink = gc.createImageData(cw, ch); ink.data.fill(255);
    for (const p of largest) { const q = p * 4; ink.data[q] = ink.data[q + 1] = ink.data[q + 2] = 0; }
    gc.putImageData(ink, 0, 0);
    const digit = canvas(110), dc = digit.getContext('2d'); dc.fillStyle = 'white'; dc.fillRect(0, 0, 110, 110);
    const height = 70, width = (maxX - minX + 1) / (maxY - minY + 1) * height;
    dc.drawImage(glyph, minX, minY, maxX - minX + 1, maxY - minY + 1, (110 - width) / 2, 20, width, height);
    const gray = canvas(maxX - minX + 1, maxY - minY + 1), gr = gray.getContext('2d'), crop = gr.createImageData(gray.width, gray.height), histogram = new Uint32Array(256);
    for (let y = 0; y < gray.height; y++) for (let x = 0; x < gray.width; x++) {
      const p = ((y0 + minY + y) * w + x0 + minX + x) * 4, value = Math.round(image.data[p] * .299 + image.data[p + 1] * .587 + image.data[p + 2] * .114);
      histogram[value]++; const q = (y * gray.width + x) * 4; crop.data[q] = value;
    }
    let lo = 0, hi = 255, total = 0;
    for (let value = 0; value < 256; value++) { total += histogram[value]; if (total >= gray.width * gray.height * .04) { lo = value; break; } }
    total = 0; for (let value = 255; value >= 0; value--) { total += histogram[value]; if (total >= gray.width * gray.height * .1) { hi = value; break; } }
    digit.contrast = hi - lo;
    for (let p = 0; p < crop.data.length; p += 4) { const value = Math.max(0, Math.min(255, (crop.data[p] - lo) * 255 / Math.max(1, hi - lo))); crop.data[p] = crop.data[p + 1] = crop.data[p + 2] = value; crop.data[p + 3] = 255; }
    gr.putImageData(crop, 0, 0);
    digit.gray = canvas(110); const grayCtx = digit.gray.getContext('2d'); grayCtx.fillStyle = 'white'; grayCtx.fillRect(0, 0, 110, 110); grayCtx.drawImage(gray, (110 - width) / 2, 20, width, height);
    result.push(digit);
  }
  // Compare contrast with the other clues on the same page. This suppresses
  // bleed-through on dark print while retaining genuinely faint/coloured print.
  const contrasts = result.filter(Boolean).map(digit => digit.contrast).sort((a, b) => a - b);
  const minimum = Math.max(20, (contrasts[Math.floor(contrasts.length * .75)] || 0) * .27);
  return result.map(digit => digit && digit.contrast >= minimum ? digit : null);
}

let library;
function suppressPatternNoise(grid) {
  const w = grid.width, h = grid.height, image = grid.getContext('2d').getImageData(0, 0, w, h), gray = new Float32Array(w * h), noise = [];
  for (let p = 0; p < gray.length; p++) gray[p] = image.data[p * 4] * .299 + image.data[p * 4 + 1] * .587 + image.data[p * 4 + 2] * .114;
  for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
    let sum = 0, square = 0, count = 0;
    for (let y = Math.floor((row + .25) * h / 9); y < (row + .75) * h / 9; y++) for (let x = Math.floor((col + .25) * w / 9); x < (col + .75) * w / 9; x++) { const v = gray[y * w + x]; sum += v; square += v * v; count++; }
    noise.push(Math.sqrt(Math.max(0, square / count - (sum / count) ** 2)));
  }
  noise.sort((a, b) => a - b);
  // The lower quartile mostly samples blank cells. Screen moiré raises their
  // variation, while a clean page or naturally blurred print needs no smoothing.
  if (noise[Math.floor(noise.length / 4)] < 8) return grid;
  const work = new Float32Array(gray.length);
  // Five separable binomial passes approximate a Gaussian with sigma 1.6px.
  for (let pass = 0; pass < 5; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; work[p] = (gray[x ? p - 1 : p] + 2 * gray[p] + gray[x < w - 1 ? p + 1 : p]) / 4; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; gray[p] = (work[y ? p - w : p] + 2 * work[p] + work[y < h - 1 ? p + w : p]) / 4; }
  }
  for (let p = 0; p < gray.length; p++) { image.data[p * 4] = image.data[p * 4 + 1] = image.data[p * 4 + 2] = gray[p]; image.data[p * 4 + 3] = 255; }
  const output = canvas(w, h); output.getContext('2d').putImageData(image, 0, 0); return output;
}
function loadLibrary() {
  return library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL('./vendor/tesseract.min.js', import.meta.url).href;
    script.onload = resolve; script.onerror = () => { library = null; script.remove(); reject(new Error('Could not load the scanner. Check your connection and try again.')); };
    document.head.append(script);
  });
}

let scanner = null;
function scannerEntry() {
  if (scanner) return scanner;
  const entry = { busy: false, worker: null, failed: false };
  entry.failure = new Promise((_, reject) => { entry.fail = error => {
    if (entry.failed) return;
    entry.failed = true; reject(error instanceof Error ? error : new Error(String(error)));
  }; });
  // Prewarming may fail before a photo starts reading.
  entry.failure.catch(() => {});
  scanner = entry;
  const startupTimer = setTimeout(() => entry.fail(new Error('The scanner took too long to load. Check your connection and try again.')), 45000);
  const initialization = (async () => {
    await loadLibrary();
    const worker = entry.worker = await Tesseract.createWorker('eng', 1, {
      workerPath: new URL('./vendor/worker.min.js', import.meta.url).href,
      corePath: new URL('./vendor/core/', import.meta.url).href,
      langPath: new URL('./vendor/data/', import.meta.url).href.replace(/\/$/, ''),
      workerBlobURL: false,
      errorHandler: () => entry.fail(new Error('The scanner could not read this photo. Try again or choose another photo.')),
    });
    if (entry.failed) { await worker.terminate(); throw new Error('Scanner cancelled. Try again.'); }
    worker.worker.addEventListener('error', () => entry.fail(new Error('The scanner stopped. Try again or choose another photo.')));
    await worker.setParameters({ tessedit_char_whitelist: '123456789', tessedit_pageseg_mode: '8', user_defined_dpi: '150' });
    return worker;
  })();
  entry.promise = Promise.race([initialization, entry.failure]).catch(error => { if (scanner === entry) scanner = null; void entry.worker?.terminate(); throw error; }).finally(() => clearTimeout(startupTimer));
  return entry;
}

// Start only after scan intent, overlapping download/initialization with framing.
export function prepareScanner() { return scannerEntry().promise.then(() => {}); }

export async function recognize(grid, onProgress, signal, { verify = false } = {}) {
  signal.throwIfAborted();
  const entry = scannerEntry();
  if (entry.busy) throw new Error('The scanner is already reading a photo.');
  entry.busy = true;
  let finished = false, rejectAbort, pending = null;
  const readTimer = setTimeout(() => entry.fail(new Error('Reading took too long. Try again or choose a clearer photo.')), 60000);
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const stop = () => {
    if (scanner === entry) scanner = null;
    // Tesseract may still be encoding a canvas before posting it to the worker.
    // Let that job settle before termination; the caller cancels immediately.
    void entry.promise.then(async worker => {
      let cleanupTimer;
      await Promise.race([pending?.catch(() => {}), new Promise(resolve => { cleanupTimer = setTimeout(resolve, 500); })]);
      clearTimeout(cleanupTimer); await worker.terminate();
    }, () => {});
  };
  const abort = () => { stop(); rejectAbort(signal.reason); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    grid = suppressPatternNoise(grid);
    let digits = extractDigits(grid);
    if (!digits.some(Boolean)) throw new Error('No digits found. Check the corners and use a clear, well-lit photo.');
    onProgress(0, 'Loading scanner…'); const worker = await Promise.race([entry.promise, aborted]);
    signal.throwIfAborted();
    const readDigit = image => { pending = worker.recognize(image); return Promise.race([pending, aborted, entry.failure]); };
    function rotate(source, turns) {
      if (!turns) return source;
      const c = canvas(source.width, source.height), ctx = c.getContext('2d'); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(turns * Math.PI / 2); ctx.drawImage(source, -source.width / 2, -source.height / 2); return c;
    }
    const occupied = digits.map((digit, i) => digit ? i : -1).filter(i => i >= 0);
    const sample = Array.from({ length: Math.min(8, occupied.length) }, (_, i) => occupied[Math.floor(i * occupied.length / Math.min(8, occupied.length))]);
    const scores = [], upright = new Map();
    onProgress(0, 'Checking orientation…');
    for (let turns = 0; turns < 4; turns++) {
      let score = 0;
      for (let j = 0; j < sample.length; j++) {
        signal.throwIfAborted(); const i = sample[j], { data } = await readDigit(rotate(digits[i].gray, turns));
        if (!turns) upright.set(i, data);
        if (/^[1-9]$/.test(data.text.trim())) score += data.confidence;
        // An unfinished orientation cannot win if even perfect remaining digits
        // cannot beat both the current best and the required upright margin.
        const needed = Math.max(scores[0] + 8, ...scores) * sample.length;
        if (turns && score + (sample.length - j - 1) * 100 <= needed) break;
      }
      scores.push(score / sample.length);
      // Confidence is bounded by 100, so no rotation can clear the +8 margin.
      if (!turns && scores[0] >= 92) break;
    }
    const best = scores.indexOf(Math.max(...scores)), orientation = scores[best] > scores[0] + 8 ? best : 0;
    if (orientation) digits = extractDigits(rotate(grid, orientation));
    const board = Array(81).fill(0), uncertain = new Set(), confidence = Array(81).fill(0), verified = Array(81).fill(false);
    const readings = [];
    for (let i = 0; i < 81; i++) {
      signal.throwIfAborted();
      if (digits[i]) {
        let data = !orientation && upright.get(i) || (await readDigit(digits[i].gray)).data;
        const gray = data; let binary;
        if (!/^[1-9]$/.test(data.text.trim()) || data.confidence < 75) {
          const alternate = await readDigit(digits[i]);
          binary = alternate.data;
          if (/^[1-9]$/.test(alternate.data.text.trim()) && alternate.data.confidence > data.confidence) data = alternate.data;
        }
        const text = data.text.trim();
        if (/^[1-9]$/.test(text)) { board[i] = Number(text); confidence[i] = data.confidence; }
        if (!board[i] || data.confidence < 70) uncertain.add(i);
        if (verify) readings[i] = { gray, binary };
      }
      onProgress(i + 1, 'Reading the numbers…');
    }
    const detected = digits.filter(Boolean).length;
    // Spend verification time only on a complete, confident, uniquely solvable
    // read. Extra views validate its clues; they never change them to fit a solve.
    if (verify && !uncertain.size && detected >= 17 && board.filter(Boolean).length === detected && board.every((n, i) => !n || confidence[i] >= 75) && solve(board).kind === 'unique') {
      onProgress(81, 'Checking the numbers…');
      for (let i = 0; i < 81; i++) if (digits[i]) {
        signal.throwIfAborted();
        const views = [readings[i].gray, readings[i].binary ?? (await readDigit(digits[i])).data];
        const agrees = data => data.text.trim() === String(board[i]) && data.confidence >= 75;
        // Thresholding can merge or detach a stroke. A resampled grayscale view
        // gives a second check without relying on that binary segmentation.
        if (views.filter(agrees).length < 2) {
          const scaled = canvas(132); scaled.getContext('2d').drawImage(digits[i].gray, 0, 0, 132, 132);
          views.push((await readDigit(scaled)).data);
        }
        verified[i] = views.filter(agrees).length >= 2;
      }
    }
    finished = true;
    return { board, uncertain, orientation, confidence, verified, detected };
  } finally {
    clearTimeout(readTimer);
    signal.removeEventListener('abort', abort); entry.busy = false;
    if (!finished && !signal.aborted) stop();
  }
}
