/* Nachkauf-Vorschläge, Rezeptideen, Vorlagen, Preisalarm, Nährwerte */
"use strict";

/* ---------- Nachkauf-Vorschläge aus der Einkaufs-Historie ---------- */
function reorderList() {
  var days = {};
  state.purchases.forEach(function (pu) {
    var d = iso(pu.date);
    (pu.items || []).forEach(function (it) { if (it.b && S.products[it.b]) { var a = days[it.b] || (days[it.b] = []); if (a.indexOf(d) < 0) a.push(d); } });
  });
  var now = Date.now(), out = [];
  Object.keys(days).forEach(function (b) {
    var ds = days[b].sort(); if (ds.length < 3) return;
    var t = ds.map(function (d) { return new Date(d + "T12:00:00").getTime(); }), gaps = [];
    for (var i = 1; i < t.length; i++) gaps.push((t[i] - t[i - 1]) / 864e5);
    var avg = gaps.reduce(function (a, g) { return a + g; }, 0) / gaps.length, since = (now - t[t.length - 1]) / 864e5;
    if (avg < 1 || since < avg * 0.9 || inList(b) || S.pantryOf(b).q) return;
    out.push({ b: b, avg: Math.round(avg), since: Math.floor(since), r: since / avg });
  });
  return out.sort(function (a, b) { return b.r - a.r; });
}
function reorderNote() {
  var r = reorderList(); if (!r.length) return "";
  return '<div class="note re">' + I("repeat") + ' <b>Nachkaufen?</b>' + r.slice(0, 5).map(function (x) {
    return '<div class="kv s"><span>' + esc(S.products[x.b].name) + " <small>alle ~" + x.avg + " Tage, zuletzt vor " + x.since + '</small></span><button class="chip" type="button" data-act="addb" data-b="' + esc(x.b) + '">＋ Liste</button></div>';
  }).join("") + "</div>";
}
ACTS.addb = function (b) { addB(b); };

/* ---------- Rezeptideen für bald ablaufende Sachen ---------- */
function ingredient(name) {
  return String(name).replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|l|stk|er)\b/gi, "").replace(/[^A-Za-zÄÖÜäöüß\s-]/g, " ").split(/[\s-]+/)
    .filter(function (w) { return w.length > 2; }).slice(0, 2).join(" ");
}
function recipeUrl(bs) {
  var words = bs.slice(0, 3).map(function (b) { return ingredient(S.products[b].name); }).filter(Boolean);
  return "https://www.chefkoch.de/rs/s0/" + encodeURIComponent(words.join(" ")).replace(/%20/g, "+") + "/Rezepte.html";
}
function soonKeys(days) {
  return Object.keys(state.pantry).filter(function (b) { var v = S.pantryOf(b); return S.products[b] && v.q && v.exp && daysTo(v.exp) <= days && daysTo(v.exp) >= -1; })
    .sort(function (a, b) { return S.pantryOf(a).exp < S.pantryOf(b).exp ? -1 : 1; });
}
function recipeButton() {
  var ks = soonKeys(3); if (!ks.length) return "";
  return '<button class="btn sm recipe" type="button" data-act="recipe">' + I("pan") + ' Rezeptideen mit ' + ks.slice(0, 3).map(function (b) { return esc(ingredient(S.products[b].name) || S.products[b].name); }).join(", ") + "</button>";
}
ACTS.recipe = function () { var ks = soonKeys(3); if (ks.length) window.open(recipeUrl(ks), "_blank", "noopener"); };

/* ---------- Vorlagen ---------- */
ACTS.tplsave = function () {
  var l = S.activeList(); if (!l.items.length) { toast("Die Liste ist leer."); return; }
  var t = { id: S.uid(), name: l.name, items: l.items.map(function (it) { return { b: it.b, qty: it.qty }; }) };
  state.templates = state.templates.filter(function (x) { return x.name !== t.name; }); state.templates.push(t); S.save();
  closeEdit(); toast("✓ Vorlage „" + t.name + "“ gespeichert (" + t.items.length + " Artikel)");
};
function newListDialog() {
  var tp = state.templates;
  openShell("Neue Einkaufsliste", '<label class="f">Name der Liste</label><input type="text" id="fX" placeholder="z. B. Wocheneinkauf" autocomplete="off">' +
    (tp.length ? '<label class="f">Aus Vorlage – optional</label><div id="tpls">' + tp.map(function (t, i) {
      return '<div class="kv s"><button class="chip tpl" type="button" data-t="' + i + '">' + esc(t.name) + " <small>" + t.items.length + ' Artikel</small></button><button class="chip" type="button" data-tdel="' + i + '">✕</button></div>'; }).join("") + "</div>"
      : '<div class="hint">Tipp: Eine Liste kannst du über ⋯ → „Als Vorlage speichern“ für später merken.</div>') +
    '<div id="msg"></div><div class="col"><button class="btn primary" id="eOk" type="button" style="flex:none">Leere Liste anlegen</button></div>');
  ctx = { simple: true };
  var pick = -1;
  $("eOk").onclick = function () {
    var n = $("fX").value.trim(), t = tp[pick];
    var l = S.newList(n || (t ? t.name : "Einkaufsliste"));
    if (t) t.items.forEach(function (x) { if (S.products[x.b]) S.addToList(x.b, x.qty, l); });
    S.save(); closeEdit(); go("list");
    if (t) toast("✓ " + l.items.length + " Artikel aus „" + t.name + "“");
  };
  if ($("tpls")) $("tpls").onclick = function (e) {
    var d = e.target.closest("[data-tdel]");
    if (d) { if (!d.dataset.sure) { d.dataset.sure = 1; d.textContent = "löschen?"; return; } state.templates.splice(+d.dataset.tdel, 1); S.save(); newListDialog(); return; }
    var x = e.target.closest("[data-t]"); if (!x) return;
    pick = +x.dataset.t;
    Array.prototype.forEach.call(this.querySelectorAll("[data-t]"), function (y) { y.classList.toggle("on", y === x); });
    if (!$("fX").value.trim()) $("fX").placeholder = tp[pick].name;
    $("eOk").textContent = "Liste aus Vorlage anlegen";
  };
  setTimeout(function () { var x = $("fX"); if (x) x.focus(); }, 60);
}

/* ---------- Preisalarm ---------- */
function alarmHits() {
  var out = [];
  Object.keys(S.products).forEach(function (b) {
    var p = S.products[b]; if (!p.alarm) return;
    var best = null, add = function (s, v, how) { if (v != null && v <= p.alarm && (!best || v < best.v)) best = { s: s, v: v, how: how }; };
    S.offersOf(b).forEach(function (o) { add(o.s, o.p, "Angebot bis " + dm(o.until)); });
    ((p.op && p.op.hits) || []).forEach(function (h) { add(h.brand, h.price, "gemeldet " + dm(h.date)); });
    Object.keys(p.prices || {}).forEach(function (s) { add(s, p.prices[s], "Normalpreis"); });
    if (best) out.push({ b: b, hit: best });
  });
  return out;
}
function alarmNote() {
  if (Object.keys(S.products).some(function (b) { return S.products[b].alarm; })) setTimeout(function () { checkOffers(false); }, 400);
  var a = alarmHits(); if (!a.length) return "";
  return '<div class="note alarm">' + I("bell") + ' <b>Preisalarm</b>' + a.map(function (x) {
    var p = S.products[x.b];
    return '<div class="kv s"><span>' + esc(p.name) + " – " + esc(x.hit.s) + " <b>" + money(x.hit.v) + "</b> <small>(Wunsch " + money(p.alarm) + ", " + x.hit.how + ')</small></span><button class="chip" type="button" data-act="addb" data-b="' + esc(x.b) + '">＋ Liste</button></div>';
  }).join("") + "</div>";
}

/* ---------- Nährwerte ---------- */
var NS = { a: "#038141", b: "#85bb2f", c: "#fecb02", d: "#ee8100", e: "#e63e11" };
function nutriBadge(p, big) {
  var g = p && p.nutri && p.nutri.g; if (!g || !NS[g]) return "";
  return '<span class="ns' + (big ? " big" : "") + '" style="background:' + NS[g] + (g === "c" ? ";color:#000" : "") + '" title="Nutri-Score ' + g.toUpperCase() + '">' + g.toUpperCase() + "</span>";
}
function nutriBlock(p) {
  var n = p && p.nutri; if (!n) return "";
  var f = function (v, u) { return v == null ? "–" : (Math.round(v * 10) / 10).toString().replace(".", ",") + " " + u; };
  return '<h3>Nährwerte <small>je 100 g/ml</small></h3><div class="card nutri">' + (n.g ? '<div class="kv s"><span>Nutri-Score</span>' + nutriBadge(p, true) + "</div>" : "") +
    '<div class="kv s"><span>Energie</span><span>' + f(n.kcal, "kcal") + '</span></div><div class="kv s"><span>Zucker</span><span>' + f(n.sugar, "g") + "</span></div>" +
    '<div class="kv s"><span>Fett</span><span>' + f(n.fat, "g") + '</span></div><div class="kv s"><span>Eiweiß</span><span>' + f(n.prot, "g") + '</span></div><div class="kv s"><span>Salz</span><span>' + f(n.salt, "g") + "</span></div>" +
    '<div class="hint" style="margin:6px 0 0">Quelle: Open Food Facts</div></div>';
}
