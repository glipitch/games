# sudoku recognition benchmark

Regression measurements using real photographs, alongside the generated browser fixtures. These datasets were used during development; the results measure regression performance on these cases.

The original 45-photo comparison below is retained. The default test suite now includes these photos plus 20 additional labelled photos, enforces accuracy regressions, and measures automatic eligibility: [current 65-photo checks and limitations](automatic-recognition.md).

## Sources

- [Baptiste Wicht and Jean Hennebert's sudoku dataset](https://github.com/wichtounet/sudoku_dataset): all 40 photographs in `v2_test`, with cell labels and annotated corners. Revision `0db6de036b80b4e8e4574abe6e15026331bd5c2c`. Images and labels are CC-BY-4.0; see the upstream attribution and research references.
- [ArmandNM's sudoku-vision dataset](https://github.com/ArmandNM/sudoku-vision): all five classic photographs, including three with occupied/empty-cell labels. Revision `9dbb391cf54784a3a76d43a237c6a2d3a3f5007d`. The two test photographs have no ground-truth digit labels, so they are not scored for digit accuracy. Assets are downloaded locally for testing.
- The user-reported newspaper photo was also checked locally: photo import and camera-region capture both selected the main grid, matched all 81 manually transcribed cells, and solved the puzzle. That photo is not included in the repository.

## Results

| Measurement | Before | After |
| --- | ---: | ---: |
| Correct grid corners, Wicht set | 35 / 40 | 36 / 40 |
| Entire puzzle read exactly, Wicht set | 9 / 40 | 18 / 40 |
| Correct given digits, Wicht set | 842 / 1,156 (72.8%) | 1,021 / 1,156 (88.3%) |
| False digits in empty cells, Wicht set | 16 | 9 |
| Exact occupied/empty-cell maps, labelled Armand set | 3 / 3 | 3 / 3 |

A grid matches the corner annotations when the largest nearest-corner error is at most 5% of the mean annotated edge length. An exact puzzle requires all 81 cells, including blanks, to match. Given-digit accuracy counts every labelled given, including images where grid detection fails. Occupancy accuracy checks whether a cell contains a number, independently of which number was read.

The camera quality gate accepted 26 of the 45 static photographs after the change. This is a separate measure: it can reject photos with blur or corners close to the image boundary even when the import path can recover their grid.

## Remaining limitations

Four of the 40 annotated photos still have inaccurate automatic corners. Twenty-two of the 40 require at least one cell correction for an exact read. Blur, faint print, detached strokes, and marks in empty cells remain difficult. Review the editable scan before solving; OCR confidence does not catch every error.

The raw case results include failures, predicted digits, uncertainty flags, orientation, and corner errors: [before](benchmarks/before.json), [after](benchmarks/after.json). The after report records the SHA-256 of the tested `vision.js`; `baseRevision` records the repository HEAD at test time.

## Reproduce

Start the local server, then run:

```sh
pnpm test:datasets
```

The script fetches pinned source assets and scores all 45 photos. `PLAYWRIGHT_CHANNEL=chrome` selects an installed Chrome, and `TEST_URL` selects a deployed site. Reports and downloaded images are written under `test-results/datasets/`. `--detect-only` skips OCR; `--only=image18,image1041` runs specific cases while debugging.
