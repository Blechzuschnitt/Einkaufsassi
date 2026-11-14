/* Vollbild-Formulare: Artikel, Angebote, Menü */
"use strict";
/* ================= Vollbild-Bildschirme ================= */
var ctx = null;
function msg(text, kind) { var m = $("msg"); if (m) { m.className = kind || ""; m.textContent = text; } }
function closeEdit() { $("edit").classList.remove("open"); $("edit").innerHTML = ""; ctx = null; resumeLive(); }
function openShell(title, inner) {
  pauseLive();
  $("edit").innerHTML = '<div class="eh"><button class="btn" id="eBack" type="button">‹ Zurück</button><b>' + esc(title) + "</b></div>" + inner;
  $("edit").classList.add("open"); $("edit").scrollTop = 0;
  $("eBack").onclick = closeEdit;
}
function showPhoto() {
  var pv = $("pv"); if (!pv) return;
  var src = ctx.img || ctx.imgUrl;
  pv.innerHTML = src ? '<img alt="" src="' + esc(src) + '" onerror="this.remove()">' : "" + I("box") + "";
  $("fImgDel").style.display = src ? "" : "none";
}

/* Artikel anlegen / bearbeiten. b = Barcode oder "r-…" oder null (neu ohne Barcode) */
function openEdit(b, opts) {
  opts = opts || {};
  var p = b ? S.products[b] : null, pr = p && p.prices ? p.prices[state.store] : undefined, real = !!b && b.indexOf("r-") !== 0;
  var l = S.activeList(), have = p ? inList(b) : 0, others = "";
  if (p && p.prices) Object.keys(p.prices).forEach(function (s) { if (s !== state.store) others += esc(s) + " " + money(p.prices[s]) + " · "; });
  var addDefault = opts.add != null ? opts.add : !p;
  openShell(p ? "Artikel" : "Neuer Artikel",
    '<div class="photo"><div class="pv" id="pv"></div><div class="btns">' +
    '<label class="btn" for="fCam">' + I("camera") + ' Foto aufnehmen</label><label class="btn" for="fImg">' + I("image") + ' Aus Galerie</label>' +
    '<button class="btn danger" id="fImgDel" type="button" style="display:none">Foto entfernen</button></div></div>' +
    '<input type="file" id="fCam" class="hide" accept="image/*" capture="environment"><input type="file" id="fImg" class="hide" accept="image/*">' +
    '<label class="f">Name</label><input type="text" id="fN" value="' + esc(p ? p.name : opts.name || "") + '" placeholder="z. B. Vollmilch 1 l" autocomplete="off">' +
    '<label class="f">Preis bei ' + esc(state.store) + ' (€)</label><input type="text" id="fP" inputmode="decimal" enterkeyhint="done" value="' + U.cents2str(pr) + '" placeholder="0,00" autocomplete="off">' +
    (others ? '<div class="hint">Bekannt: ' + others.replace(/ · $/, "") + "</div>" : "") +
    '<label class="f">Pfand pro Stück (€) – optional</label><input type="text" id="fD" inputmode="decimal" value="' + (p && p.deposit ? U.cents2str(p.deposit) : "") + '" placeholder="kein Pfand" autocomplete="off">' +
    '<div class="chips2"><button class="chip" type="button" data-d="">kein</button><button class="chip" type="button" data-d="0,08">0,08</button><button class="chip" type="button" data-d="0,15">0,15</button><button class="chip" type="button" data-d="0,25">0,25</button></div>' +
    '<label class="f">Lagerort im Vorrat</label><div class="chips2" id="fLoc">' + S.LOCS.map(function (x) {
      var cur = p ? S.locOf(b) : S.guessLoc(opts.name || "");
      return '<button class="chip loc l-' + x.k + (cur === x.k ? " on" : "") + '" type="button" data-loc="' + x.k + '">' + locIco(x) + " " + x.t + "</button>"; }).join("") + "</div>" +
    '<label class="check"><input type="checkbox" id="fFill"' + (p && p.fill ? " checked" : "") + '> Füllstand anzeigen <small>(für angebrochene Packungen: Öl, Mehl, Kaffee …)</small></label>' +
    (real ? '<label class="f">Barcode</label><input type="text" id="fB" value="' + esc(b) + '" readonly>'
          : '<label class="f">Barcode – optional</label><input type="text" id="fB" inputmode="numeric" placeholder="Nummer unter dem Strichcode" autocomplete="off">') +
    (opts.target === "pantry"
      ? '<label class="check"><input type="checkbox" id="fL"' + (addDefault ? " checked" : "") + "> In den Vorrat (+1, heute)" + (p && S.pantryOf(b).q ? " – schon " + S.pantryOf(b).q + "× im Haus" : "") + "</label>"
      : '<label class="check"><input type="checkbox" id="fL"' + (addDefault ? " checked" : "") + "> Auf die Liste „" + esc(l.name) + "“" + (have ? " (steht schon " + have + "× drauf → +1)" : "") + "</label>") +
    (p && S.pantryOf(b).q && opts.target !== "pantry" ? '<div class="hint pan">Im Vorrat: ' + S.pantryOf(b).q + "× seit " + U.day(S.pantryOf(b).since) + "</div>" : "") +
    (p && !p.loose ? priceChart(p) : "") + (p ? nutriBlock(p) : "") +
    (p && !p.loose ? '<label class="f">Preisalarm – melden, wenn es irgendwo höchstens … € kostet</label><input type="text" id="fAlarm" inputmode="decimal" value="' + (p.alarm ? U.cents2str(p.alarm) : "") + '" placeholder="kein Alarm" autocomplete="off">' : "") +
    (p ? '<h3>' + I("tag") + ' Angebote</h3><div id="offs"></div>' +
      '<div class="offadd"><select id="oS" aria-label="Markt">' + state.stores.map(function (x) { return '<option' + (x === state.store ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>" +
      '<input type="text" id="oP" inputmode="decimal" placeholder="Preis" autocomplete="off"><input type="date" id="oU" value="' + plusDays(6) + '" aria-label="gültig bis"></div>' +
      '<div class="col" style="margin-top:8px"><button class="btn" id="oAdd" type="button">＋ Angebot speichern</button></div>' +
      '<div class="links"><a class="btn" target="_blank" rel="noopener" href="https://www.marktguru.de/search/' + encodeURIComponent(p.name) + '">' + I("search") + ' Marktguru</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://www.kaufda.de/Angebote/' + encodeURIComponent(p.name) + '">' + I("search") + ' kaufDA</a></div>' : "") +
    '<div id="msg"></div>' +
    '<div class="col"><button class="btn primary" id="eSave" type="button" style="flex:none">Speichern</button>' +
    (real ? '<button class="btn" id="eFind" type="button">' + I("search") + ' Online suchen (Name, Foto, Nährwerte)</button>' : "") +
    (p ? '<button class="btn danger" id="eDel" type="button">Artikel löschen</button>' : "") + "</div>");
  ctx = { b: b, target: opts.target || "list", img: p && p.img || undefined, imgUrl: p && p.imgUrl || "" };
  showPhoto();
  $("eSave").onclick = saveEdit;
  if ($("eDel")) sure($("eDel"), function () { var n = p.name; S.removeProduct(b); S.save(); closeEdit(); render(); toast(n + " gelöscht"); });
  if ($("eFind")) $("eFind").onclick = function () { findOnline(); };
  ctx.loc = p ? S.locOf(b) : S.guessLoc(opts.name || ""); ctx.locSet = !!(p && p.loc);
  $("fLoc").onclick = function (e) { var x = e.target.closest("[data-loc]"); if (!x) return; ctx.loc = x.dataset.loc; ctx.locSet = true;
    Array.prototype.forEach.call(this.querySelectorAll("[data-loc]"), function (y) { y.classList.toggle("on", y === x); }); };
  $("fN").addEventListener("input", function () { if (ctx.locSet) return; ctx.loc = S.guessLoc(this.value);
    Array.prototype.forEach.call(document.querySelectorAll("#fLoc [data-loc]"), function (y) { y.classList.toggle("on", y.dataset.loc === ctx.loc); }); });
  Array.prototype.forEach.call(document.querySelectorAll("#edit [data-d]"), function (bt) { bt.onclick = function () { $("fD").value = bt.getAttribute("data-d"); }; });
  $("fN").onkeydown = $("fP").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } };
  function onPhoto() {
    var f = this.files && this.files[0], inp = this; if (!f) return;
    Scanner.makeThumb(f).then(function (d) { ctx.img = d; showPhoto(); msg("", ""); }, function () { msg("Foto konnte nicht geladen werden.", "bad"); });
    inp.value = "";
  }
  $("fCam").onchange = $("fImg").onchange = onPhoto;
  $("fImgDel").onclick = function () { ctx.img = null; ctx.imgUrl = ""; showPhoto(); };
  if (p) {
    renderOffs(b);
    $("offs").onclick = function (e) {
      var x = e.target.closest("[data-oi],[data-take]"); if (!x) return;
      if (x.dataset.oi) S.removeOffer(b, +x.dataset.oi);
      else { var h = p.op.hits[+x.dataset.take], st = S.matchStore(h.brand); if (!st) { msg("Markt „" + h.brand + "“ gibt es in der App nicht – unten von Hand eintragen.", "bad"); $("oP").value = U.cents2str(h.price); return; }
        S.addOffer(b, st, h.price, plusDays(6)); }
      S.save(); renderOffs(b); render();
    };
    $("oAdd").onclick = function () {
      var c = U.parsePrice($("oP").value), u = $("oU").value;
      if (c == null || !$("oP").value.trim()) { msg("Angebotspreis eintippen, z. B. 1,49", "bad"); $("oP").focus(); return; }
      if (!u || u < S.today()) { msg("„Gültig bis“ liegt in der Vergangenheit.", "bad"); return; }
      S.addOffer(b, $("oS").value, c, u); S.save(); $("oP").value = ""; renderOffs(b); render(); msg("Angebot gespeichert.", "ok");
    };
  }
  if (!p && real) findOnline();
  else setTimeout(function () { var el = (!p && !opts.name ? $("fN") : $("fP")); if (el) el.focus(); }, 60);
}

function plusDays(n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function renderOffs(b) {
  var p = S.products[b], h = "";
  S.offersOf(b).forEach(function (o, i) {
    var reg = S.priceOf(b, o.s);
    h += '<div class="kv s"><span>' + U.badge(o.s, "sm") + " " + money(o.p) + (reg != null && reg > o.p ? " <small>statt " + money(reg) + "</small>" : "") + " <small>bis " + dm(o.until) + '</small></span><button class="chip" type="button" data-oi="' + i + '">✕</button></div>';
  });
  ((p.op && p.op.hits) || []).forEach(function (x, i) {
    h += '<div class="kv s"><span>gemeldet: <b>' + esc(x.brand) + "</b> " + money(x.price) + (x.was ? " <small>statt " + money(x.was) + "</small>" : "") + " <small>" + esc(x.city || "") + " · " + dm(x.date) + '</small></span><button class="chip" type="button" data-take="' + i + '">übernehmen</button></div>';
  });
  if (!h) h = '<div class="hint" style="margin:0">Kein Angebot eingetragen' + (isCode(b) ? (p.op ? ", in Open Prices nichts gemeldet." : ".") : ". (Ohne Barcode keine automatische Prüfung.)") + "</div>";
  $("offs").innerHTML = '<div class="card">' + h + "</div>";
}

/* Name, Foto und Pfand-Vorschlag aus Open Food Facts */
function findOnline() {
  var my = ctx, b = ctx.b;
  msg("Suche online …", "ok");
  Lookup.byBarcode(b).then(function (r) {
    if (ctx !== my || !$("fN")) return;
    if (!r) { msg("Nicht in der Online-Datenbank. Bitte Namen selbst eintippen.", "bad"); $("fN").focus(); return; }
    var note = [];
    if (!$("fN").value.trim()) { $("fN").value = r.name; note.push("Name"); }
    if (r.imgUrl && !ctx.img && !ctx.imgUrl) { ctx.imgUrl = r.imgUrl; showPhoto(); note.push("Foto"); }
    if (r.nutri) { ctx.nutri = r.nutri; note.push("Nährwerte"); }
    if (r.loc && !ctx.locSet) { ctx.loc = r.loc; Array.prototype.forEach.call(document.querySelectorAll("#fLoc [data-loc]"), function (y) { y.classList.toggle("on", y.dataset.loc === r.loc); }); }
    else if (!ctx.locSet) { ctx.loc = S.guessLoc($("fN").value); Array.prototype.forEach.call(document.querySelectorAll("#fLoc [data-loc]"), function (y) { y.classList.toggle("on", y.dataset.loc === ctx.loc); }); }
    if (r.deposit && !$("fD").value.trim()) { $("fD").value = U.cents2str(r.deposit); note.push("Pfand " + money(r.deposit) + " (Vorschlag, bitte prüfen)"); }
    msg(note.length ? "Gefunden: " + note.join(", ") + ". Jetzt den Preis eintippen." : "Nichts Neues gefunden.", "ok");
    if (!$("fP").value.trim()) $("fP").focus();
  }, function () {
    if (ctx !== my || !$("fN")) return;
    msg("Keine Verbindung – bitte Namen selbst eintippen.", "bad"); $("fN").focus();
  });
}

function saveEdit() {
  try {
    var b = ctx.b, name = $("fN").value.trim(), raw = $("fP").value.trim(), pr = U.parsePrice(raw);
    if (!name) { msg("Bitte einen Namen eingeben.", "bad"); $("fN").focus(); return; }
    if (raw !== "" && pr == null) { msg("Preis nicht lesbar. Beispiel: 1,29", "bad"); $("fP").focus(); return; }
    var dr = $("fD").value.trim(), dv = dr === "" ? 0 : U.parsePrice(dr);
    if (dv == null) { msg("Pfand nicht lesbar. Beispiel: 0,25", "bad"); $("fD").focus(); return; }
    var nb = "";
    if (!b || b.indexOf("r-") === 0) {
      nb = $("fB").value.replace(/\D/g, "");
      if ($("fB").value.trim() && nb.length < 8) { msg("Barcode zu kurz (mindestens 8 Ziffern).", "bad"); $("fB").focus(); return; }
    }
    if (!b) b = nb.length >= 8 ? nb : S.newKey(name);
    var p = S.products[b] || (S.products[b] = { b: b, name: name, prices: {}, created: Date.now() });
    p.name = name; if (!p.prices) p.prices = {};
    if (ctx.loc) p.loc = ctx.loc;
    if (ctx.nutri) p.nutri = ctx.nutri;
    if ($("fAlarm")) { var al = $("fAlarm").value.trim(), av = al ? U.parsePrice(al) : null; if (av) p.alarm = av; else delete p.alarm; }
    if ($("fFill").checked) { p.fill = true; if (p.level == null) p.level = 100; } else { delete p.fill; delete p.level; }
    if (raw !== "") S.setPrice(b, state.store, pr); else delete p.prices[state.store];
    if (dv > 0) p.deposit = dv; else delete p.deposit;
    if (ctx.img) p.img = ctx.img; else delete p.img;
    if (ctx.imgUrl) p.imgUrl = ctx.imgUrl; else delete p.imgUrl;
    if (nb.length >= 8 && b !== nb) { p = S.rekey(b, nb, p); b = nb; }
    var add = $("fL").checked, target = ctx.target, price = p.prices[state.store] != null ? " · " + money(p.prices[state.store]) : "";
    S.save(); closeEdit();
    if (add && target === "pantry") { pantryIn(b); return; }
    if (add) { render(); askPantry(b, function () { S.addToList(b, 1); S.save(); render(); toast("✓ " + name + price + " → Liste"); }); return; }
    render(); toast("✓ " + name + price + " gespeichert");
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

/* ---------- Menü: Märkte + Sicherung ---------- */
function openMenu() {
  var ms = state.stores.map(function (s, i) { return '<div class="kv mrow"><span>' + U.badge(s) + '</span><span class="mbtns"><button class="chip' + (state.cards[s] ? " on" : "") + '" data-card="' + i + '" type="button">' + (state.cards[s] ? "" + I("qr") + " Karte" : "＋ Karte") + '</button><button class="chip" data-del="' + i + '" type="button">entfernen</button></span></div>'; }).join("");
  openShell("Menü",
    "<h3>Märkte</h3><div class=\"card\">" + ms + '</div><div class="col" style="margin-top:8px"><button class="btn" id="mAdd" type="button">＋ Markt hinzufügen</button></div>' +
    '<h3>Lagerorte</h3><div class="card" id="mLocs">' + S.LOCS.map(function (l, i) {
      return '<div class="kv mrow"><span>' + locIco(l) + " " + esc(l.t) + "</span>" + (i < 3 ? "<small>fest</small>" : '<button class="chip" type="button" data-ldel="' + esc(l.k) + '">entfernen</button>') + "</div>"; }).join("") + "</div>" +
    '<div class="addloc"><select id="mLocI" aria-label="Symbol">' + [["box", "Kiste"], ["basket", "Korb"], ["bottle", "Flasche"], ["shelf", "Regal"], ["door", "Tür"], ["home", "Haus"], ["spray", "Putzmittel"], ["bath", "Bad"]].map(function (x) { return '<option value="' + x[0] + '">' + x[1] + "</option>"; }).join("") +
    '</select><input type="text" id="mLocN" placeholder="z. B. Keller" autocomplete="off"><button class="btn" id="mLocAdd" type="button">＋</button></div>' +
    '<h3>Beim Öffnen</h3><div class="chips2" id="mLaunch">' + [["", "Fragen"], ["home", "Einkaufen"], ["shop", "Einkaufsmodus"], ["pantry", "Lager"]].map(function (x) {
      return '<button class="chip' + ((state.launch || "") === x[0] ? " on" : "") + '" type="button" data-l="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
    '<h3>Erinnerung</h3><div class="col" style="margin-top:0"><button class="btn" id="mNotify" type="button">' + I("bell") + ' MHD-Erinnerung aufs Handy: ' + notifyStatus() + "</button></div>" +
    '<div class="hint">Das Handy meldet sich, wenn etwas im Vorrat in den nächsten Tag abläuft. Im Hintergrund klappt das nur, wenn die App auf dem Startbildschirm installiert ist (Chrome/Android).</div>' +
    '<h3>Budget</h3><div class="col" style="margin-top:0"><button class="btn" id="mBud" type="button">' + (state.budget ? "Monatsbudget: " + money(state.budget) + " – ändern" : "Monatsbudget festlegen") + "</button></div>" +
    '<h3>Sicherung</h3><div class="hint" style="margin-top:0">Deine Daten liegen nur auf diesem Gerät. ' + (state.lastBackup ? "Letzte Sicherung: " + U.day(state.lastBackup) + "." : "Noch keine Sicherung gemacht.") + "</div>" +
    '<div class="col">' +
    '<button class="btn primary" id="mCloud" type="button" style="flex:none">' + I("upload") + ' Cloud-Sicherung: ' + cloudStatusText().replace(/<[^>]+>/g, "") + "</button>" +
    '<button class="btn" id="mSave" type="button">' + I("download") + ' Sicherung speichern</button>' +
    '<button class="btn" id="mCopy" type="button">' + I("copy") + ' Sicherung kopieren</button>' +
    '<label class="btn" for="mFile">' + I("upload") + ' Sicherung aus Datei laden</label><input type="file" id="mFile" class="hide" accept=".json,application/json"></div>' +
    '<label class="f">Oder Sicherung hier einfügen</label><textarea id="mTxt" placeholder="{ … }"></textarea>' +
    '<div class="col" style="margin-top:10px"><button class="btn" id="mPaste" type="button">Einfügen &amp; zusammenführen</button></div>' +
    '<div id="msg"></div><div class="hint" id="mInfo"></div>');
  ctx = { simple: true };
  var info = "Artikel: " + Object.keys(S.products).length + " · Märkte: " + state.stores.length + " · Einkäufe: " + state.purchases.length;
  $("mInfo").textContent = info;
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) { if ($("mInfo")) $("mInfo").textContent = info + " · Speicher " + (p ? "dauerhaft geschützt" : "nicht dauerhaft geschützt"); });
  Array.prototype.forEach.call(document.querySelectorAll("#edit [data-del]"), function (bt) {
    bt.onclick = function () {
      if (state.stores.length < 2) { msg("Mindestens ein Markt muss bleiben.", "bad"); return; }
      if (!bt.dataset.sure) { bt.dataset.sure = 1; bt.textContent = "wirklich?"; return; }
      var s = state.stores[+bt.dataset.del]; state.stores.splice(+bt.dataset.del, 1);
      if (state.store === s) state.store = state.stores[0];
      S.save(); openMenu(); render();
    };
  });
  $("mAdd").onclick = function () { closeEdit(); addStore(); };
  Array.prototype.forEach.call(document.querySelectorAll("#edit [data-card]"), function (bt) {
    bt.onclick = function () { var st = state.stores[+bt.dataset.card]; closeEdit(); if (state.cards[st]) showCard(st); else addCard(st); };
  });
  $("mSave").onclick = function () { doBackup(); msg("Sicherung wurde heruntergeladen.", "ok"); };
  $("mBud").onclick = function () { closeEdit(); askBudget(); };
  $("mLaunch").onclick = function (e) { var x = e.target.closest("[data-l]"); if (!x) return; state.launch = x.dataset.l; S.save();
    Array.prototype.forEach.call(this.querySelectorAll("[data-l]"), function (y) { y.classList.toggle("on", y === x); }); };
  $("mCloud").onclick = function () { closeEdit(); openCloud(); };
  $("mNotify").onclick = function () { toggleNotify().then(function () { if ($("mNotify")) $("mNotify").textContent = "MHD-Erinnerung aufs Handy: " + notifyStatus(); }); };
  $("mLocAdd").onclick = function () {
    var n = $("mLocN").value.trim(); if (!n) { msg("Bitte einen Namen für den Lagerort eingeben.", "bad"); return; }
    var k = "c-" + S.newKey(n, "").replace(/^-/, "");
    if (S.LOCS.some(function (l) { return l.t.toLowerCase() === n.toLowerCase(); })) { msg("Den Lagerort gibt es schon.", "bad"); return; }
    state.locs.push({ k: k, t: n, i: $("mLocI").value }); S.save(); openMenu(); render();
  };
  $("mLocs").onclick = function (e) {
    var x = e.target.closest("[data-ldel]"); if (!x) return;
    if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = "wirklich?"; return; }
    var k = x.dataset.ldel; state.locs = state.locs.filter(function (l) { return l.k !== k; });
    Object.keys(S.products).forEach(function (b) { if (S.products[b].loc === k) delete S.products[b].loc; });
    S.save(); openMenu(); render();
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
$("menuBtn").addEventListener("click", openMenu);
