(async () => {
  const cfg = { ...window.WALL_MAP_CONFIG };
  const params = new URLSearchParams(location.search);
  for (const [k, v] of params) {
    if (!(k in cfg)) continue;
    const cur = cfg[k];
    cfg[k] = typeof cur === "number" ? +v : typeof cur === "boolean" ? v !== "false" : v;
  }
  const source = cfg.sheet || "data/sample.csv";

  const status = d3.select("#status");
  const setStatus = (msg, error = false) => status.classed("error", error).text(msg);

  const [world, us] = await Promise.all([
    d3.json("data/countries-110m.json"),
    d3.json("data/us-states.geojson"),
  ]);
  const { countries, states } = WallMapRender.init(cfg, world, us);
  WallMapGeocode.init(countries, states);
  WallMapRender.legend();

  let groups = [];

  async function refresh() {
    try {
      setStatus("Loading…");
      const rows = await WallMapData.load(source);
      groups = WallMapData.groupByPlace(rows);
      await WallMapGeocode.resolveAll(groups, (n, total) => setStatus(`Geocoding ${n}/${total}…`));
      WallMapRender.draw(groups);
      const failed = groups.filter((g) => !g.coords);
      setStatus(
        `${rows.length} visits · ${groups.length} places · updated ${new Date().toLocaleTimeString([], { timeStyle: "short" })}` +
        (failed.length ? ` · ${failed.length} not found: ${failed.map((f) => f.place).join(", ")}` : ""),
        failed.length > 0
      );
    } catch (e) {
      console.error(e);
      setStatus(e.message, true);
    }
  }

  await refresh();
  setInterval(refresh, Math.max(1, cfg.refreshMinutes) * 60 * 1000);

  // Ticker: cycle through places, most recent first.
  if (cfg.tickerSeconds > 0) {
    let i = 0;
    const fmt = (d) => d ? d.toLocaleDateString([], { year: "numeric", month: "short" }) : "";
    const tick = () => {
      const list = groups.filter((g) => g.coords).sort((a, b) => (b.lastDate?.getTime() || 0) - (a.lastDate?.getTime() || 0));
      if (!list.length) return;
      const g = list[i++ % list.length];
      const who = g.who === "both" ? cfg.bothLabel : (cfg.people[g.who]?.label || g.who);
      const last = g.visits[0];
      d3.select("#ticker").html(
        `<div class="place" style="color:${WallMapRender.colorFor(g.who)}">${g.place}</div>` +
        `<div class="meta">${who} · ${g.count} visit${g.count > 1 ? "s" : ""}${g.lastDate ? " · last " + fmt(g.lastDate) : ""}` +
        `${last?.notes ? " · " + last.notes : ""}</div>`
      );
    };
    tick();
    setInterval(tick, cfg.tickerSeconds * 1000);
  }
})();
