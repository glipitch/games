# games

Ten browser games in a compact collection: Circuit, Flip, Quartet, Shift, Slide, Snapword, Spider, sudoku, Twenty Four, and Weave. Each has an equal place in the Games menu. Circuit's Classic, Wrap, Locked, Split, Mesh and Barriers modes stay together. The current game gets the full screen width; game choices, theme and collection help open from a small Games button.

Published at https://glipitch.github.io/games/.

Run `npm run build`, then `npm start`. Open http://127.0.0.1:4173/games/. No build dependencies are required. `npm test` checks all game engines. `npm run test:site` checks the built collection with Playwright (installed under `sudoku/node_modules`). Set `TEST_URL` to test a deployed copy.

Source games are in `snapword/dist/` and `sudoku/`. The build adds collection navigation support and adjusts shared links for the Pages project path, while retaining the standalone games. It bundles the Sudoku OCR engine and model locally. Photos stay in the browser. Progress is browser-local; data from the former Sudoku URL remains on the same GitHub Pages origin.

GitHub Actions tests the games, builds `_site/`, and deploys that directory to GitHub Pages. Development files, research material, test photos, and local tooling are excluded from the published site. The previous Sudoku Git history is retained in this repository.

See `snapword/README.md` and `sudoku/README.md` for individual game details and the scanner's fuller regression checks.

The collection supports a persistent light/dark theme (defaulting to the device preference) and portrait/landscape layouts. Navigation stays out of the playing view by default, with keyboard-accessible dialogs and Escape to return to the game. DM Sans and Manrope are bundled under `assets/fonts/`, including their SIL OFL licenses and pinned source provenance. No external font requests are needed.

Circuit has one unlimited play experience: six modes and every square size from 3×3 through 10×10. Each mode and size saves independently, including undo history. Its default view centres the board with Undo and Hint. The mode/size summary opens puzzle settings for all modes, sizes, zoom, new/restart and rules. The board fits the available screen by default; optional zoom and scrolling remain available for large puzzles. Hints explain forced orientations where possible, otherwise reveal an orientation from a known solution. Multiple valid solutions are accepted; uniqueness and difficulty are not certified. Completed puzzles share a reproducible mode/size/seed link, including the collection path. Shared-puzzle progress is separate from regular boards. Unfinished legacy Circuit/Signal saves are copied into the new format without modifying the originals. `npm run test:circuit` checks the expanded game in the browser.

The other word and logic games offer Daily puzzles, shared by all players for a London calendar day and refreshed at midnight. Free play supplies extra puzzles with separate progress and no effect on daily streaks. A short explanation appears beneath their mode tabs. Spider uses shuffled deals; Sudoku uses the puzzle supplied by the player.

Spider keeps all ten columns visible at every screen width, without score, move or time counters. Narrow screens use larger stacked ranks and suits, with enough exposed space to read both; wider tables use the original illustrated SVG deck with enlarged corner suits. Both views share bold vector rank lettering that stays sharp without relying on font loading. Mobile margins leave more room for cards. Vertical scrolling and pinch zoom remain available, with horizontal panning and overscroll suppressed. Only width changes recalculate the table, keeping it steady when mobile browser controls resize the viewport. Completed runs gather into a packet and travel to the upper tray, with a short suit confirmation and a static alternative for reduced motion. Existing game saves remain compatible. Run `node tests/spider-site.mjs` for touch scrolling, drag, rotation and saved-game checks.
