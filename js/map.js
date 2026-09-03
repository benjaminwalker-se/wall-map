// D3 rendering of the base map and visit marks.
window.WallMapRender = (() => {
  const PROJECTIONS = {
    naturalEarth: () => d3.geoNaturalEarth1(),
    equalEarth: () => d3.geoEqualEarth(),
    mercator: () => d3.geoMercator(),
    orthographic: () => d3.geoOrthographic().rotate([100, -30]),
  };

  let svg, projection, path, layers, cfg;

  function colorFor(who) {
    const keys = Object.keys(cfg.people);
    if (cfg.people[who]) return cfg.people[who].color;
    if (keys.length >= 2) return d3.interpolateRgb(cfg.people[keys[0]].color, cfg.people[keys[1]].color)(0.5);
    return "#ffffff";
  }

  function opacityFor(lastDate) {
    if (!lastDate) return cfg.minOpacity;
    const ageDays = (Date.now() - lastDate.getTime()) / 86400000;
    const decay = Math.pow(0.5, Math.max(0, ageDays) / cfg.halfLifeDays);
    return cfg.minOpacity + (1 - cfg.minOpacity) * decay;
  }

  function init(config, world, us) {
    cfg = config;
    svg = d3.select("#map");
    layers = {
      base: svg.append("g").attr("class", "base"),
      regions: svg.append("g").attr("class", "regions"),
      marks: svg.append("g").attr("class", "marks"),
    };
    const land = topojson.feature(world, world.objects.countries);
    const states = us.features;

    layers.base.append("path").datum({ type: "Sphere" }).attr("class", "sphere");
    layers.base.append("path").datum(d3.geoGraticule10()).attr("class", "graticule");
    layers.base.append("g").selectAll("path").data(land.features).join("path").attr("class", "land");
    layers.base.append("g").selectAll("path").data(states).join("path").attr("class", "state-border");

    resize();
    window.addEventListener("resize", () => { resize(); if (lastGroups) draw(lastGroups); });
    return { countries: land.features, states };
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    svg.attr("viewBox", [0, 0, w, h]);
    projection = (PROJECTIONS[cfg.projection] || PROJECTIONS.naturalEarth)();
    projection.fitExtent([[10, 10], [w - 10, h - 10]], { type: "Sphere" });
    path = d3.geoPath(projection);
    layers.base.selectAll("path").attr("d", path);
  }

  let lastGroups = null;

  function draw(groups) {
    lastGroups = groups;
    const placed = groups.filter((g) => g.coords);

    const regions = placed.filter((g) => g.feature && cfg.fillRegions);
    layers.regions.selectAll("path").data(regions, (d) => d.place).join("path")
      .attr("class", (d) => `region ${d.type}`)
      .attr("d", (d) => path(d.feature))
      .attr("fill", (d) => colorFor(d.who))
      .attr("fill-opacity", (d) => opacityFor(d.lastDate) * 0.55)
      .classed("upcoming", (d) => d.upcoming)
      .attr("stroke", (d) => colorFor(d.who))
      .attr("stroke-width", 0.8);

    const cities = placed.filter((g) => g.type === "city");
    const r = d3.scaleSqrt()
      .domain([1, Math.max(2, d3.max(cities, (d) => d.count) || 1)])
      .range([cfg.minRadius, cfg.maxRadius]);

    const marks = layers.marks.selectAll("g.mark").data(cities, (d) => d.place).join(
      (enter) => {
        const g = enter.append("g").attr("class", "mark");
        g.append("circle").attr("class", "visit");
        g.append("text").attr("class", "visit-label");
        return g;
      }
    );
    marks.attr("transform", (d) => `translate(${projection(d.coords)})`);
    marks.select("circle")
      .classed("upcoming", (d) => d.upcoming)
      .attr("r", (d) => r(d.count))
      .attr("fill", (d) => colorFor(d.who))
      .attr("fill-opacity", (d) => opacityFor(d.lastDate));
    marks.select("text")
      .attr("x", (d) => r(d.count) + 4).attr("dy", "0.35em")
      .attr("display", cfg.showLabels ? null : "none")
      .text((d) => d.place.split(",")[0]);
  }

  function legend() {
    const rows = Object.values(cfg.people).map((p) => `<div class="row"><span class="swatch" style="background:${p.color}"></span>${p.label}</div>`);
    rows.push(`<div class="row"><span class="swatch" style="background:${colorFor("both")}"></span>${cfg.bothLabel}</div>`);
    rows.push(`<div class="hint">brighter = more recent · bigger = more visits · dashed = upcoming</div>`);
    d3.select("#legend").html(rows.join(""));
  }

  return { init, draw, legend, colorFor };
})();
