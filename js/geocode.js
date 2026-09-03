// Resolves place names to coordinates and (for countries/states) map features.
// Countries and US states are matched offline against the bundled TopoJSON;
// everything else goes to Nominatim, cached forever in localStorage.
window.WallMapGeocode = (() => {
  const CACHE_KEY = "wallmap.geocode.v1";
  const NOMINATIM = "https://nominatim.openstreetmap.org/search";
  const PHOTON = "https://photon.komoot.io/api/";
  const MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second
  const MAX_ATTEMPTS = 3;

  const ALIASES = {
    usa: "united states of america", us: "united states of america",
    "united states": "united states of america", america: "united states of america",
    uk: "united kingdom", england: "united kingdom", scotland: "united kingdom", wales: "united kingdom",
    holland: "netherlands", czechia: "czech republic", "south korea": "south korea", korea: "south korea",
    "ivory coast": "côte d'ivoire", burma: "myanmar", uae: "united arab emirates",
    "dominican rep.": "dominican republic", "bosnia and herz.": "bosnia and herzegovina",
  };

  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/^the /, "");

  let countries = new Map();
  let states = new Map();
  let lastRequest = 0;

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
  }
  const cache = loadCache();
  function saveCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }

  function init(countryFeatures, stateFeatures) {
    countries = new Map(countryFeatures.map((f) => [norm(f.properties.name), f]));
    states = new Map(stateFeatures.map((f) => [norm(f.properties.name), f]));
  }

  function matchRegion(name) {
    // Only the first comma part counts: "Oregon, USA" is a state, "Paris, France" is not.
    const p = norm(name).split(",")[0].trim();
    const n = ALIASES[p] || p;
    if (states.has(n)) return { type: "state", feature: states.get(n) };
    if (countries.has(n)) return { type: "country", feature: countries.get(n) };
    return null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function throttledJson(url) {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const PROVIDERS = [
    async (name) => {
      const hits = await throttledJson(`${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`);
      if (!hits.length) return null;
      return { coords: [+hits[0].lon, +hits[0].lat], display: hits[0].display_name };
    },
    async (name) => {
      const { features } = await throttledJson(`${PHOTON}?limit=1&q=${encodeURIComponent(name)}`);
      if (!features?.length) return null;
      const f = features[0];
      const p = f.properties;
      return { coords: f.geometry.coordinates, display: [p.name, p.state, p.country].filter(Boolean).join(", ") };
    },
  ];

  // Tries each provider in turn, with backoff on network/HTTP errors (the Pi
  // often gets throttled on first boot when nothing is cached yet).
  async function geocode(name) {
    if (cache[name]) return cache[name];
    let lastError = "no result";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      for (const provider of PROVIDERS) {
        try {
          const hit = await provider(name);
          if (hit) {
            cache[name] = hit;
            saveCache();
            return hit;
          }
        } catch (e) {
          lastError = e.message;
          await sleep(2000 * (attempt + 1));
        }
      }
    }
    throw new Error(`Geocode failed for "${name}": ${lastError}`);
  }

  // Mutates each group: sets .coords, .type, and .feature (for regions).
  async function resolveAll(groups, onProgress) {
    const pending = [];
    for (const g of groups) {
      if (g.type !== "city" && !(g.coords && !g.type)) {
        const m = matchRegion(g.place);
        if (m && (!g.type || g.type === m.type)) {
          g.type = m.type;
          g.feature = m.feature;
          g.coords = g.coords || d3.geoCentroid(m.feature);
          continue;
        }
      }
      g.type = g.type || "city";
      if (!g.coords) pending.push(g);
    }
    let done = 0;
    for (const g of pending) {
      try {
        g.coords = (await geocode(g.place)).coords;
      } catch (e) {
        g.error = e.message;
        console.warn(e);
      }
      onProgress?.(++done, pending.length, g);
    }
    return groups;
  }

  return { init, resolveAll, matchRegion };
})();
