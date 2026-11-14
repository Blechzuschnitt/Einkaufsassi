/* Einkaufsliste */
"use strict";
/* ---------- Einkaufsliste ---------- */
function viewList() {
  var l = S.activeList(), t = S.totals(l), h = '<div class="lhead"><select id="listSel" aria-label="Liste wählen">';
  state.lists.forEach(function (x) { h += '<option value="' + esc(x.id) + '"' + (x.id === l.id ? " selected" : "") + ">" + esc(x.name) + " (" + x.items.length + ")</option>"; });
  h += '<option value="__new">＋ Neue Liste …</option></select><button class="icon" data-act="listmenu" aria-label="Listen-Optionen">⋯</button></div>';
  if (!l.items.length) return h + '<div class="empty">Die Liste ist leer.<br>Oben suchen und antippen, ＋ für einen neuen Artikel<br>oder unten <b>Scannen</b>.</div>';
  var open = l.items.filter(function (i) { return !i.done; }), done = l.items.filter(function (i) { return i.done; });
  var route = F("route") ? state.route[state.store] || {} : {}, known = open.filter(function (i) { return route[i.b] != null; }).length;
  if (known) {
    open = open.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, c) {
      var x = route[a.it.b], y = route[c.it.b];
      if (x == null && y == null) return a.i - c.i; if (x == null) return 1; if (y == null) return -1; return x - y || a.i - c.i;
    }).map(function (o) { return o.it; });
    h += '<div class="muted">↕ sortiert nach deinem Laufweg bei ' + esc(state.store) + "</div>";
  }
  open.concat(done).forEach(function (it, idx) {
    var p = S.products[it.b]; if (!p) return;
    if (idx === open.length && done.length) h += '<div class="sep">Im Wagen</div>';
    var pr = S.effPrice(it.b), reg = S.priceOf(it.b), dep = p.deposit || 0, tag = offerTag(it.b), deal = pr != null && reg != null && pr < reg;
    h += '<div class="row' + (it.done ? " in" : "") + (tag ? " deal" : "") + '" data-b="' + esc(it.b) + '">' +
      '<button class="tick" data-act="done" aria-label="Abhaken">' + (it.done ? "✓" : "") + "</button>" + thumb(p) +
      '<div class="info" data-act="edit"><div class="name">' + esc(p.name) + '</div><div class="sub' + (pr == null ? " warn" : "") + '">' +
      (pr == null ? "Preis fehlt – tippen" : (deal ? '<b class="acc">' + money(pr) + "</b>" : money(pr)) + (it.qty > 1 ? " / Stück" : "")) + (dep ? " · + " + money(dep) + " Pfand" : "") + "</div>" + (tag ? '<div class="sub">' + tag + "</div>" : "") + "</div>" +
      '<div class="right"><div class="price">' + (pr == null ? "–" : money(pr * it.qty + dep * it.qty)) + "</div>" +
      '<div class="qty"><button data-act="minus" aria-label="weniger">−</button><span>' + it.qty + '</span><button data-act="plus" aria-label="mehr">+</button></div></div></div>';
  });
  h += '<div class="card total"><div class="kv"><span>Liste gesamt</span><b class="acc">' + money(t.total) + "</b></div>" +
    (t.dep ? '<div class="kv s"><span>davon Pfand</span><span>' + money(t.dep) + "</span></div>" : "") +
    '<div class="kv s"><span>Im Wagen (' + t.doneN + ")</span><span>" + money(t.doneSum) + "</span></div>" +
    '<div class="kv s"><span>Noch offen</span><span>' + money(t.total - t.doneSum) + "</span></div>" +
    (t.saved ? '<div class="kv s"><span>' + I("tag") + ' Angebote eingerechnet (' + t.offers + ")</span><span class=\"acc\">−" + money(t.saved) + "</span></div>" : "") +
    (t.miss ? '<div class="kv s warn"><span>' + t.miss + " ohne Preis</span><span>nicht eingerechnet</span></div>" : "") + "</div>";
  if (t.doneN) h += '<div class="col"><button class="btn finish" data-act="finish" type="button" style="flex:none">✓ Einkauf fertig – ' + t.doneN + " abgehakte Artikel in den Vorrat</button></div>";
  if (F("offers")) h += '<div class="offbar"><button class="btn" data-act="offers" type="button"' + (opBusy ? " disabled" : "") + ">" + I("tag") + " Angebote prüfen</button>" +
    (opInfo ? '<div class="hint">' + esc(opInfo) + "</div>" : '<div class="hint">Sucht in Open Prices nach in Deutschland gemeldeten Angeboten (letzte 3 Wochen, nur Artikel mit Barcode). Eigene Angebote trägst du im Artikel ein.</div>') + "</div>";
  setTimeout(function () { checkOffers(false); }, 300);
  h += splitNote(l);
  var ch = cheapest(l);
  if (ch) h += '<div class="note">' + I("bulb") + ' Bei ' + U.badge(ch[0].store, "sm") + " kostet diese Liste " + money(ch[0].sum) + " – " + money(ch[1].sum - ch[0].sum) + " weniger als bei " + U.badge(ch[1].store, "sm") + ".</div>";
  h += '<div class="col"><button class="btn primary" data-act="shop" type="button" style="flex:none">' + I("cart") + ' Einkaufsmodus starten</button><button class="btn" data-act="compare" type="button">' + I("receipt") + ' Mit Kassenbon vergleichen</button></div>';
  return h;
}
function itemOf(b) { return S.activeList().items.filter(function (x) { return x.b === b; })[0]; }
