(function () {
  "use strict";
  var D = window.DATA;
  var $ = function (id) { return document.getElementById(id); };
  var NS = "http://www.w3.org/2000/svg";
  var fmt = function (n) { return Number(n).toLocaleString("en-US"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };

  /* ---------- theme ---------- */
  $("themeBtn").addEventListener("click", function () {
    var root = document.documentElement;
    var cur = root.getAttribute("data-theme");
    var dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("pp-theme", next); } catch (e) {}
  });

  /* ---------- downloads (hero buttons and download cards) ---------- */
  var DL_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var cta = "";
  D.files.forEach(function (f, i) {
    cta += '<a class="btn ' + (i === 0 ? "btn-primary" : "btn-ghost") + '" href="' + esc(f.file) + '" download>' + DL_ICON +
      '<span>' + esc(f.title) + ' <small>' + esc(f.size) + '</small></span></a>';
  });
  $("heroCta").innerHTML = cta;

  var dl = "";
  D.files.forEach(function (f) {
    dl += '<article class="dl"><div class="dl-top"><div class="dl-ic">' + DL_ICON + '</div><div><h3>' + esc(f.title) +
      '</h3><p class="dl-meta">' + esc(f.kind) + ' &middot; ' + esc(f.size) + '</p></div></div><p>' + esc(f.desc) +
      '</p><a class="btn btn-primary" href="' + esc(f.file) + '" download>' + DL_ICON + '<span>Download</span></a></article>';
  });
  $("dlGrid").innerHTML = dl;

  /* ---------- KPIs ---------- */
  var K = D.kpi;
  var kp = [
    [fmt(K.matches), "matches analysed from 883 supplied (807 kept after quality checks)"],
    [K.pressure_share + "%", "of balls count as pressure: " + fmt(K.pressure_balls) + " of " + fmt(K.deliveries)],
    [K.auc_chase.toFixed(2), "win-probability accuracy in chases (AUC); " + K.auc.toFixed(2) + " overall"],
    [K.elig_bat + " / " + K.elig_bowl, "batters and bowlers with enough pressure balls to be ranked"]
  ];
  $("kpis").innerHTML = kp.map(function (k) { return '<div class="kpi"><div class="kpi-v">' + esc(k[0]) + '</div><div class="kpi-l">' + esc(k[1]) + '</div></div>'; }).join("");

  /* ---------- comparison table ---------- */
  $("compareBody").innerHTML = D.compare.map(function (r) {
    return "<tr><td>" + esc(r[0]) + '</td><td class="num hl">' + esc(r[1]) + '</td><td class="num">' + esc(r[2]) + "</td></tr>";
  }).join("");

  /* ---------- charts ---------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, cls) { var t = el("text", { x: x, y: y, "class": cls || "" }, parent); t.textContent = s; return t; }

  var W = 560, H = 270, M = { l: 48, r: 14, t: 14, b: 46 };
  var edges = D.leverage.edges; // upper edge of each balls-left band, ordered from end of innings to start
  var n = edges.length, pw = W - M.l - M.r, ph = H - M.t - M.b;
  var xAt = function (i) { return M.l + (n === 1 ? 0 : i * pw / (n - 1)); };
  var tickIdx = [0, 2, 4, 6, 8, 10];
  var tickLbl = tickIdx.map(function (i) { return edges[i]; });

  function frame(svg, ymax, ticks, fmtY, xs) {
    var g = el("g", { "class": "grid" }, svg), a = el("g", { "class": "ax" }, svg);
    ticks.forEach(function (t) {
      var y = M.t + ph - t / ymax * ph;
      el("line", { x1: M.l, x2: W - M.r, y1: y, y2: y }, g);
      txt(a, M.l - 8, y + 4, fmtY(t)).setAttribute("text-anchor", "end");
    });
    xs.idx.forEach(function (i, k) { txt(a, xs.at(i), H - M.b + 18, xs.lbl[k]).setAttribute("text-anchor", "middle"); });
    txt(svg, M.l + pw / 2, H - 6, "balls left in the innings (end of innings on the left)", "ax-title");
  }

  (function leverageChart() {
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet" });
    var ymax = 0.045;
    frame(svg, ymax, [0, 0.01, 0.02, 0.03, 0.04], function (v) { return v.toFixed(2); }, { idx: tickIdx, lbl: tickLbl, at: xAt });
    var yAt = function (v) { return M.t + ph - v / ymax * ph; };
    [["inn1", "l1", "pt1"], ["inn2", "l2", "pt2"]].forEach(function (s) {
      var pts = D.leverage[s[0]].map(function (v, i) { return xAt(i).toFixed(1) + "," + yAt(v).toFixed(1); });
      el("polyline", { points: pts.join(" "), "class": s[1] }, svg);
      D.leverage[s[0]].forEach(function (v, i) { el("circle", { cx: xAt(i), cy: yAt(v), r: 3, "class": s[2] }, svg); });
    });
    $("chartLev").appendChild(svg);
  })();

  (function flagChart() {
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet" });
    var ymax = 60, step = pw / n, bw = step * 0.64;
    var cx = function (i) { return M.l + step * i + step / 2; };
    frame(svg, ymax, [0, 20, 40, 60], function (v) { return v + "%"; }, { idx: tickIdx, lbl: tickLbl, at: cx });
    // balls left above 84 is the powerplay (not eligible)
    var pp = edges.findIndex(function (e) { return e > 84; });
    el("rect", { x: M.l + step * pp, y: M.t, width: step * (n - pp), height: ph, "class": "zone" }, svg);
    txt(svg, M.l + step * (pp + (n - pp) / 2), M.t + 18, "powerplay", "zone-t");
    txt(svg, M.l + step * (pp + (n - pp) / 2), M.t + 32, "excluded", "zone-t");
    D.leverage.flagged.forEach(function (v, i) {
      var h = v / ymax * ph;
      if (v > 0) el("rect", { x: cx(i) - bw / 2, y: M.t + ph - h, width: bw, height: h, rx: 3, "class": "bar" }, svg);
      if (v > 0) txt(svg, cx(i), M.t + ph - h - 6, Math.round(v) + "%", "val");
    });
    $("chartFlag").appendChild(svg);
  })();

  /* ---------- player cards ---------- */
  var EXT = [".jpg", ".png", ".webp"];
  function initials(name) { var p = name.split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
  function loadPhoto(img, slug) {
    var i = 0;
    img.hidden = true;
    img.onload = function () { img.hidden = false; };
    img.onerror = function () { i++; if (i < EXT.length) img.src = "players/" + slug + EXT[i]; else img.remove(); };
    img.src = "players/" + slug + EXT[0];
  }
  function card(p, role) {
    var a = document.createElement("article");
    a.className = "player";
    a.innerHTML =
      '<div class="p-head">' +
        '<div class="photo"><span class="rank" aria-label="Rank ' + p.rank + '">' + p.rank + '</span><span class="ini" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
          '<img alt="' + esc(p.name) + '" loading="lazy"></div>' +
        '<div class="p-id"><h3>' + esc(p.name) + '</h3><p class="role">' + role + ' &middot; rank ' + p.rank + ' of 10</p></div>' +
        '<div class="p-rate"><strong>+' + p.rating.toFixed(1) + '</strong><span>runs per 100 balls above league</span></div>' +
      '</div>' +
      '<dl class="stats">' + p.stats.map(function (s) { return "<div><dt>" + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd></div>"; }).join("") + "</dl>" +
      '<div class="why"><h4>Why chosen</h4><p>' + esc(p.why) + "</p></div>" +
      '<div class="tags">' + p.tags.map(function (t) { return '<span class="tag ' + t[1] + '">' + esc(t[0]) + "</span>"; }).join("") + "</div>" +
      '<div class="stab">' +
        '<div class="meter-row"><span>Stays in top 10</span><span>' + Math.round(p.p10 * 100) + '%</span></div>' +
        '<div class="meter" role="img" aria-label="' + Math.round(p.p10 * 100) + ' percent of resamples keep this player in the top 10"><i style="width:' + Math.round(p.p10 * 100) + '%"></i></div>' +
        "<p>" + esc(p.stability) + "</p>" +
        '<p class="comp ' + p.complevel + '">' + esc(p.comp) + "</p>" +
      "</div>";
    loadPhoto(a.querySelector("img"), p.slug);
    return a;
  }
  D.bat.forEach(function (p) { $("battersGrid").appendChild(card(p, "Batter")); });
  D.bowl.forEach(function (p) { $("bowlersGrid").appendChild(card(p, "Bowler")); });

  /* ---------- top 30 table ---------- */
  var current = "bat";
  var HEAD = {
    bat: ["#", "Player", "Pressure balls", "Matches", "Strike rate (p / u)", "Out % (p / u)", "Rating", "Rank range"],
    bowl: ["#", "Player", "Pressure balls", "Matches", "Economy (p / u)", "Wicket % (p / u)", "Rating", "Rank range"]
  };
  function renderTable() {
    $("shortHead").innerHTML = HEAD[current].map(function (h, i) { return "<th" + (i >= 2 ? ' class="num"' : "") + ">" + esc(h) + "</th>"; }).join("");
    var q = $("q").value.trim().toLowerCase();
    var rows = D[current + "30"].filter(function (r) { return !q || r[1].toLowerCase().indexOf(q) !== -1; });
    $("shortBody").innerHTML = rows.map(function (r) {
      var cells = r.map(function (c, i) {
        if (i === 0) return '<td class="rk">' + c + "</td>";
        if (i === 1) return '<td class="name">' + esc(c) + "</td>";
        return '<td class="num">' + esc(c) + "</td>";
      }).join("");
      return '<tr class="' + (r[0] <= 10 ? "top" : "") + '">' + cells + "</tr>";
    }).join("") || '<tr><td colspan="8">No player matches that search.</td></tr>';
    $("shortNote").textContent = "p / u = under pressure / in ordinary play. Rating is in runs per 100 balls above the league average in the same situation. Rank range is the 5th to 95th percentile over 1,000 resamples of the matches.";
  }
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      current = b.getAttribute("data-list");
      document.querySelectorAll(".seg button").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      renderTable();
    });
  });
  $("q").addEventListener("input", renderTable);
  renderTable();
})();
