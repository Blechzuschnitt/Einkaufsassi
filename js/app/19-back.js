/* Zurück-Taste (Android / Browser): statt die App zu schließen erst offene Fenster schließen,
   dann zur vorherigen Seite. Erst ganz am Anfang (Start-Seite) verlässt „Zurück“ die App. */
"use strict";

var backStack = [], backNav = false;
/* go() umhüllen: jede Seitenwechsel merken (außer beim Zurückgehen selbst) */
var goInner = go;
go = function (t) {
  if (!backNav && t !== tab && tab !== "shop") { backStack.push(tab); if (backStack.length > 30) backStack.shift(); }
  goInner(t);
};
function isOpen(id, cls) { var e = $(id); return !!(e && e.classList.contains(cls || "open")); }
/* Ein Schritt zurück innerhalb der App; false = es gibt nichts mehr zurückzugehen */
function appBack() {
  if (document.getElementById("launch")) return false;                       /* Start-Auswahl: App darf schließen */
  if (isOpen("ask")) { $("ask").click(); return true; }                        /* Klick auf den Hintergrund = abbrechen */
  if (isOpen("cardView")) { closeCard(); return true; }
  if (isOpen("storePop")) { togglePop(false); return true; }
  if (isOpen("sugg")) { $("sugg").classList.remove("open"); $("q").blur(); return true; }
  if (isOpen("edit")) { closeEdit(); render(); return true; }
  if (live.on) { closeScan(); return true; }
  backNav = true;
  try {
    if (tab === "shop") { exitShop(); return true; }
    while (backStack.length) { var t = backStack.pop(); if (t !== tab) { go(t); return true; } }
    if (tab !== "home" && tab !== "pantry") { go("home"); return true; }
  } finally { backNav = false; }
  return false;
}
/* Ein „Schutz-Eintrag“ im Browser-Verlauf fängt die Zurück-Taste ab */
function backInit() {
  try {
    history.replaceState({ einkauf: "basis" }, "");
    history.pushState({ einkauf: "schutz" }, "");
  } catch (e) { return; }
  window.addEventListener("popstate", function () {
    if (appBack()) { try { history.pushState({ einkauf: "schutz" }, ""); } catch (e) {} }
    else history.back();   /* nichts mehr offen: App wirklich verlassen */
  });
}
