/* Statistik-Seite */
"use strict";
/* ---------- Statistik ---------- */
function bars(rows, fmtV) {
  var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  return '<div class="bars">' + rows.map(function (r) {
    return '<div class="bar"><span class="bl">' + (r.h || esc(r.k)) + '</span><span class="bt"><i style="width:' + Math.max(2, Math.round(r.v / max * 100)) + "%" + (r.c ? ";background:" + r.c : "") + '"></i></span><b>' + (fmtV || money)(r.v) + "</b></div>";
  }).join("") + "</div>";
}
function viewStats() {
  var P = state.purchases, h = budgetCard(0) + wasteStats();
  var l = S.activeList(), cmp = S.storeCompare(l).sort(function (a, b) { return b.have / b.of - a.have / a.of || a.sum - b.sum; });
  if (!P.length) h += '<div class="card"><b>Noch keine Einkäufe gespeichert.</b><div class="sub">Nach dem Einkauf: Liste → ' + I("receipt") + ' Mit Kassenbon vergleichen → Einkauf speichern. Dann füllt sich diese Seite.</div></div>';
  else {
    var sum = P.reduce(function (a, p) { return a + p.total; }, 0), diff = P.reduce(function (a, p) { return a + p.total - p.expected; }, 0);
    var now = monthKey(Date.now()), month = P.filter(function (p) { return monthKey(p.date) === now; }).reduce(function (a, p) { return a + p.total; }, 0);
    h += '<div class="tiles">' + tile(money(month), "Diesen Monat", "stats") + tile(money(Math.round(sum / P.length)), "Ø pro Einkauf", "stats") +
      tile(P.length, "Einkäufe", "stats") + '<div class="tile"><b class="' + (diff > 0 ? "bad" : "good") + '">' + U.signed(diff) + "</b><span>Bon vs. Liste gesamt</span></div></div>";
    var months = [], d = new Date(); d.setDate(1);
    for (var i = 5; i >= 0; i--) { var m = new Date(d.getFullYear(), d.getMonth() - i, 1), k = monthKey(m);
      months.push({ k: m.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), v: P.filter(function (p) { return monthKey(p.date) === k; }).reduce(function (a, p) { return a + p.total; }, 0) }); }
    h += "<h3>Ausgaben pro Monat</h3>" + bars(months);
    var bs = {}; P.forEach(function (p) { bs[p.store] = (bs[p.store] || 0) + p.total; });
    h += "<h3>Ausgaben pro Markt</h3>" + bars(Object.keys(bs).map(function (k) { return { k: k, h: U.badge(k, "xs"), c: U.brandOf(k)[0] === "#ffffff" ? U.brandOf(k)[1] : U.brandOf(k)[0], v: bs[k] }; }).sort(function (a, b) { return b.v - a.v; }));
    var top = {};
    P.forEach(function (p) { p.items.forEach(function (it) { var k = it.b && S.products[it.b] ? S.products[it.b].name : it.name; var t = top[k] || (top[k] = { n: 0, c: 0 }); t.n += it.qty || 1; t.c += it.price; }); });
    var tl = Object.keys(top).map(function (k) { return { k: k, n: top[k].n, c: top[k].c }; }).sort(function (a, b) { return b.n - a.n || b.c - a.c; }).slice(0, 8);
    h += "<h3>Am häufigsten gekauft</h3><div class=\"card\">" + tl.map(function (x) { return '<div class="kv s"><span>' + x.n + "× " + esc(x.k) + "</span><span>" + money(x.c) + "</span></div>"; }).join("") + "</div>";
  }
  if (cmp.length) h += '<h3>Liste „' + esc(l.name) + '“ in jedem Markt</h3>' + bars(cmp.map(function (r) { var c = U.brandOf(r.store); return { k: r.store, h: U.badge(r.store, "xs") + (r.have < r.of ? " <small>" + r.have + "/" + r.of + "</small>" : ""), c: c[0] === "#ffffff" ? c[1] : c[0], v: r.sum }; })) +
    '<div class="hint">In Klammern: für so viele Artikel ist dort ein Preis bekannt.</div>';
  var ch = [];
  Object.keys(S.products).forEach(function (b) {
    var hs = S.products[b].hist || [];
    for (var i = hs.length - 1; i > 0; i--) {
      for (var j = i - 1; j >= 0; j--) if (hs[j].s === hs[i].s) { if (hs[j].p !== hs[i].p) ch.push({ n: S.products[b].name, s: hs[i].s, a: hs[j].p, z: hs[i].p, d: hs[i].d }); break; }
    }
  });
  ch.sort(function (a, b) { return b.d - a.d; });
  if (ch.length) h += "<h3>Preisänderungen</h3><div class=\"card\">" + ch.slice(0, 10).map(function (c) {
    return '<div class="kv s"><span>' + esc(c.n) + " <small>" + esc(c.s) + " · " + U.day(c.d) + '</small></span><span class="' + (c.z > c.a ? "bad" : "good") + '">' + money(c.a) + " → " + money(c.z) + "</span></div>";
  }).join("") + "</div>";
  if (P.length) {
    h += "<h3>Letzte Einkäufe</h3>";
    P.slice().reverse().slice(0, 15).forEach(function (p) {
      var dd = p.total - p.expected;
      h += '<div class="lrow"><span><b>' + U.day(p.date) + " " + U.badge(p.store, "sm") + "</b><small>" + p.items.length + " Positionen · Liste " + money(p.expected) + ' · <span class="' + (dd > 0 ? "bad" : "good") + '">' + U.signed(dd) + "</span></small></span><b>" + money(p.total) +
        '</b><button class="del" data-act="delp" data-id="' + esc(p.id) + '" aria-label="Löschen">✕</button></div>';
    });
  }
  return h;
}
