/* Oberfläche und Ablauf */
(function () {
  "use strict";
  var S = Store, state = S.state;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  function money(c) { return fmt.format(c / 100); }
  function parsePrice(s) {
    s = String(s || "").replace(/[€\s]/g, "").replace(",", ".");
    var v = parseFloat(s); if (!isFinite(v) || v < 0) return null; return Math.round(v * 100);
  }
  function toast(msg, ms) {
    var t = $("toast"); t.textContent = msg; t.style.display = "block";
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = "none"; }, ms || 2500);
  }
  function showErr(m) { var e = $("err"); e.textContent = "Fehler: " + m; e.style.display = "block"; }
  window.addEventListener("error", function (e) { showErr(e.message || "unbekannt"); });
  window.addEventListener("unhandledrejection", function (e) { showErr((e.reason && e.reason.message) || "unbekannt"); });

  function setSync(m) {
    $("sync").textContent = m === "error" ? "⚠ Speichern fehlgeschlagen" : "✓ auf diesem Gerät gespeichert";
  }

  /* ---------- Hauptansicht ---------- */
  function render() {
    var h = "";
    state.stores.forEach(function (s) { h += '<button class="chip' + (s === state.store ? " on" : "") + '" data-store="' + esc(s) + '">' + esc(s) + "</button>"; });
    h += '<button class="chip add" data-act="addstore">+ Markt</button>';
    $("stores").innerHTML = h;

    var l = S.listedFor(), c = S.cartFor(), html = "", sum = 0, dsum = 0, n = 0, miss = 0;
    if (!l.length) html = '<div class="empty">Noch nichts für <b>' + esc(state.store) + "</b>.<br>Scanne einen Barcode oder tippe die Nummer ein.</div>";
    l.forEach(function (b) {
      var p = S.products[b]; if (!p) return;
      var pr = S.priceOf(b), q = c[b] || 0, dep = p.deposit || 0, pic = p.img || p.imgUrl;
      if (q) { n += q; dsum += dep * q; if (pr == null) miss++; else sum += pr * q; }
      html += '<div class="row' + (q ? " in" : "") + '" data-b="' + esc(b) + '" data-act="toggle">' +
        '<div class="tick">' + (q ? "✓" : "") + "</div>" +
        (pic ? '<img class="thumb" alt="" src="' + esc(pic) + '" onerror="this.style.display=\'none\'">' : "") +
        '<div class="info"><div class="name">' + esc(p.name) + '</div><div class="sub' + (pr == null ? " warn" : "") + '">' +
        (pr == null ? "Preis fehlt – tippen" : (b.indexOf("r-") === 0 ? "ohne Barcode" : esc(b))) + (dep ? " · + " + money(dep) + " Pfand" : "") + "</div></div>";
      if (q) html += '<div class="qty"><button data-act="minus" data-b="' + esc(b) + '">−</button><span>' + q + '</span><button data-act="plus" data-b="' + esc(b) + '">+</button></div>';
      html += '<div class="price">' + (pr == null ? "–" : money(pr * (q || 1))) + '</div><button class="edit" data-act="edit" data-b="' + esc(b) + '" aria-label="Bearbeiten">✎</button></div>';
    });
    if (n) html += '<button class="clear" data-act="clear">Wagen leeren</button>';
    $("list").innerHTML = html;
    $("cnt").textContent = n + " Artikel im Wagen" + (dsum ? " · inkl. " + money(dsum) + " Pfand" : "");
    $("sum").textContent = money(sum + dsum);
    $("missing").textContent = miss ? miss + " Artikel ohne Preis – nicht eingerechnet" : "";
  }
  function setQty(b, q) { var c = S.cartFor(); if (q <= 0) delete c[b]; else c[b] = q; S.save(); render(); }

  /* ---------- Vollbild-Bildschirme ---------- */
  var ctx = null;
  function msg(text, kind) { var m = $("msg"); if (m) { m.className = kind || ""; m.textContent = text; } }
  function closeEdit() { $("edit").classList.remove("open"); $("edit").innerHTML = ""; ctx = null; window.scrollTo(0, 0); resumeLive(); }
  function openShell(title, inner) {
    pauseLive();
    $("edit").innerHTML = '<div class="eh"><button class="btn" id="eBack" type="button">‹ Zurück</button><b>' + esc(title) + "</b></div>" + inner;
    $("edit").classList.add("open"); $("edit").scrollTop = 0;
    $("eBack").onclick = closeEdit;
  }

  function showPhoto() {
    var pv = $("pv"); if (!pv) return;
    var src = ctx.img || ctx.imgUrl;
    pv.innerHTML = src ? '<img alt="" src="' + esc(src) + '" onerror="this.remove()">' : "📦";
    $("fImgDel").style.display = src ? "" : "none";
  }

  function openEdit(b, opts) {
    opts = opts || {};
    var p = S.products[b], pr = p && p.prices ? p.prices[state.store] : undefined, real = b.indexOf("r-") !== 0;
    var others = "";
    if (p && p.prices) Object.keys(p.prices).forEach(function (s) { if (s !== state.store) others += esc(s) + " " + money(p.prices[s]) + " · "; });
    openShell(p ? "Artikel" : "Neuer Artikel",
      '<div class="photo"><div class="pv" id="pv"></div><div class="btns">' +
      '<label class="btn" for="fCam">📷 Foto aufnehmen</label><label class="btn" for="fImg">🖼 Aus Galerie</label>' +
      '<button class="btn danger" id="fImgDel" type="button" style="display:none">Foto entfernen</button></div></div>' +
      '<input type="file" id="fCam" class="hide" accept="image/*" capture="environment"><input type="file" id="fImg" class="hide" accept="image/*">' +
      (real ? '<label class="f">Barcode</label><input type="text" id="fB" value="' + esc(b) + '" readonly>'
            : '<label class="f">Barcode (optional nachtragen)</label><input type="text" id="fB" inputmode="numeric" placeholder="Nummer unter dem Strichcode" autocomplete="off">') +
      '<label class="f">Name</label><input type="text" id="fN" value="' + esc(p ? p.name : "") + '" placeholder="z. B. Vollmilch 1 l" autocomplete="off">' +
      '<label class="f">Preis bei ' + esc(state.store) + ' (€)</label><input type="text" id="fP" inputmode="decimal" enterkeyhint="done" value="' + (pr != null ? (pr / 100).toFixed(2).replace(".", ",") : "") + '" placeholder="0,00" autocomplete="off">' +
      '<label class="f">Pfand pro Stück (€) – optional</label><input type="text" id="fD" inputmode="decimal" value="' + (p && p.deposit ? (p.deposit / 100).toFixed(2).replace(".", ",") : "") + '" placeholder="kein Pfand" autocomplete="off">' +
      '<div class="chips2"><button class="chip" type="button" data-d="">kein</button><button class="chip" type="button" data-d="0,08">0,08</button><button class="chip" type="button" data-d="0,15">0,15</button><button class="chip" type="button" data-d="0,25">0,25</button></div>' +
      '<div class="hint">Der Preis wird für ' + esc(state.store) + " gespeichert und beim nächsten Mal automatisch genutzt." + (others ? "<br>Bekannt: " + others.replace(/ · $/, "") : "") + "</div>" +
      '<div id="msg"></div>' +
      '<div class="col"><button class="btn primary" id="eSave" type="button" style="flex:none">Speichern</button>' +
      (real ? '<button class="btn" id="eFind" type="button">🔎 Online nach Name suchen</button>' : "") +
      (p ? '<button class="btn danger" id="eDel" type="button">Aus Liste entfernen</button>' : "") + "</div>");
    ctx = { b: b, fromScan: !!opts.fromScan, img: p && p.img || undefined, imgUrl: p && p.imgUrl || "" };
    showPhoto();
    $("eSave").onclick = saveEdit;
    if ($("eDel")) $("eDel").onclick = function () {
      var l = S.listedFor(), i = l.indexOf(ctx.b); if (i >= 0) l.splice(i, 1); delete S.cartFor()[ctx.b];
      S.save(); closeEdit(); render(); toast("Aus Liste entfernt");
    };
    if ($("eFind")) $("eFind").onclick = function () { findOnline(true); };
    Array.prototype.forEach.call(document.querySelectorAll("#edit [data-d]"), function (bt) { bt.onclick = function () { $("fD").value = bt.getAttribute("data-d"); }; });
    $("fN").onkeydown = $("fP").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } };
    function onPhoto() {
      var f = this.files && this.files[0], inp = this; if (!f) return;
      Scanner.makeThumb(f).then(function (d) { ctx.img = d; showPhoto(); msg("", ""); }, function () { msg("Foto konnte nicht geladen werden.", "bad"); });
      inp.value = "";
    }
    $("fCam").onchange = $("fImg").onchange = onPhoto;
    $("fImgDel").onclick = function () { ctx.img = null; ctx.imgUrl = ""; showPhoto(); };
    if (!p && real) findOnline(false);
    else setTimeout(function () { var el = (!p ? $("fN") : $("fP")); if (el) el.focus(); }, 60);
  }

  /* Name, Foto und Pfand-Vorschlag aus Open Food Facts */
  function findOnline(manual) {
    var my = ctx, b = ctx.b;
    msg("Suche online …", "ok");
    Lookup.byBarcode(b).then(function (r) {
      if (ctx !== my || !$("fN")) return;
      if (!r) { msg("Nicht in der Online-Datenbank. Bitte Namen selbst eintippen.", "bad"); $("fN").focus(); return; }
      var note = [];
      if (!$("fN").value.trim()) { $("fN").value = r.name; note.push("Name"); }
      if (r.imgUrl && !ctx.img && !ctx.imgUrl) { ctx.imgUrl = r.imgUrl; showPhoto(); note.push("Foto"); }
      if (r.deposit && !$("fD").value.trim()) { $("fD").value = (r.deposit / 100).toFixed(2).replace(".", ","); note.push("Pfand " + money(r.deposit) + " (Vorschlag, bitte prüfen)"); }
      msg(note.length ? "Gefunden: " + note.join(", ") + ". Jetzt den Preis eintippen." : "Nichts Neues gefunden.", "ok");
      if (!$("fP").value.trim()) $("fP").focus();
    }, function () {
      if (ctx !== my || !$("fN")) return;
      msg("Keine Verbindung – bitte Namen selbst eintippen.", "bad"); $("fN").focus();
    });
  }

  function saveEdit() {
    try {
      var b = ctx.b, name = $("fN").value.trim(), raw = $("fP").value.trim(), pr = parsePrice(raw);
      if (!name) { msg("Bitte einen Namen eingeben.", "bad"); $("fN").focus(); return; }
      if (raw !== "" && pr == null) { msg("Preis nicht lesbar. Beispiel: 1,29", "bad"); $("fP").focus(); return; }
      var dr = $("fD").value.trim(), dv = dr === "" ? 0 : parsePrice(dr);
      if (dv == null) { msg("Pfand nicht lesbar. Beispiel: 0,25", "bad"); $("fD").focus(); return; }
      var nb = "";
      if (b.indexOf("r-") === 0) {
        nb = $("fB").value.replace(/\D/g, "");
        if ($("fB").value.trim() && nb.length < 8) { msg("Barcode zu kurz (mindestens 8 Ziffern).", "bad"); $("fB").focus(); return; }
      }
      var p = S.products[b] || (S.products[b] = { b: b, name: name, prices: {} });
      p.name = name; if (!p.prices) p.prices = {};
      if (raw !== "") p.prices[state.store] = pr;
      if (dv > 0) p.deposit = dv; else delete p.deposit;
      if (ctx.img) p.img = ctx.img; else delete p.img;
      if (ctx.imgUrl) p.imgUrl = ctx.imgUrl; else delete p.imgUrl;
      if (nb.length >= 8) { p = S.rekey(b, nb, p); b = nb; }
      S.ensureListed(b);
      if (ctx.fromScan && p.prices[state.store] != null) { var c = S.cartFor(); c[b] = Math.max(1, c[b] || 0); }
      S.save();
      var t = name + (p.prices[state.store] != null ? " · " + money(p.prices[state.store]) : "") + " gespeichert";
      closeEdit(); render(); toast("✓ " + t);
    } catch (e) { msg("Speichern fehlgeschlagen: " + (e && e.message || e), "bad"); }
  }

  function openSimple(title, label, ph, mode, okText, okFn) {
    openShell(title, '<label class="f">' + esc(label) + '</label><input type="text" id="fX" ' + (mode ? 'inputmode="' + mode + '" ' : "") + 'placeholder="' + esc(ph) + '" autocomplete="off">' +
      '<div id="msg"></div><div class="col"><button class="btn primary" id="eOk" type="button" style="flex:none">' + esc(okText) + "</button></div>");
    ctx = { simple: true };
    $("eOk").onclick = function () { okFn($("fX").value.trim()); };
    $("fX").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); okFn($("fX").value.trim()); } };
    setTimeout(function () { var x = $("fX"); if (x) x.focus(); }, 60);
  }

  /* ---------- Menü: Sicherung ---------- */
  function openMenu() {
    openShell("Menü",
      '<div class="hint" style="margin-top:0">Deine Daten liegen nur auf diesem Gerät. Mach ab und zu eine Sicherung.</div>' +
      '<div class="col">' +
      '<button class="btn primary" id="mSave" type="button" style="flex:none">⬇ Sicherung speichern</button>' +
      '<button class="btn" id="mCopy" type="button">📋 Sicherung kopieren</button>' +
      '<label class="btn" for="mFile">⬆ Sicherung aus Datei laden</label><input type="file" id="mFile" class="hide" accept=".json,application/json"></div>' +
      '<label class="f">Oder Sicherung hier einfügen</label><textarea id="mTxt" placeholder="{ … }"></textarea>' +
      '<div class="col" style="margin-top:10px"><button class="btn" id="mPaste" type="button">Einfügen &amp; zusammenführen</button></div>' +
      '<div id="msg"></div><div class="hint" id="mInfo"></div>');
    ctx = { simple: true };
    var info = "Artikel: " + Object.keys(S.products).length + " · Märkte: " + state.stores.length;
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) { $("mInfo") && ($("mInfo").textContent = info + " · Speicher " + (p ? "dauerhaft geschützt" : "nicht dauerhaft geschützt")); });
    else $("mInfo").textContent = info;
    $("mSave").onclick = function () {
      var a = document.createElement("a"), d = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: "application/json" }));
      a.download = "einkauf-sicherung-" + d + ".json"; document.body.appendChild(a); a.click(); a.remove();
      msg("Sicherung wurde heruntergeladen.", "ok");
    };
    $("mCopy").onclick = function () {
      var t = S.exportJSON();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { msg("Sicherung in die Zwischenablage kopiert.", "ok"); }, function () { $("mTxt").value = t; $("mTxt").select(); msg("Kopieren nicht erlaubt – Text steht im Feld unten, bitte selbst kopieren.", "bad"); });
    };
    function doImport(text) {
      try { var n = S.importJSON(text); render(); msg("Sicherung geladen: " + n + " neue Artikel.", "ok"); }
      catch (e) { msg("Das hat nicht geklappt: " + (e && e.message || e), "bad"); }
    }
    $("mFile").onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { doImport(String(r.result)); }; r.readAsText(f); };
    $("mPaste").onclick = function () { var t = $("mTxt").value.trim(); if (!t) { msg("Feld ist leer.", "bad"); return; } doImport(t); };
  }

  /* ---------- Scannen ---------- */
  function handleCode(code) {
    code = String(code).replace(/\D/g, ""); if (!code) { toast("Ungültiger Barcode"); return; }
    if (!S.products[code]) { openEdit(code, { fromScan: true }); return; }
    S.ensureListed(code);
    if (S.priceOf(code) == null) { S.save(); render(); openEdit(code, { fromScan: true }); return; }
    var c = S.cartFor(); c[code] = (c[code] || 0) + 1; S.save(); render();
    toast(S.products[code].name + " · " + money(S.priceOf(code)) + " im Wagen");
  }

  var live = { on: false, paused: false };
  function liveUI() {
    var on = live.on && !live.paused;
    document.body.classList.toggle("live", on);
    $("liveBtn").classList.toggle("on", live.on);
    $("liveBtn").textContent = live.on ? "⏹ Stopp" : "📷 Scannen";
    $("torch").style.display = on && Scanner.torchSupported() ? "block" : "none";
  }
  function startStream() {
    return Scanner.start($("vid"), handleCode).then(function () { liveUI(); }, function (e) {
      live.on = false; live.paused = false; Scanner.stop(); liveUI();
      toast((e && e.message || "Kamera nicht verfügbar") + " Nutze „📸 Foto“ oder „123“.", 7000);
    });
  }
  function pauseLive() { if (live.on && !live.paused) { live.paused = true; Scanner.stop(); liveUI(); } }
  function resumeLive() { if (live.on && live.paused) { live.paused = false; liveUI(); startStream(); } }

  $("liveBtn").addEventListener("click", function () {
    if (live.on) { live.on = false; live.paused = false; Scanner.stop(); $("torch").classList.remove("on"); liveUI(); return; }
    live.on = true; live.paused = false; liveUI(); startStream();
  });
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
  $("menuBtn").addEventListener("click", openMenu);

  $("stores").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.act === "addstore") {
      openSimple("Markt hinzufügen", "Name des Marktes", "z. B. Netto", "", "Hinzufügen", function (v) {
        if (!v) { msg("Bitte Namen eingeben.", "bad"); return; }
        if (state.stores.indexOf(v) < 0) state.stores.push(v);
        state.store = v; S.save(); closeEdit(); render();
      });
      return;
    }
    if (b.dataset.store) { state.store = b.dataset.store; S.save(); render(); }
  });
  $("list").addEventListener("click", function (e) {
    var a = e.target.closest("[data-act]"); if (!a) return;
    var act = a.dataset.act, row = a.closest(".row"), b = a.dataset.b || (row && row.dataset.b);
    if (act === "clear") {
      if (!a.dataset.sure) { a.dataset.sure = 1; a.textContent = "Wirklich leeren? Nochmal tippen"; return; }
      state.cart[state.store] = {}; S.save(); render(); return;
    }
    if (act === "edit") { openEdit(b); return; }
    if (act === "plus") { setQty(b, (S.cartFor()[b] || 0) + 1); return; }
    if (act === "minus") { setQty(b, (S.cartFor()[b] || 0) - 1); return; }
    if (act === "toggle") {
      if (S.priceOf(b) == null) { openEdit(b, { fromScan: true }); return; }
      setQty(b, S.cartFor()[b] ? 0 : 1);
    }
  });

  /* ---------- Start ---------- */
  S.onStatus(setSync);
  S.load().then(function () {
    if (state.stores.indexOf(state.store) < 0) state.store = state.stores[0];
    var seeded = S.applySeeds();
    render(); setSync("ok");
    if (seeded) toast("Lidl: Artikel von deinen Kassenbons eingetragen", 4000);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  });
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
