/* Gemeinsame Variablen und Helfer (Angebote, Liste) */
"use strict";
var S = Store, state = S.state, $ = U.$, esc = U.esc, money = U.money, toast = U.toast;
var tab = "home";
var VIEWS = {}, ACTS = {};
/* Funktionen, die man im Menü ein- und ausschalten kann (Standard: an) */
var FEATURES = [
  ["cheapest", "Preisvorschläge", "günstigster Markt, Liste aufteilen"],
  ["offers", "Angebote", "Angebots-Hinweise, Open Prices prüfen"],
  ["alarm", "Preisalarm", "Wunschpreis im Artikel"],
  ["reorder", "Nachkauf-Vorschläge", "„Nachkaufen?“ auf dem Start"],
  ["budget", "Budget anzeigen", "Monatsbudget auf Start und Statistik"],
  ["expiry", "Was bald abläuft", "MHD-Warnung auf dem Start"],
  ["recipes", "Rezeptideen", "für bald Ablaufendes"],
  ["route", "Laufweg-Sortierung", "Liste in deiner Laufreihenfolge"],
  ["backup", "Sicherungs-Erinnerung", "Hinweis nach 7 Tagen"]
];
function F(k) { return !state.features || state.features[k] !== false; }   /* weitere Seiten / Klick-Aktionen aus anderen Dateien */
/* Seite und Skripte passen nicht zusammen (alte Seite aus dem Zwischenspeicher) → einmal neu laden */
if (!$("storeBtn")) {
  var k = "einkauf-reload";
  try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); location.reload(); } } catch (e) {}
  $("err").textContent = "Neue Version – bitte die Seite neu laden."; $("err").style.display = "block";
  throw new Error("alte Seite");
}
try { sessionStorage.removeItem("einkauf-reload"); } catch (e) {}

function showErr(m) { var e = $("err"); e.textContent = "Fehler: " + m; e.style.display = "block"; }
window.addEventListener("error", function (e) { showErr(e.message || "unbekannt"); });
window.addEventListener("unhandledrejection", function (e) { showErr((e.reason && e.reason.message) || "unbekannt"); });
function setSync(m) { if (m === "error") showErr("Speichern fehlgeschlagen"); }

function thumb(p, cls) {
  var pic = p && (p.img || p.imgUrl);
  return pic ? '<img class="' + (cls || "thumb") + '" alt="" src="' + esc(pic) + '" onerror="this.style.visibility=\'hidden\'">' : "";
}
function dm(d) { var x = String(d).split("-"); return x[2] + "." + x[1] + "."; }
function isCode(b) { return /^\d{8,14}$/.test(b); }
/* Angebots-Hinweis für eine Artikelzeile */
function offerTag(b) {
  if (!F("offers")) return "";
  var o = S.offerAt(b), reg = S.priceOf(b);
  if (o && (reg == null || o.p < reg)) return '<span class="tag">' + I("tag") + ' Angebot' + (reg != null ? " statt " + money(reg) : "") + " bis " + dm(o.until) + "</span>";
  var other = S.offersOf(b).filter(function (x) { return x.s !== state.store; }).sort(function (a, c) { return a.p - c.p; })[0];
  if (other) return '<span class="tag">' + I("tag") + ' bei ' + esc(other.s) + " " + money(other.p) + " bis " + dm(other.until) + "</span>";
  var p = S.products[b], h = p && p.op && p.op.hits && p.op.hits[0];
  if (h) return '<span class="tag">gemeldet: ' + esc(h.brand) + " " + money(h.price) + " (" + dm(h.date) + ")</span>";
  return "";
}
/* Open Prices für alle Listen-Artikel mit Barcode abfragen (höchstens alle 12 h je Artikel) */
var opBusy = false, opInfo = "";
function checkOffers(force) {
  if (!F("offers") && !F("alarm")) return;
  if (opBusy) return;
  var l = S.activeList(), want = l.items.map(function (i) { return i.b; });
  Object.keys(S.products).forEach(function (b) { if (S.products[b].alarm && want.indexOf(b) < 0) want.push(b); });
  var todo = want.filter(function (b) {
    var p = S.products[b]; return p && isCode(b) && (force || !p.op || Date.now() - p.op.t > 12 * 36e5);
  });
  var noCode = l.items.filter(function (i) { return !isCode(i.b); }).length;
  if (!todo.length) { if (force) { opInfo = noCode ? noCode + " Artikel ohne Barcode – die lassen sich nicht automatisch prüfen." : "Alles schon geprüft."; render(); } return; }
  opBusy = true; opInfo = "Prüfe Angebote für " + todo.length + " Artikel …"; if (tab === "list") render();
  var hits = 0, fail = 0;
  (function next(i) {
    if (i >= todo.length) {
      opBusy = false; S.save();
      opInfo = (fail ? fail + " Abfragen fehlgeschlagen (kein Netz?). " : "") + (hits ? hits + " Artikel mit gemeldetem Angebot." : "Keine gemeldeten Angebote gefunden.") +
        (noCode ? " " + noCode + " Artikel ohne Barcode nicht geprüft." : "");
      if (tab === "list" || tab === "home") render();
      return;
    }
    var b = todo[i];
    Promise.resolve().then(function () { return Lookup.offers(b); }).then(function (r) { if (S.products[b]) S.products[b].op = { t: Date.now(), hits: r }; if (r.length) hits++; }, function () { fail++; var q = S.products[b]; if (q) q.op = { t: Date.now() - 11 * 36e5, hits: (q.op && q.op.hits) || [] }; })
      .then(function () { setTimeout(function () { next(i + 1); }, 250); });
  })(0);
}
function inList(b) { var it = S.activeList().items.filter(function (x) { return x.b === b; })[0]; return it ? it.qty : 0; }
