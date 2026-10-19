# Little Clicks

Nine browser games with daily challenges, free play, browser-local progress and spoiler-free results. These now form part of [games](https://glipitch.github.io/games/), alongside sudoku. The root collection gives every game an equal place in its navigation; these source files remain independently playable.

Run `node server.mjs` and open http://127.0.0.1:4173/games.html. Set the PORT environment variable to use another port. Run `npm test` or `node --test tests.mjs signal-tests.mjs arcade-tests.mjs circuit-tests.mjs spider-tests.mjs`. Checks cover puzzle generation, solvability, undo, exact arithmetic, hints, persistence and date boundaries. No installation or build step is needed.

The six additions use `/play.html?game=<id>`:

| ID | Game | Mechanic |
| --- | --- | --- |
| shift | Shift | Reach a target through valid one-letter word changes. |
| quartet | Quartet | Group sixteen words into four connected sets. |
| weave | Weave | Trace four clued words through adjacent letter tiles. |
| flip | Flip | Turn all lights off by toggling a tile and its neighbours. |
| slide | Slide | Restore a solvable 3×3 sliding puzzle. |
| twentyfour | Twenty Four | Combine four numbers with arithmetic to make exactly 24. |

New games share an interface and save independently. Procedural generators use a stable date seed for dailies and random seeds for free play. Shift uses a curated dictionary, Quartet a curated category pool, and Weave a clue library. Flip uses a binary linear solver, Slide uses A* search, and Twenty Four uses exact rational arithmetic. These games can generate many different combinations; their finite word and category pools should continue to receive editorial review.

Circuit (formerly Glimwire/Signal) is at `/circuit.html`. Select `?variant=classic`, `wrap`, `locked`, or `split`. Classic connects one network. Wrap allows opposite edges to connect. Locked supplies fixed tiles in their correct orientation. Split generates two tree regions with separate A/B sources; cross-region connections are marked as shorts. All modes have known valid solutions; uniqueness is not checked. Each mode has its own daily 4×4, free-play 3×3/4×4/5×5, undo, hints, saved progress, streak and sharing. The original Classic puzzle sequence is retained.

The shared `compact.css` removes large marketing areas and improves contrast across all games. Flip uses bright ON bulbs with rays and dark OFF bulbs with a slash, plus a state badge and accessible pressed state. Circuit uses bright powered tiles, dark disconnected tiles, A/B labels, padlocks and cross-network error marks.

The root build script combines `dist` with Sudoku and the collection shell for GitHub Pages. The daily boundary is midnight in Europe/London. Daily and practice mode use the same hand-edited library of 100 bridges, so this prototype's content repeats. Expand and editorially review the library before a broad public launch. Local data has no account or cloud synchronisation.

Old `/signal.html` and `/glimwire.html` links redirect to Circuit. Circuit reads legacy `signal:v1` progress as a fallback, then saves independently under `circuit:v2:<variant>` so older open tabs cannot overwrite the new mode data.


Spider Solitaire is at `/spider.html`: 104 cards, four copies of each spade and heart rank. Ten columns start 6/6/6/6/5/5/5/5/5/5 with 50 stock cards in five rows. Build down regardless of suit, but move only descending runs in a single suit; empty columns take any run. Complete suited King-to-Ace sequences clear automatically. All columns must be occupied before dealing. Tap or drag, with highlighted hints, undo (including deals and cleared sequences), saved progress and all ten columns visible on small screens. New deals are shuffled, with no guarantee of solvability. Score starts at 500, subtracts one per move/deal and adds 100 per cleared run.

Spider uses an original deck: six high-resolution generated court illustrations with deterministic mirrored counterparts, vector serif indices, traditional vector pip layouts and fine grey frames. All faces and backs share the reference deck's 146:198 proportions. Portrait sources and prompts are retained in `asset-sources/courts/`, with comparison findings in `asset-sources/card-research.md`; the prior LGPL artwork is archived in `asset-sources/legacy-deck/`. `build-spider-cards.mjs` emits self-contained SVG faces with embedded high-resolution portraits. It uses Sharp from the local workspace runtime. The collection uses a restrained green table and an original navy-and-gold SVG back. All ten columns fit in portrait, landscape, and desktop layouts. Narrow screens display legible rank-and-suit faces with 24-pixel exposed rank strips; wider screens show the illustrated faces at their original proportions. Card illustrations load only when visible. ResizeObserver and viewport events reflow stacks without changing the deal. The previous zoom and scrolling-table controls have been removed. `spider-layout-tests.mjs` covers containment, touch widths, exposed ranks and long stacks across screen sizes.
