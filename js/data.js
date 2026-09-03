// Loads and normalises the visits sheet.
// Expected columns (case-insensitive, extra columns ignored):
//   place   - "Paris, France", "Oregon", "Japan"
//   who     - a key from config.people, or "both"
//   arrival date, departure date - "5/28/2026", "2023-06", "June 2023", "2023"
//                                  (a single `date` column is also accepted)
//   notes   - optional, shown in the ticker
//   lat,lng - optional; skips geocoding when present
//   type    - optional: city | state | country (auto-detected otherwise)
window.WallMapData = (() => {
  const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  function parseDate(s) {
    if (!s) return null;
    s = String(s).trim();
    if (/^\d{4}$/.test(s)) return new Date(+s, 6, 1);
    const my = s.match(/^([a-z]+)\.?\s+(\d{4})$/i);
    if (my) {
      const m = MONTHS.indexOf(my[1].slice(0, 3).toLowerCase());
      if (m >= 0) return new Date(+my[2], m, 15);
    }
    const iso = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +(iso[3] || 15));
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (us) {
      const y = us[3].length === 2 ? 2000 + +us[3] : +us[3];
      return new Date(y, +us[1] - 1, +us[2]);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function normaliseWho(s, people) {
    const w = (s || "").trim().toLowerCase();
    if (people[w]) return w;
    const match = Object.keys(people).find((k) => w.startsWith(k) || people[k].label.toLowerCase() === w);
    return match || "both";
  }

  function normaliseRow(raw, people) {
    const row = {};
    for (const k of Object.keys(raw)) row[k.trim().toLowerCase().replace(/[_-]/g, " ")] = (raw[k] || "").trim();
    if (!row.place) return null;
    const arrival = row["arrival date"] ?? row.arrival ?? row.date ?? row.start ?? "";
    const departure = row["departure date"] ?? row.departure ?? row.end ?? "";
    const lat = parseFloat(row.lat ?? row.latitude);
    const lng = parseFloat(row.lng ?? row.lon ?? row.longitude);
    return {
      place: row.place,
      who: normaliseWho(row.who, people),
      date: parseDate(arrival),
      departure: parseDate(departure),
      notes: row.notes || "",
      type: (row.type || "").toLowerCase() || null,
      coords: isFinite(lat) && isFinite(lng) ? [lng, lat] : null,
    };
  }

  async function load(url, people) {
    const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const text = await res.text();
    return d3.csvParse(text).map((r) => normaliseRow(r, people)).filter(Boolean);
  }

  // Group rows by place so one dot represents all visits there.
  function groupByPlace(rows) {
    const groups = new Map();
    for (const r of rows) {
      const key = r.place.toLowerCase();
      if (!groups.has(key)) groups.set(key, { place: r.place, visits: [], type: r.type, coords: r.coords });
      const g = groups.get(key);
      g.visits.push(r);
      g.type = g.type || r.type;
      g.coords = g.coords || r.coords;
    }
    for (const g of groups.values()) {
      g.visits.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      const ends = g.visits.map((v) => v.departure || v.date).filter(Boolean);
      g.lastDate = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
      g.upcoming = g.visits.some((v) => v.date && v.date.getTime() > Date.now());
      g.count = g.visits.length;
      const whos = new Set(g.visits.map((v) => v.who));
      g.who = whos.size === 1 ? [...whos][0] : "both";
    }
    return [...groups.values()];
  }

  return { load, groupByPlace, parseDate };
})();
