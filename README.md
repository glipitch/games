# sudoku

A minimal camera-based sudoku solver for desktop and mobile browsers.

Scan a printed puzzle with the camera or upload a photo. Adjust the four grid corners, read the numbers, correct anything that needs attention, and solve. You can also type clues or paste an 81-character puzzle using `0` or `.` for empty cells.

- Responsive layout and touch-friendly corner adjustment.
- Compact controls and a live camera outline that turns green when the complete grid is clear and steady. Capture stays disabled for missing, clipped, blurred, or unsteady grids. This checks framing and image quality; digit accuracy and puzzle solvability are checked after scanning.
- Automatic grid detection, perspective correction, and local grid-line alignment for curved paper.
- Finds angled grids among nearby puzzles. Centre the intended puzzle or tap it in the camera preview; capture and rotation keep that selection.
- Browser-only OCR; photos are never uploaded or saved by the app.
- Highlights duplicate clues and uncertain scan results.
- Detects puzzles with no solution or more than one solution.
- Keyboard arrows to navigate; Delete to clear; Enter to solve.

## Run locally

Requires Node.js 22 or newer for the development scripts. No install or build is needed to run the website.

```sh
node scripts/serve.mjs
```

Open <http://127.0.0.1:4173>. The website itself needs only a modern browser. Camera access requires HTTPS or localhost and browser permission. If a camera is unavailable, upload a photo instead. Clear, well-lit photos of printed digits work best; always review the scan before solving. Handwriting, pencil marks, glare, and heavily curved paper may need manual corrections.

## GitHub Pages

Publish the `main` branch from `/` in **Settings → Pages → Deploy from a branch**. All paths are relative, so the app works at a project URL such as `https://glipitch.github.io/sudoku/`.

This is a static site with no server, API keys, analytics, or third-party runtime requests. The scanner lazily loads its bundled OCR engine and English model from the same origin (about 7 MB on first scan). Manual entry and solving do not load OCR assets.

## Checks

```sh
node --test tests/solver.test.js
```

For browser checks, install development dependencies with `pnpm install`, install Chromium with `pnpm exec playwright install chromium`, and start the local server. Then run `pnpm test:browser`. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Google Chrome instead, or `TEST_URL` to check a deployed site. Browser checks cover solving, correction, desktop and mobile layout, camera readiness and lifecycle with a changing video feed, rejection of cropped/blurred/incorrect grids, printed and photographed puzzle recognition, and absence of external network requests.

## Credits

OCR uses [Tesseract.js 7.0.0](https://github.com/naptha/tesseract.js) and [Tesseract.js-core 7.0.0](https://github.com/naptha/tesseract.js-core), with the English integer model from [`@tesseract.js-data/eng` 1.0.0](https://www.npmjs.com/package/@tesseract.js-data/eng). These are included under the Apache 2.0 license; see `vendor/` for licenses and source details. The photographed test fixture is from [OpenCV](https://github.com/opencv/opencv/blob/4.x/samples/data/sudoku.png), also under Apache 2.0.
