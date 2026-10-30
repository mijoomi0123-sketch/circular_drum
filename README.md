# Circular Drum

An interactive audiovisual art studio: concentric-circle artworks that swell
and settle like water droplets in time with real drum samples.
Runs only on your own computer. No deployment, hosting or upload involved.

## 1. Install

Requires **Node.js 18 or newer** (https://nodejs.org).

```bash
cd circular-drum
npm install
```

## 2. Start

```bash
npm run dev
```

Open **http://localhost:5173/** in Chrome, Edge, Safari or Firefox.
Stop the server with `Ctrl + C`.

Optional production build, served locally:

```bash
npm run build      # type-check + build into dist/
npm run preview    # serves dist/ at http://localhost:4173/
```

Other commands: `npm test` (unit tests), `npm run check:samples`
(verifies every configured sample exists in `public/audio/`).

## 3. Using it

**Library (first screen).** An 8-column grid (64 artworks per page; page
buttons appear below when there are more). Fewer columns on smaller
screens. Each item is a circular artwork and a small play button.
- Click the **play button** to preview the artwork's sound (one bar). You
  stay on the library, and that thumbnail's four circles move with the sound.
  Click it again to stop.
- Click the **artwork** to open it.
- The round **+** button (top right) creates a new artwork with its own
  settings and opens it. Existing artworks are never changed.

**Artwork screen.**
- **BPM** slider (40–200, starts at 120): one tempo for all four
  instruments. One step = a sixteenth note.
- **Steps** slider (1–32, starts at 16): length of the cycle, the same for
  all four rows.
- **Step rows** for Kick, Snare, Hi-hat and Clap: click a cell to switch
  that step on or off for that instrument only. The outlined column is the
  step being heard right now. Every fourth cell has a darker frame (a beat).
- **Instrument colors**: the round swatch at the start of each row opens the
  seven colors for that instrument only. The color sets that instrument's
  circle *and* which color group's sample it plays (e.g. Snare on blue plays
  `04-2-스네어.wav`). Groups 03, 04 and 06 have a cymbal instead of a clap;
  with those colors the Clap row plays the cymbal and shows "(cymbal)".
- **Play / Stop / Loop**. With Loop off, one cycle plays and stops.
- **Save** stores the settings for this artwork (button shows "Saved" when
  nothing has changed). Leaving with unsaved changes asks first.
- **⋯ menu**: Rename (or double-click the title), Duplicate, Delete (asks
  for confirmation).
- **‹** returns to the library.

There are no volume controls; every instrument plays at a fixed, balanced
level.

Nothing ever plays automatically. The browser only allows sound after a
click, so audio starts on your first Play or preview.

## 4. Audio files and color mapping

Samples live in **`public/audio/`**. The list of files and how they are
read is in one place: **`src/audio/sampleConfig.ts`**.

The number at the start of a filename picks the color (01 and 1 are the
same group):

| Number | Color  | Hex     | Files |
|-------:|--------|---------|-------|
| 01 | Orange | #C98668 | 킥, 스네어, 하이햇, 클랩 |
| 02 | Yellow | #C7B56F | 킥, 스네어, 하이햇, 클랩 |
| 03 | Green  | #568C72 | 킥, 스네어, 하이햇, 심벌 |
| 04 | Blue   | #6686A7 | 킥, 스네어, 하이햇, 심벌 |
| 05 | Pink   | #B87991 | 킥, 스네어, 하이햇, 클랩 |
| 06 | Purple | #8975A3 | 킥, 스네어, 하이햇, 심벌 |
| 07 | Brown  | #8A7059 | 킥, 스네어, 하이햇, 클랩 |

The instrument comes from the word in the filename: 킥 = kick,
스네어 = snare, 하이햇 = hi-hat, 클랩 = clap, 심벌 = cymbal (English words
like `kick`, `snare`, `hat`, `clap`, `cymbal` also work). A file whose
instrument can't be recognised is **not guessed**: it is reported, and you
assign it in `INSTRUMENT_OVERRIDES` in the same config file.

To add or replace a sample: put the file in `public/audio/`, add its name to
`SAMPLE_FILES`, run `npm run check:samples`, reload the page.

If a configured file is missing or can't be decoded, the app shows a notice
naming the file and that sound stays silent. Nothing is substituted.

## 5. Four instruments, four circles

Each artwork is exactly four concentric circles, one per instrument. The
mapping lives in `src/audio/channels.ts`:

| Row    | Circle | Color shade | Plays |
|--------|--------|-------------|-------|
| Kick   | filled disc | the Kick color | 킥 of the Kick color's group |
| Snare  | filled disc | a lighter shade of the Snare color | 스네어 of the Snare color's group |
| Hi-hat | thin open circle | the Hi-hat color (another shade if it lies on a disc of that exact color) | 하이햇 of the Hi-hat color's group |
| Clap   | filled disc | a deeper shade of the Clap color | 클랩 (or 심벌 for green, blue, purple) of the Clap color's group |

### Circle sizes follow the step rows

Each circle's size comes from how many steps its row has on, compared with
the other rows (`src/presets/sizing.ts`). Only the rows and the Steps value
count; BPM, colors and the playhead never change a size.

```
ratio    = activeSteps / steps
relative = ratio / (ratio of the busiest row)        0 when every row is empty
density  = 0.6 × relative + 0.4 × √ratio
f        = 0.1 + 0.68 × density + bias               bias: Kick .15, Snare .10, Hi-hat .05, Clap 0
radius   = 14 + (86 − 14) × f                        (artwork radius is 100)
```

Then, largest first, each circle is kept at least 6 units inside the next
larger one, and none goes below 14. So equal counts always give
Kick > Snare > Hi-hat > Clap, more steps give a bigger circle (with 16 steps,
Snare 8 beats Kick 4), and an empty row still shows a small circle. Larger
circles are drawn first so smaller discs sit on top. When a row changes, the
circles glide to their new sizes (critically damped, about one second, no
bounce), also during playback. Sizes are never stored; they are recalculated
from the saved rows.

A circle only reacts to its own row's hits and swells around its current
size, then settles back to it, so hits on the same step move their circles
together. Each has its own motion:
- **Kick**: deep swell that springs back once slightly below rest.
- **Snare**: sharp, quick snap with a bright flash.
- **Hi-hat**: light, fast shimmer; the outline thickens and brightens.
- **Clap**: broad, short burst with a smooth glide back.

Audio path: `sample → Kick | Snare | Hi-hat | Clap bus → master → speakers`
(all at fixed levels).

## 6. How rhythm and animation stay in sync

- Each artwork stores four rows of 32 steps; the Steps setting says how many
  play. Shortening and lengthening the cycle never loses edits.
- Audio is scheduled with a lookahead scheduler on `AudioContext.currentTime`.
  Every scheduled sound also emits an event with the same audio time; the
  circles and the playhead read the audio clock each frame, so picture,
  playhead and sound share one timeline and do not drift during long loops.
- Overlapping hits blend; nothing moves when no sound is playing, and after
  Stop the circles glide back to rest.

## 7. Where settings are stored

In your browser's **localStorage**, key `circular-drum.artworks.v1`
(id, name, BPM, steps, loop, Kick/Snare/Hi-hat/Clap step rows,
Kick/Snare/Hi-hat/Clap colors, graphic preset, timestamps). Artworks saved
by earlier versions keep their settings: their rows are made from their
original rhythm, all four instruments get their one color (so they sound
the same), and old volume values are ignored and dropped on the next save.
Audio is not stored there, only referenced. Settings survive refreshes but
are per browser and per address: `localhost:5173` (dev) and
`localhost:4173` (preview) have separate libraries. Clearing site data
resets the library to the example artworks.

## 8. Project layout

```
public/audio/            the 28 drum samples
src/audio/sampleConfig.ts  sample list + instrument keywords  ← edit here
src/audio/sampleMap.ts     filename → color / instrument mapping
src/audio/channels.ts      instrument → channel → circle mapping
src/audio/engine.ts        AudioContext, sample loading, fixed instrument buses
src/audio/transport.ts     lookahead scheduler (play / stop / loop / live changes)
src/audio/pattern.ts       BPM & step calculations, pattern rule
src/animation/             droplet envelope, animator, audio clock
src/presets/               colors, palettes, ring layouts, rhythms, example artworks
src/storage/               localStorage persistence
src/components/            library, editor, step rows, color pickers
src/tests/                 unit tests (vitest)
```

## 9. Troubleshooting

- **One instrument is silent**: check its row has steps switched on.
- **No sound**: click Play again (browsers block audio before a click);
  check your system volume; on iPhone turn off silent mode.
- **"Missing sample" notice**: the named file isn't in `public/audio/` or
  its name differs from `sampleConfig.ts`. Run `npm run check:samples`.
- **`npm` not found**: install Node.js 18+.
- **Port 5173 already in use**: Vite picks the next free port; use the URL
  it prints.
- **Library looks wrong after experiments**: in the browser console run
  `localStorage.removeItem('circular-drum.artworks.v1')` and reload to get
  the example artworks back.
- **Sound stutters in a background tab**: browsers slow timers in hidden
  tabs; the scheduler schedules further ahead there, but keep the tab
  visible for the best timing.
