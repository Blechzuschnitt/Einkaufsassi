/* Scannen (Live, Foto, Nummer) und Scan-Modi */
"use strict";
/* ================= Scannen ================= */
var scanMode = "list";
function setMode(m) {
  scanMode = m;
  Array.prototype.forEach.call(document.querySelectorAll("#smode [data-m]"), function (b) { b.classList.toggle("on", b.dataset.m === m); });
  $("strip").dataset.mode = m;
}
$("smode").addEventListener("click", function (e) { var b = e.target.closest("[data-m]"); if (b) { setMode(b.dataset.m); renderTabs(); } });
function handleCode(code) {
  code = String(code).replace(/\D/g, ""); if (!code) { toast("Ungültiger Barcode"); return; }
  if (scanMode === "out" || scanMode === "waste") { if (!S.products[code]) toast("Unbekannter Artikel – nicht im Vorrat"); else pantryOut(code, scanMode === "waste"); return; }
  if (scanMode === "in") { if (!S.products[code]) openEdit(code, { add: true, target: "pantry" }); else pantryIn(code); return; }
  if (tab === "shop" && S.products[code]) { shopScan(code); return; }
  if (!S.products[code]) { openEdit(code, { add: true }); return; }
  askPantry(code, function () {
    S.addToList(code, 1); S.save(); render();
    var p = S.products[code], pr = S.effPrice(code);
    if (pr == null) { openEdit(code, { add: false }); msg("Steht jetzt auf der Liste. Preis bei " + state.store + " fehlt noch – bitte eintippen.", "ok"); return; }
    toast("✓ " + p.name + " · " + money(pr) + " → Liste");
  });
}

var live = { on: false, paused: false };
function liveUI() {
  document.body.classList.toggle("scanning", live.on);
  renderTabs();
  $("torch").style.display = live.on && !live.paused && Scanner.torchSupported() ? "block" : "none";
}
function startStream() {
  return Scanner.start($("vid"), handleCode).then(function () { liveUI(); }, function (e) {
    Scanner.stop(); liveUI();
    $("strip").classList.add("fail");
    toast((e && e.message || "Kamera nicht verfügbar") + " Nutze „Foto“ oder „123“.", 7000);
  });
}
function openScan(m) { setMode(m || (tab === "pantry" ? "in" : "list")); if (live.on) return; live.on = true; live.paused = false; $("strip").classList.remove("fail"); liveUI(); startStream(); }
function closeScan() { live.on = false; live.paused = false; Scanner.stop(); $("torch").classList.remove("on"); liveUI(); }
function pauseLive() { if (live.on && !live.paused) { live.paused = true; Scanner.stop(); liveUI(); } }
function resumeLive() { if (live.on && live.paused) { live.paused = false; liveUI(); startStream(); } }


setMode("list");
$("scanClose").addEventListener("click", closeScan);
$("torch").addEventListener("click", function () {
  var t = this, want = !t.classList.contains("on");
  Scanner.setTorch(want).then(function (on) { t.classList.toggle("on", on); });
});
document.addEventListener("visibilitychange", function () {
  if (document.hidden) pauseLive(); else if (!$("edit").classList.contains("open")) resumeLive();
});
$("pick").addEventListener("change", function () {
  var f = this.files && this.files[0], inp = this; if (!f) return;
  toast("Barcode wird gelesen …", 8000);
  Scanner.decodePhoto(f).then(function (code) {
    inp.value = "";
    if (code) handleCode(code); else toast("Kein Barcode erkannt. Näher ran, scharf stellen, quer ins Bild. Oder „123“ tippen.", 6000);
  }, function () { inp.value = ""; toast("Foto konnte nicht geladen werden.", 4000); });
});
$("typeBtn").addEventListener("click", function () {
  openSimple("Barcode eintippen", "Nummer unter dem Strichcode", "4000000000000", "numeric", "Weiter", function (v) {
    if (!v.replace(/\D/g, "")) { msg("Bitte Nummer eingeben.", "bad"); return; }
    closeEdit(); handleCode(v);
  });
});
