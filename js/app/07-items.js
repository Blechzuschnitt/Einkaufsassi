/* Artikel-Seite */
"use strict";
/* ---------- Alle Artikel ---------- */
var iFilter = "", iSort = "name";
function viewItemsShell() {
  return '<div class="ihead"><input type="search" id="iq" placeholder="Artikel filtern …" value="' + esc(iFilter) + '" autocomplete="off">' +
    '<select id="isort" aria-label="Sortierung"><option value="name">A–Z</option><option value="new">Neueste</option><option value="miss">Ohne Preis</option><option value="cheap">Preis ↑</option><option value="dear">Preis ↓</option></select></div>' +
    '<div class="muted" id="icount"></div><div id="irows"></div>';
}
function renderItemRows() {
  $("isort").value = iSort;
  var qn = U.norm(iFilter), keys = Object.keys(S.products).filter(function (b) { return !S.products[b].loose; }), miss = 0;
  var rows = keys.map(function (b) { return S.products[b]; }).filter(function (p) {
    if (S.priceOf(p.b) == null) miss++;
    return !qn || U.norm(p.name).indexOf(qn) >= 0 || p.b.indexOf(iFilter) >= 0;
  });
  var pr = function (p) { var v = S.priceOf(p.b); return v == null ? Infinity : v; };
  rows.sort(function (a, b) {
    if (iSort === "miss") return (pr(b) === Infinity) - (pr(a) === Infinity) || a.name.localeCompare(b.name);
    if (iSort === "cheap") return pr(a) - pr(b);
    if (iSort === "dear") return (pr(b) === Infinity ? -1 : pr(b)) - (pr(a) === Infinity ? -1 : pr(a));
    if (iSort === "new") return keys.indexOf(b.b) - keys.indexOf(a.b);
    return a.name.localeCompare(b.name, "de");
  });
  $("icount").textContent = keys.length + " Artikel erfasst · " + miss + " ohne Preis bei " + state.store + (qn ? " · " + rows.length + " gefunden" : "");
  var h = "";
  rows.forEach(function (p) {
    var v = S.effPrice(p.b), others = [], have = inList(p.b), tg = offerTag(p.b);
    Object.keys(p.prices || {}).forEach(function (s) { if (s !== state.store) others.push(U.badge(s, "xs") + " " + money(p.prices[s])); });
    h += '<div class="row" data-b="' + esc(p.b) + '">' + thumb(p) + '<div class="info" data-act="edit"><div class="name">' + nutriBadge(p) + esc(p.name) + "</div>" +
      '<div class="sub">' + (others.length ? others.join(" · ") : (p.b.indexOf("r-") === 0 ? "ohne Barcode" : esc(p.b))) + (p.deposit ? " · Pfand " + money(p.deposit) : "") + "</div>" + (tg ? '<div class="sub">' + tg + "</div>" : "") + "</div>" +
      '<div class="price' + (v == null ? " warn" : "") + '">' + (v == null ? "–" : money(v)) + "</div>" +
      '<button class="addb' + (have ? " on" : "") + '" data-act="add" aria-label="Auf die Liste">' + (have ? have + "×" : "＋") + "</button></div>";
  });
  $("irows").innerHTML = h || '<div class="empty">Nichts gefunden.</div>';
}
