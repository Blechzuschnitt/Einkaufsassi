/* Vorrat-Seite: Fächer, Füllstand, Wegwerf-Statistik, lose Ware */
"use strict";
/* ---------- Vorrat-Seite (Trocken / Kühlschrank / Gefrierschrank) ---------- */
var pLoc = "all";
function shortLoc(t) { return { Haushaltsartikel: "Haushalt", Badezimmer: "Bad" }[t] || t.replace("schrank", ""); }
function locInfo(k) { return S.LOCS.filter(function (l) { return l.k === k; })[0] || S.LOCS[0]; }
function viewPantry() {
  var keys = Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.pantryOf(b).q > 0; });
  var cnt = { all: keys.length }; S.LOCS.forEach(function (l) { cnt[l.k] = 0; });
  keys.forEach(function (b) { cnt[S.locOf(b)]++; });
  var h = recipeButton() + '<div class="locchips"><button type="button" class="lc' + (pLoc === "all" ? " on" : "") + '" data-act="ploc" data-l="all"><span>Alle</span><b>' + cnt.all + "</b></button>" +
    S.LOCS.map(function (l) { return '<button type="button" class="lc l-' + l.k + (pLoc === l.k ? " on" : "") + '" data-act="ploc" data-l="' + l.k + '">' + "<span>" + locIco(l) + " " + shortLoc(l.t) + "</span><b>" + cnt[l.k] + "</b></button>"; }).join("") + "</div>";
  if (!keys.length) return h + '<div class="empty">Noch nichts im Vorrat.<br>Oben einen Artikel suchen, unten <b>Einlagern</b> scannen,<br><b>Reste</b> eintragen oder nach dem Einkauf „Einkauf fertig“ tippen.</div>';
  keys.sort(function (a, b) {
    var x = S.pantryOf(a), y = S.pantryOf(b);
    if (x.exp && y.exp) return x.exp < y.exp ? -1 : x.exp > y.exp ? 1 : x.since - y.since;
    if (x.exp) return -1; if (y.exp) return 1; return x.since - y.since;
  });
  S.LOCS.forEach(function (l) {
    if (pLoc !== "all" && pLoc !== l.k) return;
    var ks = keys.filter(function (b) { return S.locOf(b) === l.k; });
    if (!ks.length) { if (pLoc === l.k) h += '<div class="empty">Nichts im Fach ' + l.t + ".</div>"; return; }
    var pcs = ks.reduce(function (a, b) { return a + S.pantryOf(b).q; }, 0);
    h += '<div class="lochead l-' + l.k + '">' + locIco(l) + " " + l.t + "<small>" + ks.length + " Artikel · " + pcs + " Stück</small></div>";
    ks.forEach(function (b) { h += pantryRow(b, l); });
  });
  var w = wasteSum(monthKey(Date.now()));
  h += '<button class="card wastecard" data-go="stats" type="button"><div class="kv"><span>' + I("trash") + ' Diesen Monat weggeworfen</span><b>' + w.n + " × · " + money(w.v) + "</b></div>" +
    '<div class="sub">' + (w.n + w.used ? Math.round(w.n / (w.n + w.used) * 100) + " % von allem, was aus dem Lager kam · Details in der Statistik" : "Noch nichts ausgelagert. Beim Entnehmen " + I("trash") + " tippen, wenn etwas schlecht geworden ist.") + "</div></button>";
  return h;
}
function wasteSum(month) {
  var r = { n: 0, v: 0, used: 0 };
  state.outlog.forEach(function (o) { if (month && monthKey(o.d) !== month) return; if (o.w) { r.n += o.q; r.v += o.v * o.q; } else r.used += o.q; });
  return r;
}
function wasteStats() {
  var L = state.outlog; if (!L.length) return "";
  var all = wasteSum(), mon = wasteSum(monthKey(Date.now())), h = '<h3>Lager: weggeworfen</h3><div class="tiles">' +
    '<div class="tile"><b>' + mon.n + " × · " + money(mon.v) + "</b><span>diesen Monat</span></div>" +
    '<div class="tile"><b>' + (all.n + all.used ? Math.round(all.n / (all.n + all.used) * 100) : 0) + " %</b><span>Wegwerf-Quote (" + all.n + " von " + (all.n + all.used) + ")</span></div></div>";
  var months = [], d = new Date();
  for (var i = 5; i >= 0; i--) { var m = new Date(d.getFullYear(), d.getMonth() - i, 1), k = monthKey(m), ws = wasteSum(k);
    months.push({ k: m.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), v: ws.v, h2: ws.n }); }
  if (all.n) h += bars(months.map(function (x) { return { k: x.k, v: x.v }; }));
  var by = {}, loc = {};
  L.forEach(function (o) { if (!o.w) return; var t = by[o.n] || (by[o.n] = { n: 0, v: 0 }); t.n += o.q; t.v += o.v * o.q; loc[o.loc || "trocken"] = (loc[o.loc || "trocken"] || 0) + o.q; });
  var top = Object.keys(by).map(function (k) { return { k: k, n: by[k].n, v: by[k].v }; }).sort(function (a, b) { return b.n - a.n || b.v - a.v; }).slice(0, 6);
  if (top.length) h += '<div class="card">' + top.map(function (x) { return '<div class="kv s"><span>' + x.n + "× " + esc(x.k) + "</span><span>" + (x.v ? money(x.v) : "–") + "</span></div>"; }).join("") +
    '<div class="kv s"><span>nach Fach</span><span>' + S.LOCS.map(function (l) { return locIco(l) + " " + (loc[l.k] || 0); }).join("  ") + "</span></div></div>";
  else h += '<div class="hint">Bisher nichts weggeworfen </div>';
  return h;
}
function pantryRow(b, l) {
  var p = S.products[b], v = S.pantryOf(b), old = Date.now() - v.since > (l.k === "tk" ? 90 : l.k === "kuehl" ? 7 : 60) * 864e5;
  var lots = v.lots.slice().sort(function (x, y) { return x.d - y.d; }).map(function (x) { return x.q + "× " + U.day(x.d) + (x.src === "kauf" ? " " + I("cart") + "" : ""); }).join(" · ");
  return '<div class="row l-' + l.k + (old ? " old" : "") + '" data-b="' + esc(b) + '">' +
    '<button class="locbtn" data-act="setloc" aria-label="Lagerort ändern">' + locIco(l) + "</button>" + thumb(p) +
    '<div class="info" data-act="edit"><div class="name">' + esc(p.name) + '</div><div class="since">seit ' + U.day(v.since) + " · " + ago(v.since) + "</div>" +
      (v.exp ? '<button class="mhd ' + mhdClass(v.exp) + '" data-act="mhd" type="button">' + mhdText(v.exp) + "</button>" : '<button class="mhd none" data-act="mhd" type="button">＋ MHD</button>') + (p.loose ? '<div class="sub"><span class="ltag">lose</span>' + (p.note ? " " + esc(p.note) : "") + "</div>" : v.lots.length === 1 && v.lots[0].src === "kauf" ? '<div class="sub">' + I("cart") + ' eingekauft</div>' : "") +
    (v.lots.length > 1 ? '<div class="sub">' + lots + "</div>" : "") +
    (p.fill ? fillBar(p) : "") + "</div>" +
    '<div class="right"><div class="rbtns"><button class="waste" data-act="pwaste" aria-label="Eins weggeworfen">' + ico(IC.trash) + "</button>" + (p.loose ? "" : '<button class="tolist' + (inList(b) ? " on" : "") + '" data-act="tolist" aria-label="Auf die Einkaufsliste">' + I("cart") + '</button>') + "</div>" +
    '<div class="qty"><button data-act="pout" aria-label="eins entnehmen">−</button><span>' + v.q + '</span><button data-act="pin" aria-label="eins dazu">+</button></div></div></div>';
}
/* ---------- Füllstand (angebrochene Packung) ---------- */
function fillBar(p) {
  var lv = p.level == null ? 100 : p.level, cls = lv <= 25 ? " low" : "";
  return '<button class="fill' + cls + '" data-act="fill" type="button" aria-label="Füllstand ' + lv + ' Prozent – tippen zum Ändern">' +
    '<span class="fbar"><i style="width:' + Math.max(4, lv) + '%"></i></span><b>' + (lv >= 100 ? "voll" : lv + " %") + "</b></button>";
}
function askFill(b) {
  var p = S.products[b], set = function (lv) { return function () {
    p.level = lv; S.save(); render();
    if (lv <= 25 && !inList(b) && !p.loose) ask("<b>" + esc(p.name) + "</b> ist fast leer.", "Schon mal auf die Einkaufsliste setzen?",
      [{ t: "Ja, auf die Liste", primary: true, fn: function () { S.addToList(b, 1); S.save(); render(); toast("✓ " + p.name + " → " + S.activeList().name); } }, { t: "Nein", fn: function () {} }]);
  }; };
  ask("Füllstand von <b>" + esc(p.name) + "</b>" + (S.pantryOf(b).q > 1 ? "<br><small>gilt für die angebrochene Packung</small>" : ""), "Wie voll ist es noch?",
    [{ t: "Voll", fn: set(100) }, { t: "¾", fn: set(75) }, { t: "½", fn: set(50) }, { t: "¼ – fast leer", fn: set(25) },
     { t: "Leer – aufgebraucht", primary: true, fn: function () { p.level = 100; pantryOut(b, false); } }]);
}
function chooseLoc(b) {
  var p = S.products[b];
  ask("Wo lagert <b>" + esc(p.name) + "</b>?", "Lagerort wählen", S.LOCS.map(function (l) {
    return { t: l.t, primary: S.locOf(b) === l.k, fn: function () { p.loc = l.k; S.save(); render(); } };
  }));
}

/* Lose Ware / Reste: ohne Barcode, ohne Preis, nur im Vorrat (z. B. eingefrorene Reste) */
function openLoose(b) {
  var p = b ? S.products[b] : null, v = b ? S.pantryOf(b) : null, loc = p ? S.locOf(b) : "tk";
  var d = new Date(v ? v.since : Date.now()), ds = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  openShell(p ? "Lose Ware" : "Lose Ware / Reste",
    '<div class="hint" style="margin-top:0">Für Reste, Selbstgekochtes, Obst vom Markt … – ohne Barcode und Preis, nur im Vorrat. Ist es aufgebraucht, verschwindet es von selbst.</div>' +
    '<label class="f">Was ist es?</label><input type="text" id="lN" value="' + esc(p ? p.name : "") + '" placeholder="z. B. Bolognese-Reste" autocomplete="off">' +
    '<label class="f">Menge / Notiz – optional</label><input type="text" id="lNote" value="' + esc(p && p.note || "") + '" placeholder="z. B. 2 Portionen, 500 g" autocomplete="off">' +
    '<label class="f">Anzahl (Dosen, Beutel, Boxen …)</label><div class="qty big"><button type="button" id="lM">−</button><span id="lQ">' + (v ? v.q : 1) + '</span><button type="button" id="lP">+</button></div>' +
    '<label class="f">Wo?</label><div class="chips2" id="lLoc">' + S.LOCS.map(function (x) {
      return '<button class="chip loc l-' + x.k + (loc === x.k ? " on" : "") + '" type="button" data-loc="' + x.k + '">' + locIco(x) + " " + x.t + "</button>"; }).join("") + "</div>" +
    '<label class="check"><input type="checkbox" id="lFill"' + (p && p.fill ? " checked" : "") + '> Füllstand anzeigen <small>(für angebrochene Packungen: Öl, Mehl, Kaffee …)</small></label>' +
    '<label class="f">Eingelagert / eingefroren am</label><input type="date" id="lD" class="datein" value="' + ds + '">' +
    '<label class="f">Haltbar bis (MHD) – optional</label><input type="date" id="lE" class="datein" value="' + (v && v.exp || "") + '">' +
    '<div class="chips2" id="lEq"><button class="chip" type="button" data-n="3">+3 Tage</button><button class="chip" type="button" data-n="30">+1 Monat</button><button class="chip" type="button" data-n="91">+3 Monate</button><button class="chip" type="button" data-n="182">+6 Monate</button></div>' +
    '<div id="msg"></div><div class="col"><button class="btn primary" id="lSave" type="button" style="flex:none">' + (p ? "Speichern" : "" + I("loose") + " In den Vorrat") + "</button>" +
    (p ? '<button class="btn danger" id="lDel" type="button">Aus dem Vorrat entfernen</button>' : "") + "</div>");
  ctx = { simple: true };
  var qn = v ? v.q : 1;
  $("lM").onclick = function () { if (qn > 1) $("lQ").textContent = --qn; };
  $("lP").onclick = function () { $("lQ").textContent = ++qn; };
  $("lEq").onclick = function (e) { var x = e.target.closest("[data-n]"); if (!x) return; var base = $("lD").value ? new Date($("lD").value + "T12:00:00").getTime() : Date.now(); $("lE").value = iso(base + +x.dataset.n * 864e5); };
  $("lLoc").onclick = function (e) { var x = e.target.closest("[data-loc]"); if (!x) return; loc = x.dataset.loc;
    Array.prototype.forEach.call(this.querySelectorAll("[data-loc]"), function (y) { y.classList.toggle("on", y === x); }); };
  $("lSave").onclick = function () {
    var name = $("lN").value.trim(); if (!name) { msg("Bitte eintragen, was es ist.", "bad"); $("lN").focus(); return; }
    var dv = $("lD").value, ts = dv ? new Date(dv + "T12:00:00").getTime() : Date.now();
    if (!b) { b = S.newKey(name, "l-"); S.products[b] = { b: b, name: name, prices: {}, loose: true, created: Date.now() }; }
    var q = S.products[b]; q.name = name; q.loc = loc; q.loose = true;
    if ($("lFill").checked) { q.fill = true; if (q.level == null) q.level = 100; } else { delete q.fill; delete q.level; }
    if ($("lNote").value.trim()) q.note = $("lNote").value.trim(); else delete q.note;
    S.pantryClear(b); S.pantryAdd(b, qn, ts, "lose", $("lE").value || "");
    S.save(); closeEdit(); pLoc = "all"; go("pantry");
    toast("" + name + " → " + locInfo(loc).t + " (" + qn + "×)");
  };
  if ($("lDel")) sure($("lDel"), function () { S.removeProduct(b); S.save(); closeEdit(); render(); toast("Entfernt"); });
  if (!p) setTimeout(function () { var x = $("lN"); if (x) x.focus(); }, 60);
}
