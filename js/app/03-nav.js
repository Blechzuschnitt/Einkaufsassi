/* Navigation: Seiten wechseln, untere Leiste (Einkaufen | Lager), Summenzeile */
"use strict";
/* ================= Seiten ================= */
var lastShop = "home";
function go(t) { tab = t; if (t !== "pantry") lastShop = t; window.scrollTo(0, 0); render(); }

/* ---------- Untere Leiste: Bereich Einkaufen | Lager, je Bereich eigene Symbole ---------- */
function area() { return tab === "pantry" ? "lager" : "einkauf"; }
function renderTabs() {
  var ar = area(), btn = function (attr, icon, label, on) { return '<button type="button" ' + attr + (on ? ' class="on"' : "") + ">" + ico(IC[icon]) + "<span>" + label + "</span></button>"; };
  var scanOn = function (m) { return live.on && scanMode === m; };
  var left, right;
  if (ar === "lager") {
    left = btn('data-tab="pantry"', "jar", "Vorrat", !live.on) + btn('data-scan="in"', "pin", "Einlagern", scanOn("in"));
    right = btn('data-scan="out"', "pout", "Entnehmen", scanOn("out") || scanOn("waste")) + btn('data-act="loose"', "loose", "Reste", false);
  } else {
    left = btn('data-tab="home"', "home", "Start", tab === "home") + btn('data-tab="list"', "list", "Liste", tab === "list");
    right = btn('data-scan="list"', "scan", "Scannen", scanOn("list")) + btn('data-tab="stats"', "stats", "Statistik", tab === "stats");
  }
  var lager = ar === "lager";
  $("tabs").innerHTML = left + '<button type="button" class="area' + (lager ? " lager" : "") + '" data-toggle="1" aria-label="Bereich: ' + (lager ? "Lager" : "Einkaufen") + ' – tippen zum Wechseln">' +
    '<span class="aico">' + ico(lager ? IC.jar : IC.cart, 2.2) + '</span><span class="alab">' + (lager ? "Lager" : "Einkaufen") + '</span><span class="aswap">' + I("swap") + '</span></button>' + right;
}
$("tabs").addEventListener("click", function (e) {
  var b = e.target.closest("button"); if (!b) return;
  if (b.dataset.toggle) { if (live.on) closeScan(); if (area() === "einkauf") go("pantry"); else go(lastShop); return; }
  if (b.dataset.tab) { if (live.on) closeScan(); go(b.dataset.tab); return; }
  if (b.dataset.scan) { var m = b.dataset.scan; if (live.on && scanMode === m) closeScan(); else if (live.on) { setMode(m); renderTabs(); } else openScan(m); return; }
  if (b.dataset.act === "loose") openLoose(null);
});
function render() {
  renderStores();
  renderTabs();
  var v = $("view");
  v.className = "p-" + tab;
  if (tab === "home") v.innerHTML = viewHome();
  else if (tab === "list") v.innerHTML = viewList();
  else if (tab === "items") { v.innerHTML = viewItemsShell(); renderItemRows(); }
  else if (tab === "stats") v.innerHTML = viewStats();
  else if (tab === "pantry") v.innerHTML = viewPantry();
  else if (VIEWS[tab]) v.innerHTML = VIEWS[tab]();
  document.body.classList.toggle("shopmode", tab === "shop");
  q.placeholder = tab === "pantry" ? "Suchen → Vorrat" : "Suchen → Liste";
  renderSumbar();
}
function renderSumbar() {
  if (tab === "pantry") {
    var ks = Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.pantryOf(b).q > 0; });
    var soon = ks.filter(function (b) { var e = S.pantryOf(b).exp; return e && daysTo(e) <= 3; }).length;
    $("sumbar").innerHTML = '<span class="sl"><b>Lager</b> · ' + S.LOCS.map(function (l) { return locIco(l) + " " + ks.filter(function (b) { return S.locOf(b) === l.k; }).length; }).join("  ") +
      (soon ? ' · <span class="warn">' + soon + " laufen bald ab</span>" : "") + '</span><b class="sv">' + ks.length + "</b>";
    return;
  }
  var l = S.activeList(), t = S.totals(l);
  $("sumbar").innerHTML = '<span class="sl"><b>' + esc(l.name) + "</b> · " + t.n + " Artikel" +
    (t.doneN ? ' · <span class="acc">' + t.doneN + " im Wagen</span>" : "") + (t.miss ? ' · <span class="warn">' + t.miss + " ohne Preis</span>" : "") +
    '</span><b class="sv">' + money(t.total) + "</b>";
}

$("sumbar").addEventListener("click", function () { if (tab !== "list" && tab !== "pantry") go("list"); });


function monthKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
function cheapest(l) {
  var all = S.storeCompare(l).filter(function (r) { return r.of > 0 && r.have === r.of; }).sort(function (a, b) { return a.sum - b.sum; });
  return all.length >= 2 ? all : null;
}
