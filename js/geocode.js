// Resolves place names to coordinates and (for countries/states) map features.
// Countries and US states are matched offline against the bundled TopoJSON;
// everything else goes to Nominatim, cached forever in localStorage.
window.WallMapGeocode = (() => {
  const CACHE_KEY = "wallmap.geocode.v1";
  const NOMINATIM = "https://nominatim.openstreetmap.org/search";
  const MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second

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

  async function nominatim(name) {
    if (cache[name]) return cache[name];
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
    const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocode failed for "${name}": ${res.status}`);
    const hits = await res.json();
    if (!hits.length) throw new Error(`No geocode result for "${name}"`);
    const hit = hits[0];
    cache[name] = { coords: [+hit.lon, +hit.lat], display: hit.display_name };
    saveCache();
    return cache[name];
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
        g.coords = (await nominatim(g.place)).coords;
      } catch (e) {
        g.error = e.message;
        console.warn(e);
      }
      onProgress?.(++done, pending.length);
    }
    return groups;
  }

  return { init, resolveAll, matchRegion };
})();
