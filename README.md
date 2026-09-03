# Wall Map

A wall-mounted world map showing the cities, states and countries you've visited,
driven by a Google Sheet and displayed on a Raspberry Pi in kiosk mode.

Static site — no server, no build step. Hosted on GitHub Pages.

## 1. The Google Sheet

Create a sheet with these columns in row 1 (order doesn't matter, extra columns are ignored):

| place | who | date | notes | lat | lng | type |
|---|---|---|---|---|---|---|
| Paris, France | both | 2024-06 | Anniversary | | | |
| Oregon | ben | 2024-08 | Road trip | | | |
| Japan | partner | 2023 | | | | |

- **place** — city (`"Lisbon, Portugal"`), US state (`"Vermont"`) or country (`"Italy"`).
  Countries and US states are recognised by name and shaded; anything else becomes a dot.
- **who** — `ben`, `partner`, or `both` (keys are configurable in `config.js`).
- **date** — `2024-06-14`, `2024-06`, `June 2024`, `2024`, or `6/14/2024`. Optional.
- **notes** — shown in the corner ticker. Optional.
- **lat / lng** — optional. Skips geocoding for that row (useful for ambiguous names).
- **type** — optional `city` / `state` / `country` to override auto-detection
  (e.g. `Georgia` the country vs. the state).

Then **File → Share → Publish to web → (your tab) → Comma-separated values (.csv)** and copy the URL.
Changes to the sheet appear on the wall within `refreshMinutes` (default 10).

Tip: add a Data → Data validation dropdown on the `who` column.

## 2. Configure

Edit `config.js`:

```js
sheet: "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv",
people: {
  ben:     { label: "Ben",     color: "#4cc9f0" },
  partner: { label: "Partner", color: "#f72585" },
},
```

Visual encodings live in the same file: `halfLifeDays` (opacity = recency),
`minRadius`/`maxRadius` (size = visit count), `showLabels`, `fillRegions`,
`tickerSeconds`, `projection`. Any value can be overridden in the URL for
experimenting, e.g. `?projection=orthographic&halfLifeDays=365`.

With `sheet` empty the app loads `data/sample.csv` (demo mode).

## 3. Host on GitHub Pages

Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
The site will be at `https://<user>.github.io/wall-map/`.

## 4. Raspberry Pi kiosk

Tested target: Raspberry Pi 3 Model B+ (1 GB), Raspberry Pi OS Desktop 64-bit.

1. Flash Raspberry Pi OS (Desktop) with Raspberry Pi Imager; set Wi-Fi, user, and enable SSH.
2. Boot, SSH in, run:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/benjaminwalker-se/wall-map/main/pi/setup.sh | bash -s -- https://<user>.github.io/wall-map/
   ```
3. It installs Chromium, autostarts it fullscreen at the URL, disables screen blanking,
   hides the cursor, reloads nightly and reboots weekly.

If the Pi 3 feels sluggish: set `showLabels: false`, `tickerSeconds: 0`, and keep
`projection` at `naturalEarth` (the flat projections are cheapest to render).

## Local development

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Geocoding

City names are geocoded with [Nominatim](https://nominatim.org/) (OpenStreetMap), throttled to
1 request/second and cached in the browser's localStorage, so each new place is looked up once.
Countries and US states never hit the network. Places that can't be found are listed in the
bottom-right status; add `lat`/`lng` for those rows.
