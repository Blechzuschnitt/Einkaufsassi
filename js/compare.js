/* Einkaufsliste mit Kassenbon vergleichen: Bon-Zeilen einlesen, den Listen-Artikeln zuordnen, auswerten, speichern. */
var Compare = (function () {
  var $ = U.$, esc = U.esc, money = U.money;
  var cur = null;   // {list, store, lines:[{name, price, qty, dep, assign}], total, depSum}

  var SKIP = /(^|\s)(bar|ec|karte|kartenzahlung|girocard|visa|mastercard|r[uü]ckgeld|gegeben|mwst|ust|steuer|netto|brutto|beleg|bon-?nr|kasse|filiale|datum|uhrzeit|tse|vielen dank|zahlung|betrag eur)(\s|$|:)/i;
  var TOTAL = /(summe|zu zahlen|gesamt|total|endbetrag)/i;
  var DEP = /(pfand|leergut|einweg|mehrweg)/i;
  var PRICE = /^(.*?)[\s.:]+(-?\d{1,4}[.,]\d{2})\s*(-)?\s*(?:€|eur)?\s*[A-Z*]{0,2}\s*$/i;
  var QTY = /^(\d+)\s*[x×*]\s*(?:(\d{1,4}[.,]\d{2})\s*(?:€|eur)?)?\s*$/i;      // „2 x 0,29“ (Mengenzeile)
  var PRE = /^(\d+)\s*[x×*]\s+(.*)$/i;                                         // „2x Name 0,58“

  function cents(s) { return Math.round(parseFloat(String(s).replace(",", ".")) * 100); }

  function parse(text) {
    var out = { lines: [], total: null, dep: 0 }, last = null;
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      var s = raw.replace(/\s+/g, " ").trim(); if (!s) return;
      var m = s.match(QTY);
      if (m) { if (last) last.qty = +m[1]; return; }
      m = s.match(PRICE); if (!m) return;
      var name = m[1].trim(), c = cents(m[2]) * (m[3] ? -1 : 1), qty = 1;
      if (TOTAL.test(name)) { out.total = Math.abs(c); return; }
      if (SKIP.test(name)) return;
      if (DEP.test(name)) { out.dep += c; return; }
      var pm = name.match(PRE); if (pm) { qty = +pm[1]; name = pm[2].trim(); }
      if (!name) return;
      if (c < 0 && last) { last.price += c; last.disc = (last.disc || 0) + c; return; }   // Rabattzeile → zum Artikel davor
      last = { name: name, price: c, qty: qty, assign: null };
      out.lines.push(last);
    });
    return out;
  }

  /* Bon-Zeilen den Listen-Artikeln zuordnen (bestes Paar zuerst) */
  function match(lines, list) {
    var pairs = [];
    lines.forEach(function (ln, i) {
      list.items.forEach(function (it) {
        var p = Store.products[it.b]; if (!p) return;
        var s = U.sim(ln.name, p.name);
        if (s >= 0.34) pairs.push({ i: i, b: it.b, s: s });
      });
    });
    pairs.sort(function (a, b) { return b.s - a.s; });
    var usedL = {}, usedB = {};
    pairs.forEach(function (p) { if (usedL[p.i] || usedB[p.b]) return; usedL[p.i] = usedB[p.b] = 1; lines[p.i].assign = p.b; });
    /* Rest: vielleicht ein bekannter Artikel, der nicht auf der Liste steht */
    lines.forEach(function (ln) {
      if (ln.assign) return;
      var best = null, bs = 0.6;
      Object.keys(Store.products).forEach(function (b) { var s = U.sim(ln.name, Store.products[b].name); if (s > bs) { bs = s; best = b; } });
      ln.known = best;
    });
  }

  function open() {
    var l = Store.activeList(), st = Store.state.store;
    cur = { list: l, store: st, text: "" };
    App.openShell("Kassenbon vergleichen",
      '<div class="hint" style="margin-top:0">Liste <b>' + esc(l.name) + "</b> · Markt <b>" + esc(st) + "</b></div>" +
      '<label class="f">Kassenbon – eine Zeile pro Artikel: <i>Name Preis</i></label>' +
      '<textarea id="cTxt" rows="9" placeholder="Laugenstange 1,99\nMineralwasser 0,58\n2 x 0,29\nPfand 0,50\nSumme 3,07"></textarea>' +
      '<div class="hint">Text vom Bon abtippen oder einfügen (z. B. aus der Lidl-Plus-/Rewe-App oder per Text-Erkennung der Handy-Kamera kopiert). Mengenzeilen „2 x 0,29“, Pfand, Rabatte und „Summe“ werden erkannt.</div>' +
      '<div class="col"><label class="btn ocr" for="cImg">' + I("camera") + ' Bon fotografieren / Foto wählen</label>' +
      '<button class="btn" id="cFill" type="button">Abgehakte Artikel als Bon übernehmen</button>' +
      '<button class="btn primary" id="cGo" type="button" style="flex:none">Auswerten</button></div><div id="msg"></div><div id="cRes"></div>' +
      '<input type="file" id="cImg" class="hide" accept="image/*">');
    $("cImg").onchange = function () {
      var f = this.files && this.files[0], inp = this; if (!f) return; inp.value = "";
      ocr(f, function (p) { App.msg(p, "ok"); }).then(function (txt) {
        var lines = cleanOcr(txt);
        if (!lines.length) { App.msg("Kein Text mit Preisen erkannt. Bon gerade, flach und hell fotografieren – oder abtippen.", "bad"); return; }
        $("cTxt").value = lines.join("\n") + "\n";
        App.msg("✓ " + lines.length + " Zeilen erkannt – bitte kurz prüfen (Texterkennung ist nicht perfekt), dann „Auswerten“.", "ok");
        $("cTxt").scrollIntoView({ behavior: "smooth", block: "center" });
      }, function (e) { App.msg("Texterkennung fehlgeschlagen" + (navigator.onLine ? "" : " – beim ersten Mal braucht sie Internet") + ". (" + (e && e.message || e) + ")", "bad"); });
    };
    $("cFill").onclick = function () {
      var its = l.items.filter(function (i) { return i.done; }); if (!its.length) its = l.items;
      $("cTxt").value = its.map(function (it) {
        var p = Store.products[it.b], pr = Store.effPrice(it.b, st);
        return (it.qty > 1 ? it.qty + "x " : "") + p.name + " " + U.cents2str((pr || 0) * it.qty);
      }).join("\n") + "\n";
      App.msg("Preise der Liste eingesetzt – ändere die Zeilen, die auf dem Bon anders sind.", "ok");
    };
    $("cGo").onclick = function () {
      var r = parse($("cTxt").value);
      if (!r.lines.length) { App.msg("Keine Zeile mit Preis erkannt. Format: Name 1,99", "bad"); return; }
      cur.lines = r.lines; cur.total = r.total; cur.dep = r.dep;
      match(cur.lines, l); App.msg("", ""); result();
    };
  }

  function result() {
    var l = cur.list, st = cur.store, rows = "", exp = 0, paid = 0, nUp = 0, nDown = 0, extra = [], assigned = {};
    var opts = function (sel) {
      var o = '<option value="">– nicht auf der Liste –</option>';
      l.items.forEach(function (it) { o += '<option value="' + esc(it.b) + '"' + (it.b === sel ? " selected" : "") + ">" + esc(Store.products[it.b].name) + "</option>"; });
      return o;
    };
    cur.lines.forEach(function (ln, i) {
      paid += ln.price;
      if (!ln.assign) { extra.push(ln); rows += '<div class="cmp extra"><div class="cn"><b>' + esc(ln.name) + "</b>" + (ln.qty > 1 ? " ×" + ln.qty : "") + '<select data-i="' + i + '">' + opts("") + '</select></div><div class="cv"><b>' + money(ln.price) + '</b><small>nicht geplant</small></div></div>'; return; }
      assigned[ln.assign] = 1;
      var pr = Store.effPrice(ln.assign, st), e = pr == null ? null : pr * ln.qty, d = e == null ? null : ln.price - e;
      if (e != null) exp += e;
      if (d > 0) nUp++; if (d < 0) nDown++;
      rows += '<div class="cmp"><div class="cn"><b>' + esc(ln.name) + "</b>" + (ln.qty > 1 ? " ×" + ln.qty : "") + '<select data-i="' + i + '">' + opts(ln.assign) + "</select></div>" +
        '<div class="cv"><b>' + money(ln.price) + "</b><small>" + (e == null ? "kein Listenpreis" : "Liste " + money(e)) + "</small>" +
        (d ? '<span class="' + (d > 0 ? "bad" : "good") + '">' + U.signed(d) + "</span>" : e != null ? '<span class="good">✓</span>' : "") + "</div></div>";
    });
    var missing = l.items.filter(function (it) { return !assigned[it.b]; });
    var missSum = 0;
    missing.forEach(function (it) { var pr = Store.effPrice(it.b, st); if (pr != null) missSum += pr * it.qty; });
    var expDep = 0;
    l.items.forEach(function (it) { if (assigned[it.b]) expDep += ((Store.products[it.b] || {}).deposit || 0) * it.qty; });
    var bonTotal = cur.total != null ? cur.total : paid + cur.dep, expected = exp + expDep;
    var diff = bonTotal - expected, extraSum = extra.reduce(function (a, x) { return a + x.price; }, 0);
    cur.sum = { bon: bonTotal, expected: expected, extra: extra.length, missing: missing.length };

    var h = '<h3>Auswertung</h3><div class="tiles">' +
      '<div class="tile"><b>' + money(bonTotal) + "</b><span>laut Bon</span></div>" +
      '<div class="tile"><b>' + money(expected) + "</b><span>laut Liste (gekaufte Artikel)</span></div>" +
      '<div class="tile"><b class="' + (diff > 0 ? "bad" : "good") + '">' + U.signed(diff) + "</b><span>" + (diff > 0 ? "mehr bezahlt" : diff < 0 ? "gespart" : "genau wie geplant") + "</span></div>" +
      '<div class="tile"><b>' + (cur.lines.length - extra.length) + "/" + l.items.length + "</b><span>Listen-Artikel gekauft</span></div></div>";
    var notes = [];
    if (nUp) notes.push(nUp + " Artikel teurer als gespeichert");
    if (nDown) notes.push(nDown + " günstiger");
    if (extra.length) notes.push(extra.length + " nicht geplant (" + money(extraSum) + ")");
    if (missing.length) notes.push(missing.length + " von der Liste nicht gekauft" + (missSum ? " (" + money(missSum) + ")" : ""));
    if (cur.dep) notes.push("Pfand auf dem Bon " + money(cur.dep) + (expDep !== cur.dep ? ", erwartet " + money(expDep) : ""));
    if (cur.total != null && Math.abs(cur.total - paid - cur.dep) > 1) notes.push("Achtung: Zeilen ergeben " + money(paid + cur.dep) + ", Bon-Summe ist " + money(cur.total) + " – fehlt eine Zeile?");
    if (notes.length) h += '<div class="note">' + notes.map(esc).join("<br>") + "</div>";
    h += "<h3>Bon-Zeilen</h3>" + rows;
    if (missing.length) h += "<h3>Auf der Liste, aber nicht auf dem Bon</h3>" + missing.map(function (it) {
      var p = Store.products[it.b], pr = Store.effPrice(it.b, st);
      return '<div class="cmp miss"><div class="cn"><b>' + esc(p.name) + "</b>" + (it.qty > 1 ? " ×" + it.qty : "") + '</div><div class="cv"><small>' + (pr == null ? "" : money(pr * it.qty)) + "</small></div></div>";
    }).join("");
    h += '<h3>Speichern</h3>' +
      '<label class="check"><input type="checkbox" id="oPrice" checked> Bon-Preise als neue Preise bei ' + esc(st) + " übernehmen</label>" +
      '<label class="check"><input type="checkbox" id="oNew"' + (extra.length ? "" : " disabled") + "> Nicht geplante Artikel als neue Artikel anlegen</label>" +
      '<label class="check"><input type="checkbox" id="oDone" checked> Gekaufte Artikel von der Liste nehmen</label>' +
      '<label class="check"><input type="checkbox" id="oPan" checked> Gekaufte Artikel mit heutigem Datum in den Vorrat</label>' +
      '<div class="col"><button class="btn primary" id="cSave" type="button" style="flex:none">Einkauf speichern</button></div>';
    $("cRes").innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll("#cRes select[data-i]"), function (s) {
      s.onchange = function () {
        var v = s.value, ln = cur.lines[+s.dataset.i];
        cur.lines.forEach(function (x) { if (v && x.assign === v) x.assign = null; });
        ln.assign = v || null; result();
      };
    });
    $("cSave").onclick = save;
    $("cRes").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function save() {
    var l = cur.list, st = cur.store, S = Store, upd = 0, created = 0;
    var takePrice = $("oPrice").checked, makeNew = $("oNew").checked, rmDone = $("oDone").checked, toPan = $("oPan").checked, now = Date.now(), nPan = 0;
    var items = cur.lines.map(function (ln) {
      var b = ln.assign || ln.known || null;
      if (!b && makeNew) { b = S.newKey(ln.name); S.products[b] = { b: b, name: ln.name, prices: {}, created: Date.now() }; created++; }
      if (b && takePrice && ln.qty > 0 && (ln.assign || makeNew || ln.known)) {
        var unit = Math.round(ln.price / ln.qty), before = S.priceOf(b, st);
        if (before !== unit && !S.offerAt(b, st)) { S.setPrice(b, st, unit); upd++; }   // Angebotspreis ist kein neuer Normalpreis
      }
      if (b && toPan && S.products[b]) { S.pantryAdd(b, ln.qty || 1, now, "kauf"); nPan++; }
      return { name: ln.name, b: b, price: ln.price, qty: ln.qty };
    });
    S.state.purchases.push({ id: S.uid(), date: Date.now(), store: st, list: l.name, total: cur.sum.bon, expected: cur.sum.expected,
      items: items, extra: cur.sum.extra, missing: cur.sum.missing });
    if (rmDone) { var bought = {}; cur.lines.forEach(function (ln) { if (ln.assign) bought[ln.assign] = 1; }); l.items = l.items.filter(function (it) { return !bought[it.b]; }); }
    S.save(); App.closeEdit(); App.go("stats");
    U.toast("✓ Einkauf gespeichert" + (upd ? " · " + upd + " Preise aktualisiert" : "") + (created ? " · " + created + " neue Artikel" : "") + (nPan ? " · " + nPan + " in den Vorrat" : ""), 4000);
  }

  /* ---------- Texterkennung (Tesseract.js, wird nur bei Bedarf geladen) ---------- */
  var tessP = null;
  function loadTess() {
    if (window.Tesseract) return Promise.resolve();
    if (!tessP) tessP = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = res; s.onerror = function () { tessP = null; rej(new Error("Bibliothek nicht ladbar")); }; document.head.appendChild(s);
    });
    return tessP;
  }
  /* Foto → Graustufen, Kontrast hoch, sinnvolle Größe */
  function prep(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var sc = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        var x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
        var d = x.getImageData(0, 0, c.width, c.height), a = d.data;
        for (var i = 0; i < a.length; i += 4) { var g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.6 + 140)); a[i] = a[i + 1] = a[i + 2] = g; }
        x.putImageData(d, 0, 0); URL.revokeObjectURL(u); res(c);
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error("Bild nicht lesbar")); };
      img.src = u;
    });
  }
  function ocr(file, progress) {
    progress("Texterkennung wird geladen … (beim ersten Mal einige MB)");
    var worker;
    return Promise.all([loadTess(), prep(file)]).then(function (r) {
      return window.Tesseract.createWorker("deu", 1, { logger: function (m) { if (m.status === "recognizing text") progress("Lese den Bon … " + Math.round(m.progress * 100) + " %"); } })
        .then(function (w) { worker = w; return w.recognize(r[1]); });
    }).then(function (out) { if (worker) worker.terminate(); return out.data.text || ""; }, function (e) { if (worker) worker.terminate(); throw e; });
  }
  /* typische Lesefehler glätten, nur Zeilen mit Preis behalten */
  function cleanOcr(txt) {
    return String(txt).split(/\r?\n/).map(function (l) {
      return l.replace(/\s+/g, " ").replace(/(\d)\s*[,.]\s*(\d\d)\b/g, "$1,$2").replace(/[|]/g, "").trim();
    }).filter(function (l) { return /\d+,\d\d/.test(l) || /^\d+\s*[x×*]/i.test(l); });
  }

  return { open: open, parse: parse, cleanOcr: cleanOcr };
})();
