import { conflicts, solve } from './solver.js';
import { detectCorners, rectify, recognize, assessFrame } from './vision.js';

const $ = id => document.getElementById(id);
let board = Array(81).fill(0), original = null, uncertain = new Set(), selected = -1;
const cells = Array.from({ length: 81 }, (_, i) => {
  const input = document.createElement('input'); input.className = 'cell'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}`);
  input.addEventListener('focus', () => { selected = i; paint(); input.select(); });
  input.addEventListener('blur', () => { selected = -1; paint(); });
  input.addEventListener('input', () => {
    if (original) { board = [...original]; original = null; }
    board[i] = Number(input.value.replace(/[^1-9]/g, '').slice(-1)) || 0; uncertain.delete(i); paint();
    message(conflicts(board).size ? 'Repeated numbers are marked. Check the row, column and box.' : '');
  });
  input.addEventListener('keydown', e => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
    if (e.key in moves) { e.preventDefault(); cells[Math.max(0, Math.min(80, i + moves[e.key]))].focus(); }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); input.value = ''; input.dispatchEvent(new Event('input')); }
    if (e.key === 'Enter') { e.preventDefault(); $('solve').click(); }
  });
  $('board').append(input); return input;
});
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function paint() {
  const bad = conflicts(board);
  cells.forEach((input, i) => {
    input.value = board[i] || '';
    const peer = selected >= 0 && (Math.floor(i / 9) === Math.floor(selected / 9) || i % 9 === selected % 9 || (Math.floor(i / 27) === Math.floor(selected / 27) && Math.floor(i % 9 / 3) === Math.floor(selected % 9 / 3)));
    input.classList.toggle('peer', peer); input.classList.toggle('invalid', bad.has(i)); input.classList.toggle('uncertain', uncertain.has(i)); input.classList.toggle('answer', !!original && !original[i]);
    input.setAttribute('aria-invalid', String(bad.has(i))); input.title = uncertain.has(i) ? 'Check this scanned digit' : '';
  });
  $('undo').hidden = !original;
}
$('board').addEventListener('paste', e => {
  const text = e.clipboardData.getData('text').replace(/[\s|+\-]/g, '');
  if (text.length === 81 && /^[0-9.]+$/.test(text)) { e.preventDefault(); board = [...text].map(x => Number(x) || 0); original = null; uncertain.clear(); paint(); message('Puzzle pasted.'); }
});
$('solve').addEventListener('click', () => {
  if (!board.some(Boolean)) return message('Add the numbers first.', true);
  const result = solve(board);
  if (result.kind === 'conflict') return message('Check the marked numbers. A row, column or box has a repeat.', true);
  if (result.kind === 'impossible') return message('No solution. Check the numbers against your puzzle.', true);
  if (result.kind === 'multiple') return message('More than one solution. Add or check the missing clues.', true);
  if (!original) original = [...board]; board = result.solution; uncertain.clear(); paint(); message('Solved.');
});
$('clear').addEventListener('click', () => { board.fill(0); original = null; uncertain.clear(); paint(); message(''); });
$('undo').addEventListener('click', () => { board = original; original = null; paint(); message('Back to your puzzle.'); });

const dialog = $('scan-dialog'), video = $('video'), crop = $('crop');
let stream = null, source = null, corners = null, dragging = -1, controller = null, session = 0;
let cameraTimer = null, cameraReady = false, stableFrames = 0, previousCorners = null;
let cameraTarget = { x: .5, y: .5 };
const stopCamera = () => { clearTimeout(cameraTimer); cameraTimer = null; cameraReady = false; stableFrames = 0; previousCorners = null; stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; };
function closeScanner() { session++; stopCamera(); controller?.abort(); controller = null; source = null; corners = null; if (dialog.open) dialog.close(); }
dialog.addEventListener('cancel', e => { e.preventDefault(); closeScanner(); });
dialog.addEventListener('close', () => { stopCamera(); controller?.abort(); });
$('close-scan').addEventListener('click', closeScanner);
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) closeScanner(); });
function resetScanner(photoMode = false) {
  if (!dialog.open) dialog.showModal();
  $('scan-title').textContent = photoMode ? 'Align the grid' : 'Scan puzzle';
  $('scan-help').textContent = photoMode ? 'Drag the four corners to the outside edges of the grid.' : 'Centre a puzzle, or tap to choose it.';
  video.hidden = photoMode; $('camera-guide').hidden = photoMode; crop.hidden = !photoMode;
  $('viewfinder').classList.toggle('camera-mode', !photoMode);
  $('crop-tools').hidden = !photoMode; $('capture').hidden = photoMode; $('capture').disabled = true;
  $('read').hidden = !photoMode; $('read').disabled = false; $('rotate').disabled = false; $('retake').disabled = false;
  $('camera-upload').hidden = photoMode; $('progress').hidden = true; $('scan-status').textContent = '';
  if (!photoMode) { cameraTarget = { x: .5, y: .5 }; drawGuide(null, false); }
}
$('camera').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia) { $('native-camera').click(); return; }
  const request = ++session; resetScanner(); $('scan-status').textContent = 'Opening camera…';
  try {
    const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } } });
    if (request !== session || !dialog.open) { media.getTracks().forEach(t => t.stop()); return; }
    stream = media; video.srcObject = media; await video.play();
    if (request !== session || !dialog.open) return;
    checkCamera(request);
  } catch { if (request === session && dialog.open) { stopCamera(); $('scan-status').textContent = 'Camera unavailable. Allow camera access in your browser, or upload a photo.'; } }
});
$('upload').addEventListener('click', () => $('photo').click());
$('camera-upload').addEventListener('click', () => $('photo').click());
$('retake').addEventListener('click', () => $('photo').click());
function cameraFrame(limit) {
  const side = Math.min(video.videoWidth, video.videoHeight), size = Math.min(side, limit);
  const frame = Object.assign(document.createElement('canvas'), { width: size, height: size });
  frame.getContext('2d').drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
  return frame;
}
function drawGuide(points, ready, size = 640) {
  const overlay = $('camera-guide'); overlay.width = overlay.height = size;
  const ctx = overlay.getContext('2d');
  const quad = points ?? [{ x: size * .1, y: size * .1 }, { x: size * .9, y: size * .1 }, { x: size * .9, y: size * .9 }, { x: size * .1, y: size * .9 }];
  ctx.beginPath(); ctx.rect(0, 0, size, size); quad.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = '#071b1399'; ctx.fill('evenodd');
  ctx.beginPath(); quad.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = ready ? '#a7f7a9' : '#ffffffaa'; ctx.stroke();
  ctx.lineWidth = 7; ctx.strokeStyle = ready ? '#a7f7a9' : '#fff'; ctx.lineCap = 'square';
  for (let i = 0; i < 4; i++) {
    const p = quad[i], before = quad[(i + 3) % 4], after = quad[(i + 1) % 4];
    ctx.beginPath();
    for (const [n, neighbor] of [before, after].entries()) {
      const length = Math.hypot(neighbor.x - p.x, neighbor.y - p.y), t = Math.min(.25, 28 / length);
      const x = p.x + (neighbor.x - p.x) * t, y = p.y + (neighbor.y - p.y) * t;
      if (!n) { ctx.moveTo(x, y); ctx.lineTo(p.x, p.y); } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
function checkCamera(request) {
  if (request !== session || !stream || !dialog.open) return;
  if (video.readyState >= 2 && video.videoWidth) {
    const frame = cameraFrame(640), result = assessFrame(frame, { target: cameraTarget, previous: previousCorners });
    const steady = result.valid && previousCorners && result.corners.every((p, i) => Math.hypot(p.x - previousCorners[i].x, p.y - previousCorners[i].y) < frame.width * .025);
    stableFrames = result.valid ? (steady ? stableFrames + 1 : 1) : 0;
    previousCorners = result.valid ? result.corners : null; cameraReady = stableFrames >= 3;
    $('capture').disabled = !cameraReady;
    $('scan-status').textContent = result.valid && !cameraReady ? 'Hold steady…' : result.message;
    drawGuide(result.corners, cameraReady, frame.width);
  }
  cameraTimer = setTimeout(() => checkCamera(request), 350);
}
$('viewfinder').addEventListener('click', e => {
  if (video.hidden || !stream) return;
  const r = $('viewfinder').getBoundingClientRect();
  cameraTarget = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  previousCorners = null; stableFrames = 0; cameraReady = false; $('capture').disabled = true;
  clearTimeout(cameraTimer); checkCamera(session);
});
function setPhoto(image, selectedCorners = null) {
  stopCamera(); session++;
  const width = image.naturalWidth || image.videoWidth || image.width, height = image.naturalHeight || image.videoHeight || image.height;
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  source = Object.assign(document.createElement('canvas'), { width: Math.round(width * ratio), height: Math.round(height * ratio) });
  source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
  corners = selectedCorners ? selectedCorners.map(p => ({ x: p.x * ratio, y: p.y * ratio })) : detectCorners(source); resetScanner(true); drawCrop();
}
for (const id of ['photo', 'native-camera']) $(id).addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (file.size > 35 * 1024 * 1024) return message('Choose a photo smaller than 35 MB.', true);
  const url = URL.createObjectURL(file), image = new Image();
  try { image.src = url; await image.decode(); setPhoto(image); }
  catch { message('Could not open that photo. Try a JPG, PNG or WebP image.', true); }
  finally { URL.revokeObjectURL(url); }
});
$('capture').addEventListener('click', () => {
  if (!video.videoWidth || !cameraReady) return;
  const preview = cameraFrame(640), result = assessFrame(preview, { target: cameraTarget, previous: previousCorners });
  if (!result.valid) { cameraReady = false; stableFrames = 0; $('capture').disabled = true; $('scan-status').textContent = result.message; drawGuide(result.corners, false); return; }
  // Copy before stopping the video stream.
  const photo = cameraFrame(1600), scale = photo.width / preview.width;
  setPhoto(photo, result.corners.map(p => ({ x: p.x * scale, y: p.y * scale })));
});
function drawCrop() {
  crop.width = source.width; crop.height = source.height;
  const ctx = crop.getContext('2d'); ctx.drawImage(source, 0, 0);
  ctx.fillStyle = '#10291c88'; ctx.beginPath(); ctx.rect(0, 0, crop.width, crop.height); corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill('evenodd');
  const factor = crop.width / (crop.getBoundingClientRect().width || 450);
  ctx.strokeStyle = '#d4efc2'; ctx.lineWidth = 2 * factor; ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
  for (const p of corners) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 9 * factor, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#214f40'; ctx.lineWidth = 2 * factor; ctx.stroke(); }
}
function position(e) { const r = crop.getBoundingClientRect(); return { x: (e.clientX - r.left) * crop.width / r.width, y: (e.clientY - r.top) * crop.height / r.height }; }
crop.addEventListener('pointerdown', e => {
  if (controller) return;
  const p = position(e); let best = Infinity;
  corners.forEach((c, i) => { const distance = Math.hypot(c.x - p.x, c.y - p.y); if (distance < best) { best = distance; dragging = i; } });
  if (best > 44 * crop.width / crop.getBoundingClientRect().width) { dragging = -1; return; }
  crop.setPointerCapture(e.pointerId); e.preventDefault();
});
crop.addEventListener('pointermove', e => { if (dragging < 0) return; const p = position(e); corners[dragging] = { x: Math.max(0, Math.min(crop.width - 1, p.x)), y: Math.max(0, Math.min(crop.height - 1, p.y)) }; drawCrop(); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) crop.addEventListener(event, () => { dragging = -1; });
$('rotate').addEventListener('click', () => {
  const turned = corners.map(p => ({ x: source.height - 1 - p.y, y: p.x }));
  const rotated = Object.assign(document.createElement('canvas'), { width: source.height, height: source.width }), ctx = rotated.getContext('2d');
  ctx.translate(rotated.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(source, 0, 0); source = rotated; corners = [turned[3], ...turned.slice(0, 3)]; drawCrop();
});
$('read').addEventListener('click', async () => {
  controller = new AbortController(); const current = controller;
  $('read').disabled = true; $('rotate').disabled = true; $('retake').disabled = true; $('progress').hidden = false;
  try {
    const grid = rectify(source, corners);
    const result = await recognize(grid, (value, text) => { if (current.signal.aborted) return; $('progress').value = value; $('scan-status').textContent = text; }, current.signal);
    current.signal.throwIfAborted();
    if (!result.board.some(Boolean)) throw new Error('Could not read the numbers. Try a sharper photo, or enter them manually.');
    board = result.board; uncertain = result.uncertain; original = null; paint(); closeScanner();
    message(uncertain.size ? 'Check the scan. Amber cells need a closer look. Then solve.' : 'Check the scanned numbers, then solve.');
  } catch (error) {
    if (!current.signal.aborted) { $('scan-status').textContent = error.message || 'Could not read this photo. Try again.'; $('read').disabled = false; $('rotate').disabled = false; $('retake').disabled = false; $('progress').hidden = true; }
  } finally { if (controller === current) controller = null; }
});
paint();
