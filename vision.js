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

// Connected grid lines form one component. Its four extrema suggest the corners.
export function detectCorners(source, fallback = true) {
  const scale = Math.min(1, 650 / Math.max(source.width, source.height));
  const small = canvas(Math.round(source.width * scale), Math.round(source.height * scale));
  const ctx = small.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, small.width, small.height);
  const w = small.width, h = small.height, bits = threshold(ctx.getImageData(0, 0, w, h));
  const queue = new Int32Array(w * h); let best = null, score = 0;
  for (let start = 0; start < bits.length; start++) {
    if (!bits[start]) continue;
    let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0;
    let tl, tr, br, bl, minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
    queue[0] = start; bits[start] = 0;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x + y < minSum) { minSum = x + y; tl = { x, y }; }
      if (x + y > maxSum) { maxSum = x + y; br = { x, y }; }
      if (x - y < minDiff) { minDiff = x - y; bl = { x, y }; }
      if (x - y > maxDiff) { maxDiff = x - y; tr = { x, y }; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && bits[q]) { bits[q] = 0; queue[tail++] = q; }
      }
    }
    const bw = maxX - minX, bh = maxY - minY, area = bw * bh;
    if (bw < w * .2 || bh < h * .2 || bw / bh < .45 || bw / bh > 2.2 || tail < (bw + bh) * 2) continue;
    if (area > score) { score = area; best = [tl, tr, br, bl].map(p => ({ x: p.x / scale, y: p.y / scale })); }
  }
  return best ?? (fallback ? [{ x: source.width * .08, y: source.height * .08 }, { x: source.width * .92, y: source.height * .08 }, { x: source.width * .92, y: source.height * .92 }, { x: source.width * .08, y: source.height * .92 }] : null);
}

// A framing/quality check, not an OCR or solvability check. Keep it local and
// small enough to run a few times a second without loading the OCR engine.
export function assessFrame(frame) {
  const points = detectCorners(frame, false);
  const fail = (message, corners = points) => ({ valid: false, message, corners });
  if (!points || !validCorners(points)) return fail('Fit the whole 9 × 9 grid in the frame.');
  const xs = points.map(p => p.x), ys = points.map(p => p.y), width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  const pad = frame.width * .018;
  if (points.some(p => p.x < pad || p.y < pad || p.x > frame.width - pad || p.y > frame.height - pad)) return fail('Move back to include all four corners.');
  if (width < frame.width * .5 || height < frame.height * .5) return fail('Move closer to the grid.');
  if (width / height < .7 || width / height > 1.45) return fail('Hold the camera straight over the grid.');
  const size = 360, grid = rectify(frame, points, size), ctx = grid.getContext('2d', { willReadFrequently: true }), image = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size); let light = 0;
  for (let i = 0; i < gray.length; i++) { gray[i] = image.data[i * 4] * .299 + image.data[i * 4 + 1] * .587 + image.data[i * 4 + 2] * .114; light += gray[i]; }
  light /= gray.length;
  if (light < 55) return fail('Add more light.');
  let sharp = 0, lapMean = 0, samples = 0;
  for (let y = 4; y < size - 4; y++) for (let x = 4; x < size - 4; x++) {
    const p = y * size + x, lap = gray[p - 1] + gray[p + 1] + gray[p - size] + gray[p + size] - 4 * gray[p];
    sharp += lap * lap; lapMean += lap; samples++;
  }
  const sharpness = sharp / samples - (lapMean / samples) ** 2;
  if (sharpness < 45) return fail('Hold still and let the camera focus.');
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
  const w = grid.width, bits = threshold(grid.getContext('2d').getImageData(0, 0, w, w), 18, 12), cell = w / 9, result = [];
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
    const seen = new Uint8Array(cw * ch); let largest = [];
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
      if (component.length > largest.length && edge < Math.min(cw, ch) * .4) largest = component;
    }
    if (largest.length < cell * cell * .012) { result.push(null); continue; }
    let minX = cw, minY = ch, maxX = 0, maxY = 0;
    for (const p of largest) { minX = Math.min(minX, p % cw); maxX = Math.max(maxX, p % cw); minY = Math.min(minY, Math.floor(p / cw)); maxY = Math.max(maxY, Math.floor(p / cw)); }
    if (maxY - minY < cell * .22 || maxX - minX > cell * .78) { result.push(null); continue; }
    const glyph = canvas(cw, ch), gc = glyph.getContext('2d'); gc.fillStyle = 'white'; gc.fillRect(0, 0, cw, ch); gc.fillStyle = 'black';
    for (const p of largest) gc.fillRect(p % cw, Math.floor(p / cw), 1, 1);
    const digit = canvas(110), dc = digit.getContext('2d'); dc.fillStyle = 'white'; dc.fillRect(0, 0, 110, 110);
    const height = 70, width = (maxX - minX + 1) / (maxY - minY + 1) * height;
    dc.drawImage(glyph, minX, minY, maxX - minX + 1, maxY - minY + 1, (110 - width) / 2, 20, width, height);
    result.push(digit);
  }
  return result;
}

let library;
function loadLibrary() {
  return library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL('./vendor/tesseract.min.js', import.meta.url).href;
    script.onload = resolve; script.onerror = () => { library = null; script.remove(); reject(new Error('Could not load the scanner. Check your connection and try again.')); };
    document.head.append(script);
  });
}

export async function recognize(grid, onProgress, signal) {
  const digits = extractDigits(grid);
  if (!digits.some(Boolean)) throw new Error('No digits found. Check the corners and use a clear, well-lit photo.');
  onProgress(0, 'Loading scanner…'); await loadLibrary(); signal.throwIfAborted();
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: new URL('./vendor/worker.min.js', import.meta.url).href,
    corePath: new URL('./vendor/core/', import.meta.url).href,
    langPath: new URL('./vendor/data/', import.meta.url).href.replace(/\/$/, ''),
    workerBlobURL: false,
  });
  if (signal.aborted) { await worker.terminate(); signal.throwIfAborted(); }
  const stop = () => { void worker.terminate(); };
  signal.addEventListener('abort', stop, { once: true });
  try {
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_char_whitelist: '123456789', tessedit_pageseg_mode: '8', user_defined_dpi: '150' });
    const board = Array(81).fill(0), uncertain = new Set();
    for (let i = 0; i < 81; i++) {
      signal.throwIfAborted();
      if (digits[i]) {
        const { data } = await worker.recognize(digits[i]);
        const text = data.text.trim();
        if (/^[1-9]$/.test(text)) board[i] = Number(text);
        if (!board[i] || data.confidence < 70) uncertain.add(i);
      }
      onProgress(i + 1, 'Reading the numbers…');
    }
    return { board, uncertain };
  } finally { signal.removeEventListener('abort', stop); if (!signal.aborted) await worker.terminate(); }
}
