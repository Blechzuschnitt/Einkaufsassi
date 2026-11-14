/* Start der App */
"use strict";
/* ---------- für compare.js ---------- */
window.App = { openShell: openShell, closeEdit: closeEdit, msg: msg, render: render, go: go, sure: sure, speech: handleSpeech };

/* ---------- Start ---------- */
S.onStatus(setSync);
S.load().then(function () {
  var seeded = S.applySeeds();
  try { var pt = new URLSearchParams(location.search).get("tab"); if (pt && /^(home|list|pantry|stats|items)$/.test(pt)) tab = pt; } catch (e) {}
  render();
  if (seeded) toast("Lidl: Artikel von deinen Kassenbons eingetragen", 4000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
});
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(function () {});
