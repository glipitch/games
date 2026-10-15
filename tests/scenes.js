// Browser-side fixtures with known projective geometry. Kept independent from
// the detector/rectifier so tests can measure the selected physical corners.
export function makeScenes(base64) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onerror = reject;
    image.onload = () => {
      const source = Object.assign(document.createElement('canvas'), { width: 900, height: 900 }), ctx = source.getContext('2d');
      ctx.drawImage(image, 50, 50, 900, 900, 0, 0, 900, 900);
      const original = ctx.getImageData(0, 0, 900, 900);
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 900, 900); ctx.strokeStyle = '#222';
      for (let i = 0; i <= 9; i++) { ctx.lineWidth = i % 3 === 0 ? 5 : 2; ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100, 900); ctx.moveTo(0, i * 100); ctx.lineTo(900, i * 100); ctx.stroke(); }
      ctx.font = '56px Arial'; ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].forEach((n, i) => { if (n !== '0') ctx.fillText(Number(n) % 9 + 1, 50 + i % 9 * 100, 50 + Math.floor(i / 9) * 100); });
      const alternate = ctx.getImageData(0, 0, 900, 900);
      function scene(boards, border = false, resolution = 640) {
        const c = Object.assign(document.createElement('canvas'), { width: resolution, height: resolution }), dc = c.getContext('2d');
        const output = dc.createImageData(resolution, resolution); output.data.fill(255);
        const corners = [];
        for (const { x: cx, y: cy, width, height = width, angle = 0, g = 0, h = 0, second = false } of boards) {
          const t = angle * Math.PI / 180, a = Math.cos(t) * width, b = -Math.sin(t) * height, d = Math.sin(t) * width, e = Math.cos(t) * height;
          corners.push([[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([u, v]) => ({ x: cx + (a * u + b * v) / (1 + g * u + h * v), y: cy + (d * u + e * v) / (1 + g * u + h * v) })));
          const pixels = second ? alternate.data : original.data;
          for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
            const X = x * 640 / resolution - cx, Y = y * 640 / resolution - cy, A = a - X * g, B = b - X * h, D = d - Y * g, E = e - Y * h, det = A * E - B * D;
            const u = (X * E - B * Y) / det, v = (A * Y - X * D) / det;
            if (u < -.5 || u >= .5 || v < -.5 || v >= .5) continue;
            const src = (Math.floor((v + .5) * 900) * 900 + Math.floor((u + .5) * 900)) * 4, dst = (y * resolution + x) * 4;
            output.data[dst] = pixels[src]; output.data[dst + 1] = pixels[src + 1]; output.data[dst + 2] = pixels[src + 2];
          }
        }
        dc.putImageData(output, 0, 0);
        if (border) { dc.strokeStyle = '#222'; dc.lineWidth = 3; dc.strokeRect(15, 15, 610, 610); }
        return { data: c.toDataURL().split(',')[1], corners };
      }
      const scenes = {};
      for (const angle of [-40, -25, 25, 40]) scenes['angle' + angle] = scene([{ x: 320, y: 320, width: 390, angle }]);
      scenes.perspective = scene([{ x: 320, y: 320, width: 290, height: 280, angle: -25, g: .45, h: .25 }]);
      const pair = [{ x: 210, y: 320, width: 240, angle: 20 }, { x: 500, y: 320, width: 230, angle: -10, second: true }];
      scenes.two = scene(pair); scenes.two.captureData = scene(pair, false, 1280).data;
      scenes.clippedNeighbor = scene([{ x: 220, y: 400, width: 250, angle: 20 }, { x: 650, y: 150, width: 420, second: true }]);
      scenes.pageBorder = scene([{ x: 320, y: 320, width: 360, angle: -20 }], true);
      scenes.touchingDiagram = scene([{ x: 560, y: 130, width: 300, angle: 18, second: true }, { x: 320, y: 380, width: 400, angle: -2 }]);
      // The foreground puzzle is drawn last over a clipped background diagram.
      scenes.touchingDiagram.corners.reverse();
      resolve(scenes);
    };
    image.src = 'data:image/png;base64,' + base64;
  });
}
