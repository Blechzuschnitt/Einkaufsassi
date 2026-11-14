/* Start-Seite, Sicherungs-Erinnerung, MHD, Budget, Preisverlauf, Spracheingabe */
"use strict";
/* ---------- Start / Dashboard ---------- */
function viewHome() {
  var l = S.activeList(), t = S.totals(l), P = state.purchases, now = monthKey(Date.now());
  var month = P.filter(function (p) { return monthKey(p.date) === now; }).reduce(function (a, p) { return a + p.total; }, 0);
  var nArt = Object.keys(S.products).filter(function (b) { return !S.products[b].loose; }).length;
  var h = '<section class="hero" data-go="list"><div class="k">Aktive Liste · <b>' + esc(l.name) + "</b> " + U.badge(state.store, "sm") + "</div>" +
    '<div class="big">' + money(t.total) + "</div>" +
    '<div class="sub">' + t.n + " Artikel" + (t.dep ? " · inkl. " + money(t.dep) + " Pfand" : "") +
    (t.doneN ? " · im Wagen " + money(t.doneSum) : "") + "</div>" +
    (t.miss ? '<div class="sub warn">' + t.miss + " Artikel ohne Preis bei " + esc(state.store) + " – nicht eingerechnet</div>" : "") + "</section>";
  h = backupNote() + h + expiryNote() + alarmNote() + reorderNote() + budgetCard(t.total);
  h += '<div class="quick"><button class="btn primary" data-act="scan">Scannen</button><button class="btn" data-act="new">＋ Neuer Artikel</button><button class="btn" data-act="compare">' + I("receipt") + ' Bon</button></div>';
  var deals = l.items.filter(function (it) { return offerTag(it.b); });
  if (deals.length) h += '<div class="note deal" data-go="list">' + I("tag") + ' <b>' + deals.length + " Artikel deiner Liste im Angebot</b>" + (t.saved ? " · bei " + esc(state.store) + " schon " + money(t.saved) + " gespart" : "") + "<br>" +
    deals.slice(0, 4).map(function (it) { return esc(S.products[it.b].name) + " – " + offerTag(it.b).replace(/<[^>]+>/g, "").replace("" + I("tag") + " ", ""); }).join("<br>") + (deals.length > 4 ? "<br>…" : "") + "</div>";
  var ch = cheapest(l);
  if (ch) h += '<div class="note">' + I("bulb") + ' Diese Liste ist bei ' + U.badge(ch[0].store, "sm") + " am günstigsten (" + money(ch[0].sum) + "), " +
    U.badge(ch[1].store, "sm") + " wäre " + money(ch[1].sum - ch[0].sum) + " teurer.</div>";
  h += '<div class="tiles">' +
    tile(nArt, "Artikel erfasst", "items", "c-items") + tile(state.lists.length, "Einkaufslisten", "list", "c-list") +
    tile(Object.keys(state.pantry).length, "im Vorrat · " + S.LOCS.map(function (l) { return locIco(l) + " " + Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.locOf(b) === l.k; }).length; }).join(" "), "pantry", "c-pantry") + tile(money(month), "Ausgaben diesen Monat", "stats", "c-home") + "</div>";
  h += '<h3>Einkaufslisten</h3>';
  state.lists.forEach(function (x) {
    var tt = S.totals(x, x.store || state.store);
    h += '<button class="lrow' + (x.id === l.id ? " on" : "") + '" data-list="' + esc(x.id) + '"><span><b>' + esc(x.name) + "</b><small>" + U.badge(x.store || state.store, "xs") + " " + tt.n + " Artikel" + (tt.doneN ? " · " + tt.doneN + " im Wagen" : "") + "</small></span><b>" + money(tt.total) + "</b></button>";
  });
  h += '<button class="lrow add" data-act="newlist">＋ Neue Liste</button>';
  if (!state.budget && F("budget")) h += '<button class="lrow add bud" data-act="budget">' + I("wallet") + ' Monatsbudget festlegen</button>';
  if (P.length) {
    var p = P[P.length - 1], d = p.total - p.expected;
    h += '<h3>Letzter Einkauf</h3><div class="card"><div class="kv"><span>' + U.day(p.date) + " " + U.badge(p.store, "sm") + "</span><b>" + money(p.total) + "</b></div>" +
      '<div class="sub">Laut Liste erwartet ' + money(p.expected) + ' · <span class="' + (d > 0 ? "bad" : "good") + '">' + U.signed(d) + "</span>" +
      (p.extra ? " · " + p.extra + " nicht auf der Liste" : "") + "</div></div>";
  }
  return h;
}
/* ---------- Sicherungs-Erinnerung ---------- */
function backupNote() {
  if (!F("backup")) return "";
  var last = state.lastBackup || 0, ref = last || state.firstUse, now = Date.now();
  if (!Object.keys(S.products).length || now - ref < 7 * 864e5 || (state.backupSnooze || 0) > now) return "";
  return '<div class="note bk">' + I("download") + ' <b>' + (last ? "Letzte Sicherung " + ago(last) : "Noch keine Sicherung gemacht") + ".</b> Deine Daten (Preise, Vorrat, Kundenkarte) liegen nur auf diesem Handy." +
    '<div class="quick" style="margin-top:8px"><button class="btn primary" data-act="backup" type="button">' + I("download") + ' Jetzt sichern</button><button class="btn" data-act="snooze" type="button">Später</button></div></div>';
}
function doBackup() {
  var a = document.createElement("a"), d = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: "application/json" }));
  a.download = "einkauf-sicherung-" + d + ".json"; document.body.appendChild(a); a.click(); a.remove();
  state.lastBackup = Date.now(); S.save();
}

/* ---------- MHD ---------- */
function iso(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function daysTo(exp) { return Math.round((new Date(exp + "T12:00:00") - new Date(iso(Date.now()) + "T12:00:00")) / 864e5); }
function mhdText(exp) {
  var n = daysTo(exp);
  return n < 0 ? "abgelaufen seit " + dm(exp) : n === 0 ? "läuft heute ab" : n === 1 ? "läuft morgen ab" : "MHD " + dm(exp) + " · noch " + n + " Tage";
}
function mhdClass(exp) { var n = daysTo(exp); return n < 0 ? "bad" : n <= 3 ? "warn" : "ok"; }
function expiryNote() {
  if (!F("expiry")) return "";
  var soon = Object.keys(state.pantry).filter(function (b) { var v = S.pantryOf(b); return S.products[b] && v.q && v.exp && daysTo(v.exp) <= 3; })
    .sort(function (a, b) { return S.pantryOf(a).exp < S.pantryOf(b).exp ? -1 : 1; });
  if (!soon.length) return "";
  return '<div class="note exp" data-go="pantry">' + I("alert") + ' <b>' + soon.length + " Artikel " + (soon.length === 1 ? "läuft" : "laufen") + " bald ab</b><br>" +
    soon.slice(0, 5).map(function (b) { var e = S.pantryOf(b).exp; return esc(S.products[b].name) + ' – <span class="' + mhdClass(e) + '">' + mhdText(e) + "</span>"; }).join("<br>") + (soon.length > 5 ? "<br>…" : "") + recipeButton() + "</div>";
}
function askMhd(b) {
  var p = S.products[b], v = S.pantryOf(b), add = function (n) { return function () { S.setExp(b, iso(Date.now() + n * 864e5)); S.save(); render(); }; };
  ask("MHD für <b>" + esc(p.name) + "</b>" + (v.exp ? "<br><small>bisher: " + mhdText(v.exp) + "</small>" : ""), "Haltbar bis …",
    [{ t: "+3 Tage", fn: add(3) }, { t: "+1 Woche", fn: add(7) }, { t: "+1 Monat", fn: add(30) }, { t: "+3 Monate", fn: add(91) },
     { t: "Datum wählen", primary: true, fn: function () {
       openShell("MHD", '<label class="f">Mindestens haltbar bis</label><input type="date" id="xD" class="datein" value="' + (v.exp || iso(Date.now() + 7 * 864e5)) + '">' +
         '<div class="col"><button class="btn primary" id="xOk" type="button" style="flex:none">Speichern</button></div>');
       ctx = { simple: true };
       $("xOk").onclick = function () { S.setExp(b, $("xD").value); S.save(); closeEdit(); render(); };
     } }].concat(v.exp ? [{ t: "MHD entfernen", fn: function () { S.setExp(b, ""); S.save(); render(); } }] : []));
}

/* ---------- Monatsbudget ---------- */
function monthSpent() { var k = monthKey(Date.now()); return state.purchases.filter(function (p) { return monthKey(p.date) === k; }).reduce(function (a, p) { return a + p.total; }, 0); }
function budgetCard(listTotal) {
  if (!F("budget")) return "";
  if (!state.budget) return "";
  var spent = monthSpent(), left = state.budget - spent, pct = spent / state.budget, after = left - (listTotal || 0);
  var cls = pct >= 1 ? "bad" : pct >= 0.8 ? "warn" : "ok";
  var mon = new Date().toLocaleDateString("de-DE", { month: "long" });
  return '<div class="card budget ' + cls + '" data-act="budget"><div class="kv"><span>' + I("wallet") + ' Budget ' + mon + "</span><b>" + (left >= 0 ? "noch " + money(left) : money(-left) + " drüber") + "</b></div>" +
    '<div class="bbar"><i style="width:' + Math.min(100, Math.round(pct * 100)) + '%"></i></div>' +
    '<div class="sub">' + money(spent) + " von " + money(state.budget) + " ausgegeben" + (listTotal ? " · nach dieser Liste: " + (after >= 0 ? "noch " + money(after) : '<span class="bad">' + money(-after) + " drüber</span>") : "") + "</div></div>";
}
function askBudget() {
  openSimple("Monatsbudget", "Wie viel willst du im Monat für Einkäufe ausgeben? (€, leer = kein Budget)", "z. B. 300", "decimal", "Speichern", function (v) {
    if (!v) { state.budget = 0; S.save(); closeEdit(); render(); toast("Budget entfernt"); return; }
    var c = U.parsePrice(v); if (c == null || !c) { msg("Bitte einen Betrag eingeben, z. B. 300", "bad"); return; }
    state.budget = c; S.save(); closeEdit(); render(); toast("Budget " + money(c) + " pro Monat");
  });
  if (state.budget) $("fX").value = U.cents2str(state.budget).replace(",00", "");
}

/* ---------- Preisverlauf (kleines Liniendiagramm je Markt) ---------- */
function priceChart(p) {
  var hs = (p.hist || []).slice(), by = {};
  hs.forEach(function (x) { (by[x.s] || (by[x.s] = [])).push(x); });
  Object.keys(p.prices || {}).forEach(function (s) { var a = by[s] || (by[s] = []); if (!a.length || a[a.length - 1].p !== p.prices[s]) a.push({ s: s, p: p.prices[s], d: a.length ? Date.now() : (p.created || Date.now()) }); });
  var stores = Object.keys(by).filter(function (s) { return by[s].length; });
  if (!stores.length) return "";
  var all = [].concat.apply([], stores.map(function (s) { return by[s]; }));
  var t0 = Math.min.apply(null, all.map(function (x) { return x.d; })), t1 = Math.max(Date.now(), t0 + 864e5);
  var lo = Math.min.apply(null, all.map(function (x) { return x.p; })), hi = Math.max.apply(null, all.map(function (x) { return x.p; }));
  if (hi === lo) { hi += 10; lo = Math.max(0, lo - 10); }
  var W = 300, H = 120, L = 46, R = 8, T = 10, B = 22;
  var times = all.map(function (x) { return x.d; }).concat([Date.now()]).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  var X = t1 - t0 < 2 * 864e5   /* alles am selben Tag: gleichmäßig nebeneinander statt übereinander */
    ? function (t) { var i = times.indexOf(t); if (i < 0) i = times.length - 1; return L + i / Math.max(1, times.length - 1) * (W - L - R); }
    : function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); }, Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
  var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="pchart" role="img" aria-label="Preisverlauf">' +
    '<line x1="' + L + '" y1="' + Y(hi) + '" x2="' + (W - R) + '" y2="' + Y(hi) + '" class="gl"/><line x1="' + L + '" y1="' + Y(lo) + '" x2="' + (W - R) + '" y2="' + Y(lo) + '" class="gl"/>' +
    '<text x="' + (L - 6) + '" y="' + (Y(hi) + 4) + '" text-anchor="end">' + U.cents2str(hi) + '</text><text x="' + (L - 6) + '" y="' + (Y(lo) + 4) + '" text-anchor="end">' + U.cents2str(lo) + "</text>" +
    '<text x="' + L + '" y="' + (H - 6) + '">' + U.day(t0) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">heute</text>';
  stores.forEach(function (s) {
    var c = U.brandOf(s), col = c[0] === "#ffffff" ? c[1] : c[0], pts = by[s].map(function (x) { return [X(x.d), Y(x.p)]; });
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) d += "H" + pts[i][0].toFixed(1) + "V" + pts[i][1].toFixed(1);
    d += "H" + X(Date.now()).toFixed(1);   // Stufenlinie bis heute
    svg += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.5"/>' + pts.map(function (q) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.5" fill="' + col + '" stroke="#000" stroke-width="1"/>'; }).join("");
  });
  svg += "</svg>";
  var legend = stores.map(function (s) { var a = by[s], last = a[a.length - 1].p, first = a[0].p; return U.badge(s, "xs") + " " + money(last) + (a.length > 1 && last !== first ? ' <small class="' + (last > first ? "bad" : "good") + '">' + U.signed(last - first) + "</small>" : ""); }).join(" · ");
  return '<h3>' + I("stats") + ' Preisverlauf</h3><div class="card">' + svg + '<div class="sub" style="margin-top:6px">' + legend + "</div>" +
    (hs.length ? "" : '<div class="hint" style="margin:4px 0 0">Der Verlauf füllt sich, sobald sich ein Preis ändert (beim Bearbeiten oder per Kassenbon).</div>') + "</div>";
}

/* ---------- Spracheingabe ---------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
var NUM = { ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12, zwoelf: 12 };
if (SR) { $("micBtn").hidden = false; }
$("micBtn").addEventListener("click", function () {
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = "de-DE"; rec.interimResults = false; rec.maxAlternatives = 1;
  $("micBtn").classList.add("on"); toast("Sprich jetzt, z. B. „Milch, zwei Butter und Eier“", 4000);
  rec.onresult = function (e) { handleSpeech(e.results[0][0].transcript); };
  rec.onerror = function (e) { toast(e.error === "not-allowed" ? "Mikrofon nicht erlaubt – in den Browser-Einstellungen freigeben." : "Nicht verstanden – bitte nochmal.", 4000); };
  rec.onend = function () { rec = null; $("micBtn").classList.remove("on"); };
  try { rec.start(); } catch (e) { rec = null; $("micBtn").classList.remove("on"); }
});
function handleSpeech(text) {
  var parts = String(text).split(/,|;|\bund\b|\bsowie\b|\bplus\b/i).map(function (x) { return x.trim(); }).filter(Boolean), done = [], inPan = [];
  parts.forEach(function (part) {
    var n = 1, w = part.split(/\s+/), first = w[0].toLowerCase();
    if (/^\d+$/.test(first)) { n = +first; w.shift(); } else if (NUM[first]) { n = NUM[first]; w.shift(); }
    if (w[0] && /^(x|mal|stück|stueck|packung(en)?|flasche(n)?|dose(n)?)$/i.test(w[0])) w.shift();
    var name = w.join(" ").trim(); if (!name) return;
    var qn = U.norm(name), best = null, bs = 0;
    Object.keys(S.products).forEach(function (b) { var p = S.products[b]; if (p.loose && tab !== "pantry") return; var s = score(p, qn, ""); if (s >= 2 && qn.length < 0.5 * U.norm(p.name).length) s = 0.5; if (s > bs) { bs = s; best = b; } });
    var isNew = false;
    if (!best || bs < 0.6) { name = name.charAt(0).toUpperCase() + name.slice(1); best = S.newKey(name); S.products[best] = { b: best, name: name, prices: {}, created: Date.now() }; isNew = true; }
    if (tab === "pantry") S.pantryAdd(best, n, Date.now(), "hand");
    else { S.addToList(best, n); if (S.pantryOf(best).q) inPan.push(S.products[best].name); }
    done.push((n > 1 ? n + "× " : "") + S.products[best].name + (isNew ? " (neu)" : ""));
  });
  S.save(); render();
  if (!done.length) { toast("Nichts erkannt: „" + text + "“", 4000); return; }
  toast("" + (tab === "pantry" ? "Vorrat" : "Liste") + ": " + done.join(", ") + (inPan.length ? " · Achtung, noch im Vorrat: " + inPan.join(", ") : ""), 6000);
}

function tile(v, k, goTo, col) { return '<button class="tile' + (col ? " " + col : "") + '" data-go="' + goTo + '"><b>' + v + "</b><span>" + k + "</span></button>"; }
