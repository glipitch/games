# sudoku automatic recognition

The camera continually captures complete, clear puzzle photos while OCR runs in a background worker. Each captured photo and its corners are immutable. Moving the camera, changing puzzles, or pausing the live video does not invalidate a photo already captured.

One OCR job runs at a time, with room for two more photos waiting. Capture pauses only when these slots are full, then resumes as work completes. Every admitted photo is processed in capture order until a success or explicit cancellation. There is no growing history of old video frames. The first verified success displays the solution and stops the camera. Back to puzzle restores the original captured clues.

A photo succeeds only when it has a complete read, no uncertain clues, at least 17 detected clues, confidence of 75 or higher, agreement from at least two OCR views for every clue, and exactly one solution. The views use grayscale, binary extraction, and, when needed, resampled grayscale. Verification never changes clues to force a solution. There is no requirement for the current live view to match the photograph.

## Dataset checks

The default `pnpm test` and GitHub Actions include 65 public photographs. Sixty have full digit labels; three others have occupancy labels and two have no digit labels. The original 45 are retained, plus 20 previously unused labelled photos from the [Wicht dataset](https://github.com/wichtounet/sudoku_dataset), selected evenly by filename before evaluating their automatic outcomes. Names are frozen in `tests/fixtures/holdout.json`. No model is trained on these images.

The frozen regression baseline uses revision `12da1d4`. The gate protects every previously correct cell, including blanks, existing grid detection and camera acceptance, and correct occupancy maps. It rejects wrong automatic solutions on labelled photos and loss of established verified automatic candidates. An intentionally injected wrong digit was confirmed to fail this gate.

| Measurement | Before | After |
| --- | ---: | ---: |
| Exact boards, 60 labelled photos | 31 | 31 |
| Correct clues | 1,571 / 1,728 | 1,571 / 1,728 |
| False digits in empty cells | 9 | 9 |
| Matched grids | 56 / 60 | 56 / 60 |
| Exact labelled occupancy maps | 3 / 3 | 3 / 3 |
| Verified automatic candidates | unavailable | 10 / 60 |
| Wrong automatic candidate solutions | unavailable | 0 |

For every photo accepted by the camera quality check, the runner also processes two subpixel-shifted captures independently. Every accepted result must match the labelled solution. These simulate capture variations; they do not constitute physical-phone tests. Confidence and multiple OCR views do not guarantee correctness for unseen images. Uncertain photographs still need review.

The supplied newspaper photo continues to match all 81 cells through import and manual camera capture. Its ambiguous marks cause automatic mode to decline. It is private and is not included in the repository or CI artifacts.

## Camera checks

`pnpm test:automatic` drives the actual app with a changing canvas video stream. It checks that captures continue while OCR runs, admitted photos are processed in order, the waiting queue stays bounded, and blank, blurred, clipped and conflicting photos cannot modify the board. It explicitly captures a valid puzzle, turns the live view blank and pauses it, and verifies that the already captured photo still solves correctly. It also tests immediate cancellation/reopening, small simulated hand movements, sideways orientation, and an OpenCV photograph.

First use can take longer while approximately 7 MB of local scanner assets download. Timing results are from a simulated camera in desktop Chrome and do not guarantee phone performance.

The current desktop camera checks solved the captured-then-moved puzzle in about 1.3 seconds, a sideways puzzle in about 1.6 seconds, and the photographed puzzle in about 0.9 seconds. These measurements include processing and display after the scanner has warmed up.

Raw results: [65 original photos and capture variations](benchmarks/automatic.json), [additional 20 baseline photos](benchmarks/holdout-before.json), [camera test timings](benchmarks/automatic-camera.json). Reports record source hashes. See [source attribution and original recognition limits](recognition-benchmark.md).
