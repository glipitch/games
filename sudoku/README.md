# sudoku

A minimal camera-based sudoku solver for desktop and mobile browsers.

Start with **Scan puzzle** or **Upload photo**. The grid appears only after a scan. Camera photos are captured continuously and processed in the background; the first verified success shows the solution. Moving the camera does not cancel photos already taken. For uploaded or manually captured photos, adjust the four grid corners and choose **Solve photo**. Verified scans go straight to the solution; uncertain scans show the numbers for correction before solving. **Start again** returns to the opening screen. You can also paste an 81-character puzzle using `0` or `.` for empty cells, then edit its clues.

- Responsive layout and touch-friendly corner adjustment.
- Compact controls and a live camera outline that turns green when the complete grid is clear and steady. **Take photo** is available as soon as video arrives; framing advice never locks the manual shutter. Automatic capture still requires a complete, clear grid, and uncertain photos need review.
- Visible reading/loading feedback immediately after **Solve photo**, with photo controls kept on screen on phones. The preview focuses on the selected grid in tall photos, with room to adjust its corners. Failed downloads and stalled reads restore the controls for retry instead of leaving a disabled button indefinitely.
- Automatic grid detection, perspective correction, and local grid-line alignment for curved paper.
- Finds angled grids among nearby puzzles. Centre the intended puzzle or tap it in the camera preview; capture and rotation keep that selection.
- Separates touching grid outlines using the pattern of enclosed cells, and checks digit orientation automatically.
- Suppresses screen stripe patterns before OCR when background noise is detected.
- Browser-only OCR; photos are never uploaded or saved by the app.
- Warms the scanner while framing a photo and reuses its engine and orientation samples for faster reading.
- Automatic solving checks a captured photo's quality, agreement between OCR views for every clue, and a unique solution. Captures are processed in order with at most two waiting photos. It never changes clues to force a solution. Back to puzzle restores the scanned clues.
- Highlights duplicate clues and uncertain scan results.
- Detects puzzles with no solution or more than one solution.
- Keyboard arrows to navigate; Delete to clear; Enter to solve.

## Run locally

Requires Node.js 22 or newer for the development scripts. No install or build is needed to run the website.

```sh
node scripts/serve.mjs
```

Open <http://127.0.0.1:4173>. The website itself needs only a modern browser. Camera access requires HTTPS or localhost and browser permission. If a camera is unavailable, upload a photo instead. Clear, well-lit photos of printed digits work best. Handwriting, pencil marks, glare, and heavily curved paper may need manual corrections; **Back to puzzle** shows the original clues after solving.

## GitHub Pages

Sudoku is part of [games](https://glipitch.github.io/games/#sudoku). The repository's GitHub Actions workflow builds and deploys the collection, including this folder and its bundled OCR files. All paths remain relative, and the standalone solver is available at `https://glipitch.github.io/games/sudoku/`.

This is a static site with no server, API keys, analytics, or third-party runtime requests. The scanner lazily loads its bundled OCR engine and English model from the same origin (about 7 MB on first scan). Manual entry and solving do not load OCR assets.

## Checks

`pnpm test` starts its own local server and runs unit, browser, usability, cancellation, automatic-camera, and dataset regression checks. Install development dependencies and a Playwright browser first. `pnpm test:unit` runs only the fast unit tests. The same full suite runs in GitHub Actions on every push and pull request.

For browser checks, install development dependencies with `pnpm install`, install Chromium with `pnpm exec playwright install chromium`, and start the local server. Then run `pnpm test:browser`. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Google Chrome instead, or `TEST_URL` to check a deployed site. Browser checks cover solving, correction, desktop and mobile layout, camera readiness and lifecycle with a changing video feed, rejection of cropped/blurred/incorrect grids, printed and photographed puzzle recognition, and absence of external network requests.

`pnpm test:datasets` downloads and checks 65 real photographs from two pinned public datasets: the original 45 plus 20 additional labelled photos selected before evaluating automatic recognition. It requires `tar` for the first download. Images are cached under the ignored `test-results/datasets/` directory. Each run compares the frozen previous scanner and current scanner in the same browser. It fails on any previously correct cell becoming wrong, loss of existing grid detection or camera acceptance, loss of a correct occupancy map, or a wrong automatic solution on a labelled photo or capture variation. See [the benchmark results and limitations](docs/recognition-benchmark.md) and [automatic recognition checks](docs/automatic-recognition.md).

`pnpm test:photo` checks a local photo against `TEST_EXPECTED` (81 digits, `0` for blanks), with its path in `TEST_PHOTO`. Optional `TEST_CAMERA_CROP=x,y,width,height` also feeds that image region through the camera capture flow. These tests do not upload the photo.

`pnpm test:recognition` checks cancellation and immediate retry during scanner startup, orientation detection, and digit reading, plus worker reuse across all four rotations. `pnpm test:performance` records reading time, OCR call counts, initialization time, and solving time for three photographs. See [timing measurements](docs/performance.md).

`pnpm test:usability` checks failed scanner downloads, stalled loading and OCR jobs, successful retries in the same photo, manual capture without a detected grid, immediate busy feedback, and visible controls on portrait photos. Loading has a 45-second deadline and each reading attempt a 60-second deadline; cancellation remains available throughout. Timeout tests advance the browser clock rather than waiting a minute.

`pnpm test:automatic` supplies a changing camera feed and tests capture while OCR is busy, capture order and queue limits, solving an already taken photo after the live view changes or pauses, sideways puzzles, a photographed puzzle, cancellation, and rejection of blank, clipped, blurred and conflicting grids. No capture/read/solve buttons are used for successful automatic scans.

## Credits

OCR uses [Tesseract.js 7.0.0](https://github.com/naptha/tesseract.js) and [Tesseract.js-core 7.0.0](https://github.com/naptha/tesseract.js-core), with the English integer model from [`@tesseract.js-data/eng` 1.0.0](https://www.npmjs.com/package/@tesseract.js-data/eng). These are included under the Apache 2.0 license; see `vendor/` for licenses and source details. The photographed test fixture is from [OpenCV](https://github.com/opencv/opencv/blob/4.x/samples/data/sudoku.png), also under Apache 2.0.
