# games

Ten browser games in a compact collection: Circuit, Flip, Quartet, Shift, Slide, Snapword, Spider, sudoku, Twenty Four, and Weave. Each has an equal place in the index. Circuit's Classic, Wrap, Locked, and Split variations stay together. On small screens, a game selector leaves the full width for playing.

Published at https://glipitch.github.io/games/.

Run `npm run build`, then `npm start`. Open http://127.0.0.1:4173/games/. No build dependencies are required. `npm test` checks all game engines. `npm run test:site` checks the built collection with Playwright (installed under `sudoku/node_modules`). Set `TEST_URL` to test a deployed copy.

Source games are in `snapword/dist/` and `sudoku/`. The build adds collection navigation support and adjusts shared links for the Pages project path, while retaining the standalone games. It bundles the Sudoku OCR engine and model locally. Photos stay in the browser. Progress is browser-local; data from the former Sudoku URL remains on the same GitHub Pages origin.

GitHub Actions tests the games, builds `_site/`, and deploys that directory to GitHub Pages. Development files, research material, test photos, and local tooling are excluded from the published site. The previous Sudoku Git history is retained in this repository.

See `snapword/README.md` and `sudoku/README.md` for individual game details and the scanner's fuller regression checks.

The collection now supports a persistent light/dark theme (defaulting to the device preference), a collapsible desktop game index, and portrait/landscape layouts. DM Sans and Manrope are bundled under `assets/fonts/`, including their SIL OFL licenses and pinned source provenance. No external font requests are needed.

Daily puzzles are shared by all players for a London calendar day and refresh at midnight. Free play supplies extra puzzles with separate progress and no effect on daily streaks. A short explanation appears beneath the mode tabs. Spider instead uses shuffled deals; Sudoku uses the puzzle supplied by the player.

Spider keeps all ten columns visible at every screen width. Narrow screens use compact rank-and-suit faces with 24-pixel exposed rank strips; wider tables use the original illustrated SVG deck. The navy-and-gold vector backs and restrained green table replace the web motif. Resize and sidebar collapse recalculate the table without changing the deal. Existing game saves remain compatible.
