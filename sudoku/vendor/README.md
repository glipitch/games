# sudoku third-party assets

All recognition assets are served locally. No CDN request is made at runtime.

| Files | Source | Version | License |
| --- | --- | --- | --- |
| `tesseract.min.js`, `worker.min.js` | https://github.com/naptha/tesseract.js | 7.0.0 | Apache 2.0, `TESSERACT-LICENSE.md` |
| `core/*-lstm.wasm.js` | https://github.com/naptha/tesseract.js-core | 7.0.0 | Apache 2.0, `core/LICENSE` |
| `data/eng.traineddata.gz` | https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz | 1.0.0 | Apache 2.0, `data/LICENSE` |

The three core builds provide scalar, SIMD, and relaxed SIMD support. The worker selects the supported build automatically. Each JavaScript core file embeds its WebAssembly payload.
