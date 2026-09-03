// Edit this file to point the map at your Google Sheet and tune the visuals.
// Any key can also be overridden per-URL, e.g. ?sheet=<csv url>&halfLifeDays=365
window.WALL_MAP_CONFIG = {
  // Google Sheet published as CSV (File > Share > Publish to web > CSV).
  // Leave empty to load data/sample.csv (demo mode).
  sheet: "",

  // How often to re-fetch the sheet, in minutes.
  refreshMinutes: 10,

  // People and their colours. Keys must match the `who` column (case-insensitive).
  // "both" is drawn with a blend of the two colours.
  people: {
    ben: { label: "Ben", color: "#4cc9f0" },
    partner: { label: "Partner", color: "#f72585" },
  },
  bothLabel: "Both",

  // Visual encodings ------------------------------------------------------
  // Opacity: how recently visited. A visit `halfLifeDays` ago is half as bright.
  halfLifeDays: 730,
  minOpacity: 0.35,

  // Size: how often visited (number of rows for the same place).
  minRadius: 4,
  maxRadius: 12,

  // Show city names next to dots.
  showLabels: true,

  // Fill visited countries/states with the visitor's colour.
  fillRegions: true,

  // Rotating "last visited" ticker in the corner (seconds per item; 0 to hide).
  tickerSeconds: 8,

  // Map projection: "naturalEarth", "equalEarth", "mercator", "orthographic".
  projection: "naturalEarth",
};
