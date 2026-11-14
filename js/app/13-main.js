/* Start der App */
"use strict";
/* ---------- für compare.js ---------- */
window.App = { openShell: openShell, closeEdit: closeEdit, msg: msg, render: render, go: go, sure: sure, speech: handleSpeech };

/* ---------- Start ---------- */
S.onStatus(setSync);
S.onStatus(function (m) { if (m === "ok") cloudSchedule(); });
S.load().then(function () {
  var seeded = S.applySeeds();
  var pt = ""; try { pt = new URLSearchParams(location.search).get("tab") || ""; } catch (e) {}
  if (/^(home|list|pantry|stats|items)$/.test(pt)) tab = pt;
  applyTheme();
  render();
  backInit();
  /* Startauswahl – nicht, wenn die App gezielt geöffnet wurde (Benachrichtigung, Anmelde-Link) */
  if (!pt && location.hash.indexOf("access_token") < 0) launchStart();
  cloudStart();
  if (seeded) toast("Startdaten eingetragen", 4000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
});
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(function () {});

function applyTheme() {
  var t = state.theme || "";
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t ? "#000000" : "#07050a";
}
