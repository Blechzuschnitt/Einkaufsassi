/* Kopf: Markt-Auswahl, Suche mit Vorschlägen; Vorrat-Aktionen und Nachfrage-Dialog */
"use strict";
/* ================= Kopf ================= */
function renderStores() {
  $("storeBtn").innerHTML = '<small>Markt</small>' + U.badge(state.store, "big") + '<span class="caret">' + I("chevron") + '</span>';
  $("cardBtn").classList.toggle("has", !!state.cards[state.store]);
  $("cardBtn").setAttribute("aria-label", state.cards[state.store] ? "Kundenkarte " + state.store + " zeigen" : "Kundenkarte für " + state.store + " hinzufügen");
  var l = S.activeList(), cmp = {};
  S.storeCompare(l).forEach(function (r) { cmp[r.store] = r; });
  var h = '<div class="pophead">Wo kaufst du ein?</div><div class="mgrid">';
  state.stores.forEach(function (s) {
    var r = cmp[s];
    h += '<button type="button" class="mopt' + (s === state.store ? " on" : "") + '" data-s="' + esc(s) + '">' + U.badge(s, "big") +
      "<small>" + (state.cards[s] ? "" + I("qr") + " Karte · " : "") + (r ? "Liste " + money(r.sum) + (r.have < r.of ? " · " + r.have + "/" + r.of : "") : "keine Preise") + "</small></button>";
  });
  h += '<button type="button" class="mopt add" data-s="__add">＋<small>Markt hinzufügen</small></button></div>';
  $("storePop").innerHTML = h;
}
function setStore(v) { state.store = v; S.activeList().store = v; S.save(); render(); }
function togglePop(on) { $("storePop").classList.toggle("open", on); }
$("storeBtn").addEventListener("click", function () { togglePop(!$("storePop").classList.contains("open")); });
$("storePop").addEventListener("click", function (e) {
  var b = e.target.closest("[data-s]");
  if (!b) { if (e.target === this) togglePop(false); return; }
  togglePop(false);
  if (b.dataset.s === "__add") addStore(); else setStore(b.dataset.s);
});
function addStore() {
  openSimple("Markt hinzufügen", "Name des Marktes", "z. B. Netto", "", "Hinzufügen", function (n) {
    if (!n) { msg("Bitte Namen eingeben.", "bad"); return; }
    if (state.stores.indexOf(n) < 0) state.stores.push(n);
    closeEdit(); setStore(n); toast("Markt " + n + " gewählt");
  });
}

/* ---------- Suche mit Vorschlägen ---------- */
var q = $("q"), sugg = $("sugg"), suggList = [];
function score(p, qn, digits) {
  var n = U.norm(p.name);
  if (digits && p.b.indexOf(digits) >= 0) return 4;
  if (n.indexOf(qn) === 0) return 3;
  if ((" " + n).indexOf(" " + qn) >= 0) return 2.5;
  if (n.indexOf(qn) >= 0) return 2;
  var words = qn.split(" ");
  if (words.length > 1 && words.every(function (w) { return n.indexOf(w) >= 0; })) return 1.5;
  var s = U.sim(qn, n); return s > 0.45 ? s : 0;
}
function suggest() {
  var v = q.value.trim(), qn = U.norm(v), digits = /^\d{4,}$/.test(v) ? v : "";
  if (!qn) { sugg.classList.remove("open"); suggList = []; return; }
  suggList = Object.keys(S.products).filter(function (b) { return tab === "pantry" || !S.products[b].loose; }).map(function (b) { var p = S.products[b]; return { b: b, p: p, s: score(p, qn, digits) }; })
    .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s || a.p.name.localeCompare(b.p.name); }).slice(0, 8);
  var h = "";
  suggList.forEach(function (x, i) {
    var pr = S.effPrice(x.b), have = inList(x.b);
    h += '<button type="button" class="sg' + (i === 0 ? " first" : "") + '" data-b="' + esc(x.b) + '">' + thumb(x.p, "sthumb") +
      '<span class="sn">' + esc(x.p.name) + (have ? '<small> · ' + have + "× auf der Liste</small>" : "") + (S.pantryOf(x.b).q ? '<small class="pan"> · ' + I("jar") + ' ' + S.pantryOf(x.b).q + "× im Haus</small>" : "") + "</span>" +
      '<span class="sp' + (pr == null ? " warn" : "") + '">' + (pr == null ? "kein Preis" : money(pr)) + '</span><span class="plus">＋</span></button>';
  });
  if (/^\d{8,14}$/.test(v) && !S.products[v]) h += '<button type="button" class="sg new" data-code="' + esc(v) + '">' + I("scan") + ' Barcode ' + esc(v) + " anlegen</button>";
  else h += '<button type="button" class="sg new" data-new="1">＋ „' + esc(v) + '“ als neuen Artikel anlegen</button>';
  sugg.innerHTML = h; sugg.classList.add("open");
}
function pickSugg(el) {
  if (!el) return;
  var v = q.value.trim();
  q.value = ""; sugg.classList.remove("open"); q.blur();
  if (el.dataset.code) { handleCode(el.dataset.code); return; }
  if (el.dataset.new) { openEdit(null, { name: v, add: true, target: tab === "pantry" ? "pantry" : "list" }); return; }
  if (tab === "pantry") pantryIn(el.dataset.b); else addB(el.dataset.b);
}
function addB(b) {
  askPantry(b, function () {
    var it = S.addToList(b, 1); S.save(); render();
    var pr = S.effPrice(b);
    toast("✓ " + S.products[b].name + (pr != null ? " · " + money(pr) : " · Preis fehlt") + " → " + S.activeList().name + (it.qty > 1 ? " (" + it.qty + "×)" : ""));
  });
}

/* ---------- Vorrat ---------- */
function ago(ts) {
  var d = Math.floor((Date.now() - ts) / 864e5);
  return d <= 0 ? "heute" : d === 1 ? "gestern" : "vor " + d + " Tagen";
}
function pantryIn(b) {
  S.pantryAdd(b, 1, Date.now(), "hand"); S.save(); render();
  toast("" + S.products[b].name + " → Vorrat (" + S.pantryOf(b).q + "× im Haus)");
}
/* Wert eines Stücks für die Wegwerf-Statistik: aktueller Markt, sonst günstigster bekannter Preis */
function unitValue(b) {
  var v = S.effPrice(b); if (v != null) return v;
  var ps = S.products[b] && S.products[b].prices || {}, k = Object.keys(ps);
  return k.length ? Math.min.apply(null, k.map(function (s) { return ps[s]; })) : 0;
}
/* waste: true = weggeworfen, false = verbraucht, undefined = bei abgelaufenem MHD nachfragen */
function pantryOut(b, waste) {
  var p = S.products[b], v = S.pantryOf(b);
  if (!v.q) { toast(p.name + " ist nicht im Vorrat eingetragen"); return; }
  if (waste === undefined && v.exp && daysTo(v.exp) < 0) {
    ask("<b>" + esc(p.name) + "</b> ist " + mhdText(v.exp) + ".", "Verbraucht oder weggeworfen?",
      [{ t: "✓ Verbraucht", fn: function () { pantryOut(b, false); } },
       { t: "Weggeworfen", primary: true, fn: function () { pantryOut(b, true); } }]);
    return;
  }
  waste = !!waste;
  var val = unitValue(b);
  state.outlog.push({ b: b, n: p.name, q: 1, d: Date.now(), w: waste, v: val, loc: S.locOf(b) });
  if (state.outlog.length > 2000) state.outlog.shift();
  var rest = S.pantryTake(b, 1);
  var what = waste ? p.name + " weggeworfen" + (val ? " (≈ " + money(val) + ")" : "") : p.name + " entnommen";
  if (!rest && p.loose) { S.removeProduct(b); S.save(); render(); toast(what + " – aus dem Vorrat entfernt"); return; }
  S.save(); render();
  if (rest) { toast(what + " · noch " + rest + "× im Haus"); return; }
  if (inList(b)) { toast(what + " – nichts mehr da, steht schon auf der Liste"); return; }
  ask((waste ? "" + I("trash") + " <b>" + esc(p.name) + "</b> weggeworfen – jetzt ist nichts mehr da." : "" + I("jar") + " <b>" + esc(p.name) + "</b> ist jetzt aufgebraucht."), "Auf die Einkaufsliste setzen?",
    [{ t: "Ja, auf die Liste", primary: true, fn: function () { S.addToList(b, 1); S.save(); render(); toast("✓ " + p.name + " → " + S.activeList().name); } },
     { t: "Nein", fn: function () {} }]);
}
/* Steht der Artikel noch im Vorrat? Dann erst nachfragen. */
function askPantry(b, proceed) {
  var v = S.pantryOf(b), p = S.products[b];
  if (!v.q || inList(b)) { proceed(); return; }
  ask("" + I("jar") + " <b>" + esc(p.name) + "</b> ist laut Vorrat noch im Haus:<br><b>" + v.q + "×</b> seit " + U.day(v.since) + " (" + ago(v.since) + ").", "Ist noch etwas davon da?",
    [{ t: "Ja, noch da – nicht kaufen", fn: function () { toast(p.name + " bleibt im Vorrat, nicht auf der Liste"); } },
     { t: "Nein, aufgebraucht → auf die Liste", primary: true, fn: function () { S.pantryClear(b); proceed(); } },
     { t: "Trotzdem auf die Liste", fn: proceed }]);
}
function ask(html, question, buttons) {
  var a = $("ask"), wasLive = live.on && !live.paused;
  if (wasLive) pauseLive();
  a.innerHTML = '<div class="asksheet"><div class="asktxt">' + html + '</div><div class="askq">' + esc(question) + '</div><div class="col">' +
    buttons.map(function (x, i) { return '<button type="button" class="btn' + (x.primary ? " primary" : "") + '" data-i="' + i + '">' + esc(x.t) + "</button>"; }).join("") + "</div></div>";
  a.classList.add("open");
  a.onclick = function (e) {
    var bt = e.target.closest("[data-i]"); if (!bt && e.target !== a) return;
    a.classList.remove("open"); a.innerHTML = ""; a.onclick = null;
    if (wasLive) resumeLive();
    if (bt) buttons[+bt.dataset.i].fn();
  };
}
/* Abgehakte Artikel: Einkauf fertig → mit Datum in den Vorrat, als Einkauf speichern */
function finishShopping() {
  var l = S.activeList(), st = state.store, now = Date.now(), items = [], total = 0;
  l.items.filter(function (i) { return i.done; }).forEach(function (it) {
    var p = S.products[it.b]; if (!p) return;
    var pr = S.effPrice(it.b, st), line = (pr || 0) * it.qty + (p.deposit || 0) * it.qty;
    total += line; items.push({ name: p.name, b: it.b, price: line, qty: it.qty });
    S.pantryAdd(it.b, it.qty, now, "kauf");
  });
  if (!items.length) return;
  state.purchases.push({ id: S.uid(), date: now, store: st, list: l.name, total: total, expected: total, items: items, extra: 0, missing: l.items.length - items.length, noBon: true });
  l.items = l.items.filter(function (i) { return !i.done; });
  S.save(); go("pantry");
  toast("✓ Einkauf gespeichert · " + items.length + " Artikel mit Datum im Vorrat", 4000);
}
q.addEventListener("input", suggest);
q.addEventListener("focus", suggest);
q.addEventListener("blur", function () { setTimeout(function () { sugg.classList.remove("open"); }, 150); });
q.addEventListener("keydown", function (e) {
  if (e.key === "Enter") { e.preventDefault(); pickSugg(sugg.querySelector(".sg")); }
  if (e.key === "Escape") { q.value = ""; sugg.classList.remove("open"); q.blur(); }
});
sugg.addEventListener("mousedown", function (e) { e.preventDefault(); });
sugg.addEventListener("click", function (e) { pickSugg(e.target.closest(".sg")); });
$("newBtn").addEventListener("click", function () { openEdit(null, { name: q.value.trim(), add: true }); q.value = ""; sugg.classList.remove("open"); });
