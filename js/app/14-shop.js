/* Einkaufsmodus im Laden (große Anzeige, nur offene Artikel) und Liste auf Märkte aufteilen */
"use strict";

/* ---------- Einkaufsmodus ---------- */
var shopLock = null;
function enterShop() {
  go("shop");
  try { if (navigator.wakeLock && !shopLock) navigator.wakeLock.request("screen").then(function (w) { shopLock = w; }).catch(function () {}); } catch (e) {}
}
function exitShop() {
  if (shopLock) { shopLock.release().catch(function () {}); shopLock = null; }
  if (live.on) closeScan();
  go("list");
}
function sortedOpen(l) {
  var route = state.route[state.store] || {};
  return l.items.filter(function (i) { return !i.done; }).map(function (it, i) { return { it: it, i: i }; }).sort(function (a, c) {
    var x = route[a.it.b], y = route[c.it.b];
    if (x == null && y == null) return a.i - c.i; if (x == null) return 1; if (y == null) return -1; return x - y || a.i - c.i;
  }).map(function (o) { return o.it; });
}
VIEWS.shop = function () {
  var l = S.activeList(), t = S.totals(l), open = sortedOpen(l), done = l.items.filter(function (i) { return i.done; });
  var h = '<div class="shophead">' + U.badge(state.store, "sm") + "<b>" + esc(l.name) + '</b><button class="btn" data-act="shopexit" type="button">✕ Beenden</button></div>' +
    '<div class="shopsum"><div><small>Im Wagen</small><b>' + money(t.doneSum) + '</b></div><div><small>Noch offen (' + open.length + ')</small><b>' + money(t.total - t.doneSum) + "</b></div></div>";
  if (!open.length) h += '<div class="shopdone">✓ Alles im Wagen</div><div class="col"><button class="btn primary" data-act="finish" type="button" style="flex:none">✓ Einkauf fertig – ab in den Vorrat</button>' +
    '<button class="btn" data-act="compare" type="button">' + I("receipt") + ' Mit Kassenbon vergleichen</button></div>';
  open.forEach(function (it) {
    var p = S.products[it.b]; if (!p) return;
    var pr = S.effPrice(it.b), tag = offerTag(it.b);
    h += '<button type="button" class="row shoprow" data-b="' + esc(it.b) + '" data-act="shopdone"><span class="sq">' + (it.qty > 1 ? it.qty + "×" : "") + '</span><span class="sn">' + esc(p.name) +
      (tag ? "<br>" + tag : "") + '</span><span class="sp">' + (pr == null ? "–" : money(pr * it.qty)) + "</span></button>";
  });
  if (done.length) {
    h += '<div class="sep">Im Wagen (' + done.length + ") – antippen zum Zurücklegen</div>";
    done.forEach(function (it) { var p = S.products[it.b]; if (p) h += '<button type="button" class="row shoprow in" data-b="' + esc(it.b) + '" data-act="shopundo"><span class="sq">✓</span><span class="sn">' + esc(p.name) + "</span></button>"; });
  }
  return h;
};
ACTS.shop = function () { enterShop(); };
ACTS.shopexit = function () { exitShop(); };
ACTS.shopdone = function (b) { shopTick(b); };
ACTS.shopundo = function (b) { var it = itemOf(b); if (it) { it.done = false; S.save(); render(); } };
function shopTick(b) {
  var l = S.activeList(), it = itemOf(b); if (!it) return;
  var before = l.items.filter(function (x) { return x.done; }).length;
  it.done = true; S.learnRoute(state.store, b, before / Math.max(1, l.items.length - 1));
  S.save(); render();
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
}
/* Scannen im Einkaufsmodus = abhaken (oder dazulegen, wenn nicht auf der Liste) */
function shopScan(code) {
  var it = itemOf(code), p = S.products[code];
  if (it && !it.done) { shopTick(code); toast("✓ " + p.name + " im Wagen"); return; }
  if (it && it.done) { it.qty++; S.save(); render(); toast(p.name + " · jetzt " + it.qty + "× im Wagen"); return; }
  var n = S.addToList(code, 1); n.done = true; S.save(); render(); toast("＋ " + p.name + " (nicht geplant) im Wagen");
}

/* ---------- Liste auf Märkte aufteilen ---------- */
function splitPlan(l) {
  var groups = {}, unpriced = [], total = 0, priced = [];
  l.items.forEach(function (it) {
    var p = S.products[it.b]; if (!p) return;
    var best = null, bp = Infinity;
    state.stores.forEach(function (s) { var v = S.effPrice(it.b, s); if (v != null && v < bp) { bp = v; best = s; } });
    if (!best) { unpriced.push(it); return; }
    var line = (bp + (p.deposit || 0)) * it.qty;
    (groups[best] || (groups[best] = { items: [], sum: 0 })).items.push(it); groups[best].sum += line; total += line; priced.push(it);
  });
  var single = state.stores.map(function (s) {
    var sum = 0, ok = true;
    priced.forEach(function (it) { var v = S.effPrice(it.b, s); if (v == null) ok = false; else sum += (v + (S.products[it.b].deposit || 0)) * it.qty; });
    return ok ? { store: s, sum: sum } : null;
  }).filter(Boolean).sort(function (a, b) { return a.sum - b.sum; })[0] || null;
  return { groups: groups, total: total, single: single, unpriced: unpriced };
}
function splitNote(l) {
  var sp = splitPlan(l), ks = Object.keys(sp.groups).sort(function (a, b) { return sp.groups[b].items.length - sp.groups[a].items.length; });
  if (ks.length < 2) return "";
  var save = sp.single ? sp.single.sum - sp.total : null, worth = save == null || save >= 100;
  return '<div class="note split">' + I("split") + ' <b>Aufteilen?</b> ' + ks.map(function (s) { return U.badge(s, "sm") + " " + sp.groups[s].items.length; }).join(" · ") + " = " + money(sp.total) +
    (save != null ? "<br>" + (worth ? "spart " + money(save) + " gegenüber nur " + U.badge(sp.single.store, "sm") : "spart nur " + money(save) + " – lohnt kaum, alles bei " + U.badge(sp.single.store, "sm")) : "<br>Kein Markt hat Preise für alles.") +
    (sp.unpriced.length ? '<br><small>' + sp.unpriced.length + " Artikel ohne Preis nicht berücksichtigt</small>" : "") +
    (worth ? '<div class="col" style="margin-top:8px"><button class="btn" data-act="split" type="button">Liste nach Märkten aufteilen</button></div>' : "") + "</div>";
}
ACTS.split = function () {
  var l = S.activeList(), sp = splitPlan(l), ks = Object.keys(sp.groups).sort(function (a, b) { return sp.groups[b].items.length - sp.groups[a].items.length; });
  if (ks.length < 2) return;
  var keep = ks[0], made = [];
  l.store = keep;
  ks.slice(1).forEach(function (s) {
    var nl = { id: S.uid(), name: l.name + " – " + s, store: s, created: Date.now(), items: [] };
    sp.groups[s].items.forEach(function (it) { nl.items.push(it); });
    l.items = l.items.filter(function (it) { return sp.groups[s].items.indexOf(it) < 0; });
    state.lists.push(nl); made.push(s);
  });
  state.store = keep; S.save(); render();
  toast("✓ Aufgeteilt: " + keep + " bleibt hier, neu: " + made.map(function (s) { return l.name + " – " + s; }).join(", "), 5000);
};
