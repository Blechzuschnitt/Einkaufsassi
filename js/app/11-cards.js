/* Kundenkarten (QR-Code) */
"use strict";
/* ================= Kundenkarten ================= */
$("cardBtn").addEventListener("click", function () { if (state.cards[state.store]) showCard(state.store); else addCard(state.store); });
function showCard(st) {
  var c = state.cards[st]; if (!c) return;
  var v = $("cardView");
  v.innerHTML = '<div class="cvtop">' + U.badge(st, "big") + '<button class="btn" id="cvClose" type="button">✕ Schließen</button></div>' +
    '<div class="cvqr" id="cvQr">QR wird erzeugt …</div><div class="cvnum">' + esc(c.code) + "</div>" +
    '<div class="cvhint">Bildschirm ganz hell stellen und an den Scanner der Kasse halten.</div>' +
    '<div class="cvbar"><button class="btn" id="cvEdit" type="button">Karte ändern</button></div>';
  v.classList.add("open"); pauseLive();
  var size = Math.min(window.innerWidth - 60, 380);
  Scanner.qrSvg(c.code, size).then(function (svg) { var q = $("cvQr"); if (q) { q.innerHTML = ""; q.appendChild(svg); } },
    function () { var q = $("cvQr"); if (q) q.textContent = "QR-Code konnte nicht erzeugt werden – Nummer unten an der Kasse nennen."; });
  try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (w) { v._wl = w; }).catch(function () {}); } catch (e) {}
  $("cvClose").onclick = closeCard;
  $("cvEdit").onclick = function () { closeCard(); addCard(st); };
}
function closeCard() { var v = $("cardView"); v.classList.remove("open"); v.innerHTML = ""; if (v._wl) { v._wl.release().catch(function () {}); v._wl = null; } resumeLive(); }
function addCard(st) {
  var c = state.cards[st];
  openShell("Kundenkarte", '<div class="hint" style="margin-top:0">Für ' + U.badge(st, "sm") + " – die Karte bleibt nur auf diesem Gerät gespeichert.</div>" +
    '<div class="col"><label class="btn primary" for="kPic" style="flex:none">' + I("image") + ' Screenshot der Karte wählen</label>' +
    '<label class="btn" for="kCam">' + I("camera") + ' Karte abfotografieren</label></div>' +
    '<input type="file" id="kPic" class="hide" accept="image/*"><input type="file" id="kCam" class="hide" accept="image/*" capture="environment">' +
    '<div class="hint">Am sichersten: In der Kunden-App (z. B. Lidl Plus) einen Screenshot vom QR-Code machen und hier wählen – dann ist der Code exakt derselbe.</div>' +
    '<label class="f">Oder Code / Kartennummer eintippen</label><input type="text" id="kCode" value="' + esc(c ? c.code : "") + '" autocomplete="off" inputmode="text">' +
    '<div id="msg"></div><div class="col"><button class="btn primary" id="kSave" type="button" style="flex:none">Speichern</button>' +
    (c ? '<button class="btn danger" id="kDel" type="button">Karte entfernen</button>' : "") + "</div>");
  ctx = { simple: true };
  function onPic() {
    var f = this.files && this.files[0], inp = this; if (!f) return;
    msg("Code wird gelesen …", "ok");
    Scanner.decodePhoto(f, true).then(function (code) {
      inp.value = "";
      if (!code) { msg("Kein Code erkannt. Den QR-Code größer und scharf ins Bild nehmen – oder die Nummer eintippen.", "bad"); return; }
      $("kCode").value = code; msg("Erkannt ✓ – jetzt Speichern tippen.", "ok");
    }, function () { inp.value = ""; msg("Bild konnte nicht geladen werden.", "bad"); });
  }
  $("kPic").onchange = $("kCam").onchange = onPic;
  $("kSave").onclick = function () {
    var v = $("kCode").value.trim();
    if (!v) { msg("Bitte Screenshot wählen oder Code eintippen.", "bad"); return; }
    state.cards[st] = { code: v, d: Date.now() }; S.save(); closeEdit(); render(); showCard(st);
  };
  if ($("kDel")) sure($("kDel"), function () { delete state.cards[st]; S.save(); closeEdit(); render(); toast("Karte entfernt"); });
}
