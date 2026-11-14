/* Kleine Helfer für alle Seiten */
var U = (function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  function money(c) { return fmt.format((c || 0) / 100); }
  function signed(c) { return (c > 0 ? "+" : c < 0 ? "−" : "±") + fmt.format(Math.abs(c) / 100); }
  function cents2str(c) { return c == null ? "" : (c / 100).toFixed(2).replace(".", ","); }
  function parsePrice(s) {
    s = String(s || "").replace(/[€\s]/g, "").replace(",", ".");
    var v = parseFloat(s); if (!isFinite(v) || v < 0) return null; return Math.round(v * 100);
  }
  function toast(msg, ms) {
    var t = $("toast"); t.textContent = msg; t.style.display = "block";
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = "none"; }, ms || 2500);
  }
  function day(ts) { return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }); }

  /* Text vergleichen (für Suche und Kassenbon-Abgleich) */
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function grams(s) { var g = {}, t = " " + s + " "; for (var i = 0; i < t.length - 1; i++) { var k = t.substr(i, 2); g[k] = (g[k] || 0) + 1; } return g; }
  /* 0 … 1: wie ähnlich zwei Namen sind (Bon-Kürzel wie „Del. Fleischsalat“ vs. „Delikatess Fleischsalat“) */
  function sim(a, b) {
    a = norm(a); b = norm(b); if (!a || !b) return 0; if (a === b) return 1;
    var ga = grams(a), gb = grams(b), inter = 0, na = 0, nb = 0, k;
    for (k in ga) { na += ga[k]; if (gb[k]) inter += Math.min(ga[k], gb[k]); }
    for (k in gb) nb += gb[k];
    var dice = 2 * inter / (na + nb);
    var wa = a.split(" "), wb = b.split(" "), hit = 0;
    wa.forEach(function (w) { if (w.length >= 3 && wb.some(function (x) { return x.indexOf(w) === 0 || w.indexOf(x) === 0 && x.length >= 3; })) hit++; });
    var words = hit / Math.max(1, Math.min(wa.length, wb.length));
    return Math.max(dice, 0.5 * dice + 0.5 * words);
  }
  /* Markt-Abzeichen in den typischen Farben der Kette (eigene Gestaltung, keine Original-Logos) */
  var BRAND = {
    lidl: ["#0050aa", "#fff000", "#e60a14"], aldi: ["#00205b", "#ffffff", "#f39200"], rewe: ["#cc071e", "#ffffff"],
    edeka: ["#ffd400", "#0a3b8c"], dm: ["#ffffff", "#0a2a6b", "#e2001a"], kaufland: ["#e10915", "#ffffff"],
    netto: ["#ffe500", "#d8001b"], penny: ["#cd1414", "#ffffff", "#ffe500"], rossmann: ["#c3002d", "#ffffff"],
    norma: ["#e30613", "#ffffff"], globus: ["#ffffff", "#e30613"], real: ["#003d7c", "#ffffff"], tegut: ["#e30613", "#ffffff"],
    hit: ["#004b93", "#ffffff"], famila: ["#e2001a", "#ffffff"], marktkauf: ["#0a3b8c", "#ffd400"], muller: ["#f39200", "#ffffff"], mueller: ["#f39200", "#ffffff"]
  };
  var POOL = [["#7c3aed", "#ffffff"], ["#0891b2", "#ffffff"], ["#ea580c", "#ffffff"], ["#db2777", "#ffffff"], ["#16a34a", "#ffffff"], ["#facc15", "#000000"]];
  function brandOf(name) {
    var k = norm(name).replace(/ /g, "");
    for (var b in BRAND) if (k.indexOf(b) === 0) return BRAND[b];
    var h = 0; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return POOL[h % POOL.length];
  }
  function badge(name, cls) {
    var c = brandOf(name), label = String(name);
    return '<span class="mk' + (cls ? " " + cls : "") + '" style="background:' + c[0] + ";color:" + c[1] + (c[2] ? ";box-shadow:inset 0 -3px 0 " + c[2] : "") + '">' + esc(label) + "</span>";
  }
  return { badge: badge, brandOf: brandOf, $: $, esc: esc, money: money, signed: signed, cents2str: cents2str, parsePrice: parsePrice, toast: toast, day: day, norm: norm, sim: sim };
})();
