# sudoku performance

These measurements describe the manual read optimization. The camera also now continuously captures and processes photos in the background with additional verification; see [automatic recognition and camera timings](automatic-recognition.md).

Measured against revision `0694432`, before the scanner reuse and recognition optimizations. Chrome on the same desktop, local server, fresh browser context per version, two consecutive reads per photograph. Chrome's main thread was throttled by 4; this does not emulate a particular phone or throttle the OCR worker. No network throttling. These are small regression measurements, not device-wide speed guarantees.

| Photograph | Before, mean read | After, mean read | Reduction | OCR calls before → after |
| --- | ---: | ---: | ---: | ---: |
| OpenCV printed puzzle | 882 ms | 526 ms | 40% | 58 → 26 |
| Wicht image18, upright | 1,049 ms | 500 ms | 52% | 64 → 35 |
| Wicht image1041, rotated | 1,198 ms | 1,011 ms | 16% | 61 → 60 |
| All six reads | 1,043 ms | 679 ms | 35% | |

The first read includes engine initialization. Subsequent reads reuse one worker. The application also starts loading when camera capture or photo selection begins, overlapping first-time initialization and downloads with framing and alignment; that overlap is not credited in these timings. First-time assets still need to download, approximately 7 MB. Manual entry does not load the scanner.

Solving these boards averaged below 0.5 ms per call in both versions. OCR is the visible delay. Difficult puzzles can take longer to solve.

The scanner caches the upright orientation samples instead of reading them twice. It stops checking orientations only when their best possible remaining confidence cannot change the chosen result. It retains all rotation checks on ambiguous images. Binary glyphs are written in one image-data operation instead of thousands of individual canvas drawing calls.

All 45 public-dataset cases produced identical boards, uncertainty flags, orientations, grid-match results, and camera acceptance to the previous version. This preserves existing recognition limits: 18/40 fully correct labelled boards and 1,021/1,156 correct clues. See [accuracy and sources](recognition-benchmark.md). The supplied newspaper photo also remained correct in all 81 cells through import and simulated camera capture, and solved successfully. That private photo is not published.

Raw timing results: [before](benchmarks/performance-before.json), [after](benchmarks/performance-after.json). Both record the tested source hash. Full current dataset results: [45 photographs](benchmarks/after.json).

To reproduce, start the local server and download the datasets once with `pnpm test:datasets`. Then:

```sh
pnpm test:performance -- --cpu=4
pnpm test:recognition
```

The performance script also accepts `--vision=path/to/previous-vision.js` and `--report=path.json`. The dataset runner accepts the same options to compare previous code. Overrides are installed before the application imports its modules. Cancellation checks cover engine startup, orientation and digit reading, followed by immediate retries and all four rotations using the same worker.
