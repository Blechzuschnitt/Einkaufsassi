/* Oberfläche: Kopf (Markt, Suche, Neu), Seiten (Start, Liste, Artikel, Statistik), Scannen, Artikel-Formular, Menü */
(function () {
  "use strict";
  var S = Store, state = S.state, $ = U.$, esc = U.esc, money = U.money, toast = U.toast;
  var tab = "home";
  /* Seite und Skripte passen nicht zusammen (alte Seite aus dem Zwischenspeicher) → einmal neu laden */
  if (!$("storeBtn")) {
    var k = "einkauf-reload";
    try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); location.reload(); return; } } catch (e) {}
    $("err").textContent = "Neue Version – bitte die Seite neu laden."; $("err").style.display = "block"; return;
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
    var o = S.offerAt(b), reg = S.priceOf(b);
    if (o && (reg == null || o.p < reg)) return '<span class="tag">🏷 Angebot' + (reg != null ? " statt " + money(reg) : "") + " bis " + dm(o.until) + "</span>";
    var other = S.offersOf(b).filter(function (x) { return x.s !== state.store; }).sort(function (a, c) { return a.p - c.p; })[0];
    if (other) return '<span class="tag">🏷 bei ' + esc(other.s) + " " + money(other.p) + " bis " + dm(other.until) + "</span>";
    var p = S.products[b], h = p && p.op && p.op.hits && p.op.hits[0];
    if (h) return '<span class="tag">🏷 gemeldet: ' + esc(h.brand) + " " + money(h.price) + " (" + dm(h.date) + ")</span>";
    return "";
  }
  /* Open Prices für alle Listen-Artikel mit Barcode abfragen (höchstens alle 12 h je Artikel) */
  var opBusy = false, opInfo = "";
  function checkOffers(force) {
    if (opBusy) return;
    var l = S.activeList(), todo = l.items.map(function (i) { return i.b; }).filter(function (b) {
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

  /* ================= Kopf ================= */
  function renderStores() {
    $("storeBtn").innerHTML = '<small>Markt</small>' + U.badge(state.store, "big") + '<span class="caret">▾</span>';
    $("cardBtn").classList.toggle("has", !!state.cards[state.store]);
    $("cardBtn").setAttribute("aria-label", state.cards[state.store] ? "Kundenkarte " + state.store + " zeigen" : "Kundenkarte für " + state.store + " hinzufügen");
    var l = S.activeList(), cmp = {};
    S.storeCompare(l).forEach(function (r) { cmp[r.store] = r; });
    var h = '<div class="pophead">Wo kaufst du ein?</div><div class="mgrid">';
    state.stores.forEach(function (s) {
      var r = cmp[s];
      h += '<button type="button" class="mopt' + (s === state.store ? " on" : "") + '" data-s="' + esc(s) + '">' + U.badge(s, "big") +
        "<small>" + (state.cards[s] ? "▣ Karte · " : "") + (r ? "Liste " + money(r.sum) + (r.have < r.of ? " · " + r.have + "/" + r.of : "") : "keine Preise") + "</small></button>";
    });
    h += '<button type="button" class="mopt add" data-s="__add">＋<small>Markt hinzufügen</small></button></div>';
    $("storePop").innerHTML = h;
  }
  function setStore(v) { state.store = v; S.activeList().store = v; S.save(); render(); }
  function togglePop(on) { $("storePop").classList.toggle("open", on); }
  $("storeBtn").addEventListener("click", function () { togglePop(!$("storePop").classList.contains("open")); });
  $("storePop").addEventListener("click", function (e) {
    var b = e.target.closest("[data-s]");
    if (!b) { if (e.target === this) togglePop(false); return; }
    togglePop(false);
    if (b.dataset.s === "__add") addStore(); else setStore(b.dataset.s);
  });
  function addStore() {
    openSimple("Markt hinzufügen", "Name des Marktes", "z. B. Netto", "", "Hinzufügen", function (n) {
      if (!n) { msg("Bitte Namen eingeben.", "bad"); return; }
      if (state.stores.indexOf(n) < 0) state.stores.push(n);
      closeEdit(); setStore(n); toast("Markt " + n + " gewählt");
    });
  }

  /* ---------- Suche mit Vorschlägen ---------- */
  var q = $("q"), sugg = $("sugg"), suggList = [];
  function score(p, qn, digits) {
    var n = U.norm(p.name);
    if (digits && p.b.indexOf(digits) >= 0) return 4;
    if (n.indexOf(qn) === 0) return 3;
    if ((" " + n).indexOf(" " + qn) >= 0) return 2.5;
    if (n.indexOf(qn) >= 0) return 2;
    var words = qn.split(" ");
    if (words.length > 1 && words.every(function (w) { return n.indexOf(w) >= 0; })) return 1.5;
    var s = U.sim(qn, n); return s > 0.45 ? s : 0;
  }
  function suggest() {
    var v = q.value.trim(), qn = U.norm(v), digits = /^\d{4,}$/.test(v) ? v : "";
    if (!qn) { sugg.classList.remove("open"); suggList = []; return; }
    suggList = Object.keys(S.products).filter(function (b) { return tab === "pantry" || !S.products[b].loose; }).map(function (b) { var p = S.products[b]; return { b: b, p: p, s: score(p, qn, digits) }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s || a.p.name.localeCompare(b.p.name); }).slice(0, 8);
    var h = "";
    suggList.forEach(function (x, i) {
      var pr = S.effPrice(x.b), have = inList(x.b);
      h += '<button type="button" class="sg' + (i === 0 ? " first" : "") + '" data-b="' + esc(x.b) + '">' + thumb(x.p, "sthumb") +
        '<span class="sn">' + esc(x.p.name) + (have ? '<small> · ' + have + "× auf der Liste</small>" : "") + (S.pantryOf(x.b).q ? '<small class="pan"> · 🥫 ' + S.pantryOf(x.b).q + "× im Haus</small>" : "") + "</span>" +
        '<span class="sp' + (pr == null ? " warn" : "") + '">' + (pr == null ? "kein Preis" : money(pr)) + '</span><span class="plus">＋</span></button>';
    });
    if (/^\d{8,14}$/.test(v) && !S.products[v]) h += '<button type="button" class="sg new" data-code="' + esc(v) + '">▮▯▮ Barcode ' + esc(v) + " anlegen</button>";
    else h += '<button type="button" class="sg new" data-new="1">＋ „' + esc(v) + '“ als neuen Artikel anlegen</button>';
    sugg.innerHTML = h; sugg.classList.add("open");
  }
  function pickSugg(el) {
    if (!el) return;
    var v = q.value.trim();
    q.value = ""; sugg.classList.remove("open"); q.blur();
    if (el.dataset.code) { handleCode(el.dataset.code); return; }
    if (el.dataset.new) { openEdit(null, { name: v, add: true, target: tab === "pantry" ? "pantry" : "list" }); return; }
    if (tab === "pantry") pantryIn(el.dataset.b); else addB(el.dataset.b);
  }
  function addB(b) {
    askPantry(b, function () {
      var it = S.addToList(b, 1); S.save(); render();
      var pr = S.effPrice(b);
      toast("✓ " + S.products[b].name + (pr != null ? " · " + money(pr) : " · Preis fehlt") + " → " + S.activeList().name + (it.qty > 1 ? " (" + it.qty + "×)" : ""));
    });
  }

  /* ---------- Vorrat ---------- */
  function ago(ts) {
    var d = Math.floor((Date.now() - ts) / 864e5);
    return d <= 0 ? "heute" : d === 1 ? "gestern" : "vor " + d + " Tagen";
  }
  function pantryIn(b) {
    S.pantryAdd(b, 1, Date.now(), "hand"); S.save(); render();
    toast("🥫 " + S.products[b].name + " → Vorrat (" + S.pantryOf(b).q + "× im Haus)");
  }
  /* Wert eines Stücks für die Wegwerf-Statistik: aktueller Markt, sonst günstigster bekannter Preis */
  function unitValue(b) {
    var v = S.effPrice(b); if (v != null) return v;
    var ps = S.products[b] && S.products[b].prices || {}, k = Object.keys(ps);
    return k.length ? Math.min.apply(null, k.map(function (s) { return ps[s]; })) : 0;
  }
  /* waste: true = weggeworfen, false = verbraucht, undefined = bei abgelaufenem MHD nachfragen */
  function pantryOut(b, waste) {
    var p = S.products[b], v = S.pantryOf(b);
    if (!v.q) { toast(p.name + " ist nicht im Vorrat eingetragen"); return; }
    if (waste === undefined && v.exp && daysTo(v.exp) < 0) {
      ask("<b>" + esc(p.name) + "</b> ist " + mhdText(v.exp) + ".", "Verbraucht oder weggeworfen?",
        [{ t: "✓ Verbraucht", fn: function () { pantryOut(b, false); } },
         { t: "🗑 Weggeworfen", primary: true, fn: function () { pantryOut(b, true); } }]);
      return;
    }
    waste = !!waste;
    var val = unitValue(b);
    state.outlog.push({ b: b, n: p.name, q: 1, d: Date.now(), w: waste, v: val, loc: S.locOf(b) });
    if (state.outlog.length > 2000) state.outlog.shift();
    var rest = S.pantryTake(b, 1);
    var what = waste ? "🗑 " + p.name + " weggeworfen" + (val ? " (≈ " + money(val) + ")" : "") : "🥫 " + p.name + " entnommen";
    if (!rest && p.loose) { S.removeProduct(b); S.save(); render(); toast(what + " – aus dem Vorrat entfernt"); return; }
    S.save(); render();
    if (rest) { toast(what + " · noch " + rest + "× im Haus"); return; }
    if (inList(b)) { toast(what + " – nichts mehr da, steht schon auf der Liste"); return; }
    ask((waste ? "🗑 <b>" + esc(p.name) + "</b> weggeworfen – jetzt ist nichts mehr da." : "🥫 <b>" + esc(p.name) + "</b> ist jetzt aufgebraucht."), "Auf die Einkaufsliste setzen?",
      [{ t: "🛒 Ja, auf die Liste", primary: true, fn: function () { S.addToList(b, 1); S.save(); render(); toast("✓ " + p.name + " → " + S.activeList().name); } },
       { t: "Nein", fn: function () {} }]);
  }
  /* Steht der Artikel noch im Vorrat? Dann erst nachfragen. */
  function askPantry(b, proceed) {
    var v = S.pantryOf(b), p = S.products[b];
    if (!v.q || inList(b)) { proceed(); return; }
    ask("🥫 <b>" + esc(p.name) + "</b> ist laut Vorrat noch im Haus:<br><b>" + v.q + "×</b> seit " + U.day(v.since) + " (" + ago(v.since) + ").", "Ist noch etwas davon da?",
      [{ t: "Ja, noch da – nicht kaufen", fn: function () { toast(p.name + " bleibt im Vorrat, nicht auf der Liste"); } },
       { t: "🛒 Nein, aufgebraucht → auf die Liste", primary: true, fn: function () { S.pantryClear(b); proceed(); } },
       { t: "Trotzdem auf die Liste", fn: proceed }]);
  }
  function ask(html, question, buttons) {
    var a = $("ask"), wasLive = live.on && !live.paused;
    if (wasLive) pauseLive();
    a.innerHTML = '<div class="asksheet"><div class="asktxt">' + html + '</div><div class="askq">' + esc(question) + '</div><div class="col">' +
      buttons.map(function (x, i) { return '<button type="button" class="btn' + (x.primary ? " primary" : "") + '" data-i="' + i + '">' + esc(x.t) + "</button>"; }).join("") + "</div></div>";
    a.classList.add("open");
    a.onclick = function (e) {
      var bt = e.target.closest("[data-i]"); if (!bt && e.target !== a) return;
      a.classList.remove("open"); a.innerHTML = ""; a.onclick = null;
      if (wasLive) resumeLive();
      if (bt) buttons[+bt.dataset.i].fn();
    };
  }
  /* Abgehakte Artikel: Einkauf fertig → mit Datum in den Vorrat, als Einkauf speichern */
  function finishShopping() {
    var l = S.activeList(), st = state.store, now = Date.now(), items = [], total = 0;
    l.items.filter(function (i) { return i.done; }).forEach(function (it) {
      var p = S.products[it.b]; if (!p) return;
      var pr = S.effPrice(it.b, st), line = (pr || 0) * it.qty + (p.deposit || 0) * it.qty;
      total += line; items.push({ name: p.name, b: it.b, price: line, qty: it.qty });
      S.pantryAdd(it.b, it.qty, now, "kauf");
    });
    if (!items.length) return;
    state.purchases.push({ id: S.uid(), date: now, store: st, list: l.name, total: total, expected: total, items: items, extra: 0, missing: l.items.length - items.length, noBon: true });
    l.items = l.items.filter(function (i) { return !i.done; });
    S.save(); go("pantry");
    toast("✓ Einkauf gespeichert · " + items.length + " Artikel mit Datum im Vorrat", 4000);
  }
  q.addEventListener("input", suggest);
  q.addEventListener("focus", suggest);
  q.addEventListener("blur", function () { setTimeout(function () { sugg.classList.remove("open"); }, 150); });
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); pickSugg(sugg.querySelector(".sg")); }
    if (e.key === "Escape") { q.value = ""; sugg.classList.remove("open"); q.blur(); }
  });
  sugg.addEventListener("mousedown", function (e) { e.preventDefault(); });
  sugg.addEventListener("click", function (e) { pickSugg(e.target.closest(".sg")); });
  $("newBtn").addEventListener("click", function () { openEdit(null, { name: q.value.trim(), add: true }); q.value = ""; sugg.classList.remove("open"); });

  /* ================= Seiten ================= */
  var lastShop = "home";
  function go(t) { tab = t; if (t !== "pantry") lastShop = t; window.scrollTo(0, 0); render(); }

  /* ---------- Untere Leiste: Bereich Einkaufen | Lager, je Bereich eigene Symbole ---------- */
  function ico(p, sw) { return '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>"; }
  var IC = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5"/><path d="m3.5 12 1.2 1.2L7 11"/><path d="M4 18h2"/>',
    scan: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3"/><path d="M7 8v8M10 8v8M13 8v8M16 8v8"/>',
    stats: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    jar: '<path d="M7 3h10v3H7z"/><path d="M6 6h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6 11h12"/>',
    cart: '<path d="M3 4h2l2.4 11h10.8L21 7H6.2"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
    pin: '<path d="M4 8h16v12H4z"/><path d="M12 2v9"/><path d="m8.5 7.5 3.5 3.5 3.5-3.5"/>',
    pout: '<path d="M4 12h16v9H4z"/><path d="M12 15V3"/><path d="m8.5 6.5 3.5-3.5 3.5 3.5"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    loose: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3"/>'
  };
  function area() { return tab === "pantry" ? "lager" : "einkauf"; }
  function renderTabs() {
    var ar = area(), btn = function (attr, icon, label, on) { return '<button type="button" ' + attr + (on ? ' class="on"' : "") + ">" + ico(IC[icon]) + "<span>" + label + "</span></button>"; };
    var scanOn = function (m) { return live.on && scanMode === m; };
    var left, right;
    if (ar === "lager") {
      left = btn('data-tab="pantry"', "jar", "Vorrat", !live.on) + btn('data-scan="in"', "pin", "Einlagern", scanOn("in"));
      right = btn('data-scan="out"', "pout", "Entnehmen", scanOn("out") || scanOn("waste")) + btn('data-act="loose"', "loose", "Reste", false);
    } else {
      left = btn('data-tab="home"', "home", "Start", tab === "home") + btn('data-tab="list"', "list", "Liste", tab === "list");
      right = btn('data-scan="list"', "scan", "Scannen", scanOn("list")) + btn('data-tab="stats"', "stats", "Statistik", tab === "stats");
    }
    var lager = ar === "lager";
    $("tabs").innerHTML = left + '<button type="button" class="area' + (lager ? " lager" : "") + '" data-toggle="1" aria-label="Bereich: ' + (lager ? "Lager" : "Einkaufen") + ' – tippen zum Wechseln">' +
      '<span class="aico">' + ico(lager ? IC.jar : IC.cart, 2.2) + '</span><span class="alab">' + (lager ? "Lager" : "Einkaufen") + '</span><span class="aswap">⇄</span></button>' + right;
  }
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.toggle) { if (live.on) closeScan(); if (area() === "einkauf") go("pantry"); else go(lastShop); return; }
    if (b.dataset.tab) { if (live.on) closeScan(); go(b.dataset.tab); return; }
    if (b.dataset.scan) { var m = b.dataset.scan; if (live.on && scanMode === m) closeScan(); else if (live.on) { setMode(m); renderTabs(); } else openScan(m); return; }
    if (b.dataset.act === "loose") openLoose(null);
  });
  function render() {
    renderStores();
    renderTabs();
    var v = $("view");
    v.className = "p-" + tab;
    if (tab === "home") v.innerHTML = viewHome();
    else if (tab === "list") v.innerHTML = viewList();
    else if (tab === "items") { v.innerHTML = viewItemsShell(); renderItemRows(); }
    else if (tab === "stats") v.innerHTML = viewStats();
    else if (tab === "pantry") v.innerHTML = viewPantry();
    q.placeholder = tab === "pantry" ? "🔍 Suchen → Vorrat" : "🔍 Suchen → Liste";
    renderSumbar();
  }
  function renderSumbar() {
    if (tab === "pantry") {
      var ks = Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.pantryOf(b).q > 0; });
      var soon = ks.filter(function (b) { var e = S.pantryOf(b).exp; return e && daysTo(e) <= 3; }).length;
      $("sumbar").innerHTML = '<span class="sl"><b>Lager</b> · ' + S.LOCS.map(function (l) { return l.i + " " + ks.filter(function (b) { return S.locOf(b) === l.k; }).length; }).join("  ") +
        (soon ? ' · <span class="warn">' + soon + " laufen bald ab</span>" : "") + '</span><b class="sv">' + ks.length + "</b>";
      return;
    }
    var l = S.activeList(), t = S.totals(l);
    $("sumbar").innerHTML = '<span class="sl"><b>' + esc(l.name) + "</b> · " + t.n + " Artikel" +
      (t.doneN ? ' · <span class="acc">' + t.doneN + " im Wagen</span>" : "") + (t.miss ? ' · <span class="warn">' + t.miss + " ohne Preis</span>" : "") +
      '</span><b class="sv">' + money(t.total) + "</b>";
  }

  $("sumbar").addEventListener("click", function () { if (tab !== "list" && tab !== "pantry") go("list"); });


  function monthKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function cheapest(l) {
    var all = S.storeCompare(l).filter(function (r) { return r.of > 0 && r.have === r.of; }).sort(function (a, b) { return a.sum - b.sum; });
    return all.length >= 2 ? all : null;
  }

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
    h = backupNote() + h + expiryNote() + budgetCard(t.total);
    h += '<div class="quick"><button class="btn primary" data-act="scan">Scannen</button><button class="btn" data-act="new">＋ Neuer Artikel</button><button class="btn" data-act="compare">🧾 Bon</button></div>';
    var deals = l.items.filter(function (it) { return offerTag(it.b); });
    if (deals.length) h += '<div class="note deal" data-go="list">🏷 <b>' + deals.length + " Artikel deiner Liste im Angebot</b>" + (t.saved ? " · bei " + esc(state.store) + " schon " + money(t.saved) + " gespart" : "") + "<br>" +
      deals.slice(0, 4).map(function (it) { return esc(S.products[it.b].name) + " – " + offerTag(it.b).replace(/<[^>]+>/g, "").replace("🏷 ", ""); }).join("<br>") + (deals.length > 4 ? "<br>…" : "") + "</div>";
    var ch = cheapest(l);
    if (ch) h += '<div class="note">💡 Diese Liste ist bei ' + U.badge(ch[0].store, "sm") + " am günstigsten (" + money(ch[0].sum) + "), " +
      U.badge(ch[1].store, "sm") + " wäre " + money(ch[1].sum - ch[0].sum) + " teurer.</div>";
    h += '<div class="tiles">' +
      tile(nArt, "Artikel erfasst", "items", "c-items") + tile(state.lists.length, "Einkaufslisten", "list", "c-list") +
      tile(Object.keys(state.pantry).length, "im Vorrat · " + S.LOCS.map(function (l) { return l.i + " " + Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.locOf(b) === l.k; }).length; }).join(" "), "pantry", "c-pantry") + tile(money(month), "Ausgaben diesen Monat", "stats", "c-home") + "</div>";
    h += '<h3>Einkaufslisten</h3>';
    state.lists.forEach(function (x) {
      var tt = S.totals(x, x.store || state.store);
      h += '<button class="lrow' + (x.id === l.id ? " on" : "") + '" data-list="' + esc(x.id) + '"><span><b>' + esc(x.name) + "</b><small>" + U.badge(x.store || state.store, "xs") + " " + tt.n + " Artikel" + (tt.doneN ? " · " + tt.doneN + " im Wagen" : "") + "</small></span><b>" + money(tt.total) + "</b></button>";
    });
    h += '<button class="lrow add" data-act="newlist">＋ Neue Liste</button>';
    if (!state.budget) h += '<button class="lrow add bud" data-act="budget">💶 Monatsbudget festlegen</button>';
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
    var last = state.lastBackup || 0, ref = last || state.firstUse, now = Date.now();
    if (!Object.keys(S.products).length || now - ref < 7 * 864e5 || (state.backupSnooze || 0) > now) return "";
    return '<div class="note bk">💾 <b>' + (last ? "Letzte Sicherung " + ago(last) : "Noch keine Sicherung gemacht") + ".</b> Deine Daten (Preise, Vorrat, Kundenkarte) liegen nur auf diesem Handy." +
      '<div class="quick" style="margin-top:8px"><button class="btn primary" data-act="backup" type="button">⬇ Jetzt sichern</button><button class="btn" data-act="snooze" type="button">Später</button></div></div>';
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
    var soon = Object.keys(state.pantry).filter(function (b) { var v = S.pantryOf(b); return S.products[b] && v.q && v.exp && daysTo(v.exp) <= 3; })
      .sort(function (a, b) { return S.pantryOf(a).exp < S.pantryOf(b).exp ? -1 : 1; });
    if (!soon.length) return "";
    return '<div class="note exp" data-go="pantry">⚠ <b>' + soon.length + " Artikel " + (soon.length === 1 ? "läuft" : "laufen") + " bald ab</b><br>" +
      soon.slice(0, 5).map(function (b) { var e = S.pantryOf(b).exp; return esc(S.products[b].name) + ' – <span class="' + mhdClass(e) + '">' + mhdText(e) + "</span>"; }).join("<br>") + (soon.length > 5 ? "<br>…" : "") + "</div>";
  }
  function askMhd(b) {
    var p = S.products[b], v = S.pantryOf(b), add = function (n) { return function () { S.setExp(b, iso(Date.now() + n * 864e5)); S.save(); render(); }; };
    ask("MHD für <b>" + esc(p.name) + "</b>" + (v.exp ? "<br><small>bisher: " + mhdText(v.exp) + "</small>" : ""), "Haltbar bis …",
      [{ t: "+3 Tage", fn: add(3) }, { t: "+1 Woche", fn: add(7) }, { t: "+1 Monat", fn: add(30) }, { t: "+3 Monate", fn: add(91) },
       { t: "📅 Datum wählen", primary: true, fn: function () {
         openShell("MHD", '<label class="f">Mindestens haltbar bis</label><input type="date" id="xD" class="datein" value="' + (v.exp || iso(Date.now() + 7 * 864e5)) + '">' +
           '<div class="col"><button class="btn primary" id="xOk" type="button" style="flex:none">Speichern</button></div>');
         ctx = { simple: true };
         $("xOk").onclick = function () { S.setExp(b, $("xD").value); S.save(); closeEdit(); render(); };
       } }].concat(v.exp ? [{ t: "MHD entfernen", fn: function () { S.setExp(b, ""); S.save(); render(); } }] : []));
  }

  /* ---------- Monatsbudget ---------- */
  function monthSpent() { var k = monthKey(Date.now()); return state.purchases.filter(function (p) { return monthKey(p.date) === k; }).reduce(function (a, p) { return a + p.total; }, 0); }
  function budgetCard(listTotal) {
    if (!state.budget) return "";
    var spent = monthSpent(), left = state.budget - spent, pct = spent / state.budget, after = left - (listTotal || 0);
    var cls = pct >= 1 ? "bad" : pct >= 0.8 ? "warn" : "ok";
    var mon = new Date().toLocaleDateString("de-DE", { month: "long" });
    return '<div class="card budget ' + cls + '" data-act="budget"><div class="kv"><span>💶 Budget ' + mon + "</span><b>" + (left >= 0 ? "noch " + money(left) : money(-left) + " drüber") + "</b></div>" +
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
    return '<h3>📈 Preisverlauf</h3><div class="card">' + svg + '<div class="sub" style="margin-top:6px">' + legend + "</div>" +
      (hs.length ? "" : '<div class="hint" style="margin:4px 0 0">Der Verlauf füllt sich, sobald sich ein Preis ändert (beim Bearbeiten oder per Kassenbon).</div>') + "</div>";
  }

  /* ---------- Spracheingabe ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  var NUM = { ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12, zwoelf: 12 };
  if (SR) { $("micBtn").hidden = false; }
  $("micBtn").addEventListener("click", function () {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "de-DE"; rec.interimResults = false; rec.maxAlternatives = 1;
    $("micBtn").classList.add("on"); toast("🎤 Sprich jetzt, z. B. „Milch, zwei Butter und Eier“", 4000);
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
    toast("🎤 " + (tab === "pantry" ? "Vorrat" : "Liste") + ": " + done.join(", ") + (inPan.length ? " · Achtung, noch im Vorrat: " + inPan.join(", ") : ""), 6000);
  }

  function tile(v, k, goTo, col) { return '<button class="tile' + (col ? " " + col : "") + '" data-go="' + goTo + '"><b>' + v + "</b><span>" + k + "</span></button>"; }

  /* ---------- Einkaufsliste ---------- */
  function viewList() {
    var l = S.activeList(), t = S.totals(l), h = '<div class="lhead"><select id="listSel" aria-label="Liste wählen">';
    state.lists.forEach(function (x) { h += '<option value="' + esc(x.id) + '"' + (x.id === l.id ? " selected" : "") + ">" + esc(x.name) + " (" + x.items.length + ")</option>"; });
    h += '<option value="__new">＋ Neue Liste …</option></select><button class="icon" data-act="listmenu" aria-label="Listen-Optionen">⋯</button></div>';
    if (!l.items.length) return h + '<div class="empty">Die Liste ist leer.<br>Oben suchen und antippen, ＋ für einen neuen Artikel<br>oder unten <b>Scannen</b>.</div>';
    var open = l.items.filter(function (i) { return !i.done; }), done = l.items.filter(function (i) { return i.done; });
    var route = state.route[state.store] || {}, known = open.filter(function (i) { return route[i.b] != null; }).length;
    if (known) {
      open = open.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, c) {
        var x = route[a.it.b], y = route[c.it.b];
        if (x == null && y == null) return a.i - c.i; if (x == null) return 1; if (y == null) return -1; return x - y || a.i - c.i;
      }).map(function (o) { return o.it; });
      h += '<div class="muted">↕ sortiert nach deinem Laufweg bei ' + esc(state.store) + "</div>";
    }
    open.concat(done).forEach(function (it, idx) {
      var p = S.products[it.b]; if (!p) return;
      if (idx === open.length && done.length) h += '<div class="sep">Im Wagen</div>';
      var pr = S.effPrice(it.b), reg = S.priceOf(it.b), dep = p.deposit || 0, tag = offerTag(it.b), deal = pr != null && reg != null && pr < reg;
      h += '<div class="row' + (it.done ? " in" : "") + (tag ? " deal" : "") + '" data-b="' + esc(it.b) + '">' +
        '<button class="tick" data-act="done" aria-label="Abhaken">' + (it.done ? "✓" : "") + "</button>" + thumb(p) +
        '<div class="info" data-act="edit"><div class="name">' + esc(p.name) + '</div><div class="sub' + (pr == null ? " warn" : "") + '">' +
        (pr == null ? "Preis fehlt – tippen" : (deal ? '<b class="acc">' + money(pr) + "</b>" : money(pr)) + (it.qty > 1 ? " / Stück" : "")) + (dep ? " · + " + money(dep) + " Pfand" : "") + "</div>" + (tag ? '<div class="sub">' + tag + "</div>" : "") + "</div>" +
        '<div class="right"><div class="price">' + (pr == null ? "–" : money(pr * it.qty + dep * it.qty)) + "</div>" +
        '<div class="qty"><button data-act="minus" aria-label="weniger">−</button><span>' + it.qty + '</span><button data-act="plus" aria-label="mehr">+</button></div></div></div>';
    });
    h += '<div class="card total"><div class="kv"><span>Liste gesamt</span><b class="acc">' + money(t.total) + "</b></div>" +
      (t.dep ? '<div class="kv s"><span>davon Pfand</span><span>' + money(t.dep) + "</span></div>" : "") +
      '<div class="kv s"><span>Im Wagen (' + t.doneN + ")</span><span>" + money(t.doneSum) + "</span></div>" +
      '<div class="kv s"><span>Noch offen</span><span>' + money(t.total - t.doneSum) + "</span></div>" +
      (t.saved ? '<div class="kv s"><span>🏷 Angebote eingerechnet (' + t.offers + ")</span><span class=\"acc\">−" + money(t.saved) + "</span></div>" : "") +
      (t.miss ? '<div class="kv s warn"><span>' + t.miss + " ohne Preis</span><span>nicht eingerechnet</span></div>" : "") + "</div>";
    if (t.doneN) h += '<div class="col"><button class="btn finish" data-act="finish" type="button" style="flex:none">✓ Einkauf fertig – ' + t.doneN + " abgehakte Artikel in den Vorrat</button></div>";
    h += '<div class="offbar"><button class="btn" data-act="offers" type="button"' + (opBusy ? " disabled" : "") + ">🏷 Angebote prüfen</button>" +
      (opInfo ? '<div class="hint">' + esc(opInfo) + "</div>" : '<div class="hint">Sucht in Open Prices nach in Deutschland gemeldeten Angeboten (letzte 3 Wochen, nur Artikel mit Barcode). Eigene Angebote trägst du im Artikel ein.</div>') + "</div>";
    setTimeout(function () { checkOffers(false); }, 300);
    var ch = cheapest(l);
    if (ch) h += '<div class="note">💡 Bei ' + U.badge(ch[0].store, "sm") + " kostet diese Liste " + money(ch[0].sum) + " – " + money(ch[1].sum - ch[0].sum) + " weniger als bei " + U.badge(ch[1].store, "sm") + ".</div>";
    h += '<div class="col"><button class="btn primary" data-act="compare" style="flex:none">🧾 Mit Kassenbon vergleichen</button></div>';
    return h;
  }
  function itemOf(b) { return S.activeList().items.filter(function (x) { return x.b === b; })[0]; }

  /* ---------- Vorrat-Seite (Trocken / Kühlschrank / Gefrierschrank) ---------- */
  var pLoc = "all";
  function locInfo(k) { return S.LOCS.filter(function (l) { return l.k === k; })[0] || S.LOCS[0]; }
  function viewPantry() {
    var keys = Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.pantryOf(b).q > 0; });
    var cnt = { all: keys.length }; S.LOCS.forEach(function (l) { cnt[l.k] = 0; });
    keys.forEach(function (b) { cnt[S.locOf(b)]++; });
    var h = '<div class="locchips"><button type="button" class="lc' + (pLoc === "all" ? " on" : "") + '" data-act="ploc" data-l="all"><span>Alle</span><b>' + cnt.all + "</b></button>" +
      S.LOCS.map(function (l) { return '<button type="button" class="lc l-' + l.k + (pLoc === l.k ? " on" : "") + '" data-act="ploc" data-l="' + l.k + '">' + "<span>" + l.i + " " + l.t.replace("schrank", "") + "</span><b>" + cnt[l.k] + "</b></button>"; }).join("") + "</div>";
    if (!keys.length) return h + '<div class="empty">Noch nichts im Vorrat.<br>Oben einen Artikel suchen, unten <b>Einlagern</b> scannen,<br><b>Reste</b> eintragen oder nach dem Einkauf „Einkauf fertig“ tippen.</div>';
    keys.sort(function (a, b) {
      var x = S.pantryOf(a), y = S.pantryOf(b);
      if (x.exp && y.exp) return x.exp < y.exp ? -1 : x.exp > y.exp ? 1 : x.since - y.since;
      if (x.exp) return -1; if (y.exp) return 1; return x.since - y.since;
    });
    S.LOCS.forEach(function (l) {
      if (pLoc !== "all" && pLoc !== l.k) return;
      var ks = keys.filter(function (b) { return S.locOf(b) === l.k; });
      if (!ks.length) { if (pLoc === l.k) h += '<div class="empty">Nichts im Fach ' + l.t + ".</div>"; return; }
      var pcs = ks.reduce(function (a, b) { return a + S.pantryOf(b).q; }, 0);
      h += '<div class="lochead l-' + l.k + '">' + l.i + " " + l.t + "<small>" + ks.length + " Artikel · " + pcs + " Stück</small></div>";
      ks.forEach(function (b) { h += pantryRow(b, l); });
    });
    var w = wasteSum(monthKey(Date.now()));
    h += '<button class="card wastecard" data-go="stats" type="button"><div class="kv"><span>🗑 Diesen Monat weggeworfen</span><b>' + w.n + " × · " + money(w.v) + "</b></div>" +
      '<div class="sub">' + (w.n + w.used ? Math.round(w.n / (w.n + w.used) * 100) + " % von allem, was aus dem Lager kam · Details in der Statistik" : "Noch nichts ausgelagert. Beim Entnehmen 🗑 tippen, wenn etwas schlecht geworden ist.") + "</div></button>";
    return h;
  }
  function wasteSum(month) {
    var r = { n: 0, v: 0, used: 0 };
    state.outlog.forEach(function (o) { if (month && monthKey(o.d) !== month) return; if (o.w) { r.n += o.q; r.v += o.v * o.q; } else r.used += o.q; });
    return r;
  }
  function wasteStats() {
    var L = state.outlog; if (!L.length) return "";
    var all = wasteSum(), mon = wasteSum(monthKey(Date.now())), h = '<h3>Lager: weggeworfen</h3><div class="tiles">' +
      '<div class="tile"><b>' + mon.n + " × · " + money(mon.v) + "</b><span>diesen Monat</span></div>" +
      '<div class="tile"><b>' + (all.n + all.used ? Math.round(all.n / (all.n + all.used) * 100) : 0) + " %</b><span>Wegwerf-Quote (" + all.n + " von " + (all.n + all.used) + ")</span></div></div>";
    var months = [], d = new Date();
    for (var i = 5; i >= 0; i--) { var m = new Date(d.getFullYear(), d.getMonth() - i, 1), k = monthKey(m), ws = wasteSum(k);
      months.push({ k: m.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), v: ws.v, h2: ws.n }); }
    if (all.n) h += bars(months.map(function (x) { return { k: x.k, v: x.v }; }));
    var by = {}, loc = {};
    L.forEach(function (o) { if (!o.w) return; var t = by[o.n] || (by[o.n] = { n: 0, v: 0 }); t.n += o.q; t.v += o.v * o.q; loc[o.loc || "trocken"] = (loc[o.loc || "trocken"] || 0) + o.q; });
    var top = Object.keys(by).map(function (k) { return { k: k, n: by[k].n, v: by[k].v }; }).sort(function (a, b) { return b.n - a.n || b.v - a.v; }).slice(0, 6);
    if (top.length) h += '<div class="card">' + top.map(function (x) { return '<div class="kv s"><span>' + x.n + "× " + esc(x.k) + "</span><span>" + (x.v ? money(x.v) : "–") + "</span></div>"; }).join("") +
      '<div class="kv s"><span>nach Fach</span><span>' + S.LOCS.map(function (l) { return l.i + " " + (loc[l.k] || 0); }).join("  ") + "</span></div></div>";
    else h += '<div class="hint">Bisher nichts weggeworfen 👍</div>';
    return h;
  }
  function pantryRow(b, l) {
    var p = S.products[b], v = S.pantryOf(b), old = Date.now() - v.since > (l.k === "tk" ? 90 : l.k === "kuehl" ? 7 : 60) * 864e5;
    var lots = v.lots.slice().sort(function (x, y) { return x.d - y.d; }).map(function (x) { return x.q + "× " + U.day(x.d) + (x.src === "kauf" ? " 🛒" : ""); }).join(" · ");
    return '<div class="row l-' + l.k + (old ? " old" : "") + '" data-b="' + esc(b) + '">' +
      '<button class="locbtn" data-act="setloc" aria-label="Lagerort ändern">' + l.i + "</button>" + thumb(p) +
      '<div class="info" data-act="edit"><div class="name">' + esc(p.name) + '</div><div class="since">seit ' + U.day(v.since) + " · " + ago(v.since) + "</div>" +
        (v.exp ? '<button class="mhd ' + mhdClass(v.exp) + '" data-act="mhd" type="button">' + mhdText(v.exp) + "</button>" : '<button class="mhd none" data-act="mhd" type="button">＋ MHD</button>') + (p.loose ? '<div class="sub"><span class="ltag">lose</span>' + (p.note ? " " + esc(p.note) : "") + "</div>" : v.lots.length === 1 && v.lots[0].src === "kauf" ? '<div class="sub">🛒 eingekauft</div>' : "") +
      (v.lots.length > 1 ? '<div class="sub">' + lots + "</div>" : "") +
      (p.fill ? fillBar(p) : "") + "</div>" +
      '<div class="right"><div class="rbtns"><button class="waste" data-act="pwaste" aria-label="Eins weggeworfen">' + ico(IC.trash) + "</button>" + (p.loose ? "" : '<button class="tolist' + (inList(b) ? " on" : "") + '" data-act="tolist" aria-label="Auf die Einkaufsliste">🛒</button>') + "</div>" +
      '<div class="qty"><button data-act="pout" aria-label="eins entnehmen">−</button><span>' + v.q + '</span><button data-act="pin" aria-label="eins dazu">+</button></div></div></div>';
  }
  /* ---------- Füllstand (angebrochene Packung) ---------- */
  function fillBar(p) {
    var lv = p.level == null ? 100 : p.level, cls = lv <= 25 ? " low" : "";
    return '<button class="fill' + cls + '" data-act="fill" type="button" aria-label="Füllstand ' + lv + ' Prozent – tippen zum Ändern">' +
      '<span class="fbar"><i style="width:' + Math.max(4, lv) + '%"></i></span><b>' + (lv >= 100 ? "voll" : lv + " %") + "</b></button>";
  }
  function askFill(b) {
    var p = S.products[b], set = function (lv) { return function () {
      p.level = lv; S.save(); render();
      if (lv <= 25 && !inList(b) && !p.loose) ask("<b>" + esc(p.name) + "</b> ist fast leer.", "Schon mal auf die Einkaufsliste setzen?",
        [{ t: "🛒 Ja, auf die Liste", primary: true, fn: function () { S.addToList(b, 1); S.save(); render(); toast("✓ " + p.name + " → " + S.activeList().name); } }, { t: "Nein", fn: function () {} }]);
    }; };
    ask("Füllstand von <b>" + esc(p.name) + "</b>" + (S.pantryOf(b).q > 1 ? "<br><small>gilt für die angebrochene Packung</small>" : ""), "Wie voll ist es noch?",
      [{ t: "Voll", fn: set(100) }, { t: "¾", fn: set(75) }, { t: "½", fn: set(50) }, { t: "¼ – fast leer", fn: set(25) },
       { t: "Leer – aufgebraucht", primary: true, fn: function () { p.level = 100; pantryOut(b, false); } }]);
  }
  function chooseLoc(b) {
    var p = S.products[b];
    ask("Wo lagert <b>" + esc(p.name) + "</b>?", "Lagerort wählen", S.LOCS.map(function (l) {
      return { t: l.i + " " + l.t, primary: S.locOf(b) === l.k, fn: function () { p.loc = l.k; S.save(); render(); } };
    }));
  }

  /* Lose Ware / Reste: ohne Barcode, ohne Preis, nur im Vorrat (z. B. eingefrorene Reste) */
  function openLoose(b) {
    var p = b ? S.products[b] : null, v = b ? S.pantryOf(b) : null, loc = p ? S.locOf(b) : "tk";
    var d = new Date(v ? v.since : Date.now()), ds = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    openShell(p ? "Lose Ware" : "Lose Ware / Reste",
      '<div class="hint" style="margin-top:0">Für Reste, Selbstgekochtes, Obst vom Markt … – ohne Barcode und Preis, nur im Vorrat. Ist es aufgebraucht, verschwindet es von selbst.</div>' +
      '<label class="f">Was ist es?</label><input type="text" id="lN" value="' + esc(p ? p.name : "") + '" placeholder="z. B. Bolognese-Reste" autocomplete="off">' +
      '<label class="f">Menge / Notiz – optional</label><input type="text" id="lNote" value="' + esc(p && p.note || "") + '" placeholder="z. B. 2 Portionen, 500 g" autocomplete="off">' +
      '<label class="f">Anzahl (Dosen, Beutel, Boxen …)</label><div class="qty big"><button type="button" id="lM">−</button><span id="lQ">' + (v ? v.q : 1) + '</span><button type="button" id="lP">+</button></div>' +
      '<label class="f">Wo?</label><div class="chips2" id="lLoc">' + S.LOCS.map(function (x) {
        return '<button class="chip loc l-' + x.k + (loc === x.k ? " on" : "") + '" type="button" data-loc="' + x.k + '">' + x.i + " " + x.t + "</button>"; }).join("") + "</div>" +
      '<label class="check"><input type="checkbox" id="lFill"' + (p && p.fill ? " checked" : "") + '> Füllstand anzeigen <small>(für angebrochene Packungen: Öl, Mehl, Kaffee …)</small></label>' +
      '<label class="f">Eingelagert / eingefroren am</label><input type="date" id="lD" class="datein" value="' + ds + '">' +
      '<label class="f">Haltbar bis (MHD) – optional</label><input type="date" id="lE" class="datein" value="' + (v && v.exp || "") + '">' +
      '<div class="chips2" id="lEq"><button class="chip" type="button" data-n="3">+3 Tage</button><button class="chip" type="button" data-n="30">+1 Monat</button><button class="chip" type="button" data-n="91">+3 Monate</button><button class="chip" type="button" data-n="182">+6 Monate</button></div>' +
      '<div id="msg"></div><div class="col"><button class="btn primary" id="lSave" type="button" style="flex:none">' + (p ? "Speichern" : "🍲 In den Vorrat") + "</button>" +
      (p ? '<button class="btn danger" id="lDel" type="button">Aus dem Vorrat entfernen</button>' : "") + "</div>");
    ctx = { simple: true };
    var qn = v ? v.q : 1;
    $("lM").onclick = function () { if (qn > 1) $("lQ").textContent = --qn; };
    $("lP").onclick = function () { $("lQ").textContent = ++qn; };
    $("lEq").onclick = function (e) { var x = e.target.closest("[data-n]"); if (!x) return; var base = $("lD").value ? new Date($("lD").value + "T12:00:00").getTime() : Date.now(); $("lE").value = iso(base + +x.dataset.n * 864e5); };
    $("lLoc").onclick = function (e) { var x = e.target.closest("[data-loc]"); if (!x) return; loc = x.dataset.loc;
      Array.prototype.forEach.call(this.querySelectorAll("[data-loc]"), function (y) { y.classList.toggle("on", y === x); }); };
    $("lSave").onclick = function () {
      var name = $("lN").value.trim(); if (!name) { msg("Bitte eintragen, was es ist.", "bad"); $("lN").focus(); return; }
      var dv = $("lD").value, ts = dv ? new Date(dv + "T12:00:00").getTime() : Date.now();
      if (!b) { b = S.newKey(name, "l-"); S.products[b] = { b: b, name: name, prices: {}, loose: true, created: Date.now() }; }
      var q = S.products[b]; q.name = name; q.loc = loc; q.loose = true;
      if ($("lFill").checked) { q.fill = true; if (q.level == null) q.level = 100; } else { delete q.fill; delete q.level; }
      if ($("lNote").value.trim()) q.note = $("lNote").value.trim(); else delete q.note;
      S.pantryClear(b); S.pantryAdd(b, qn, ts, "lose", $("lE").value || "");
      S.save(); closeEdit(); pLoc = "all"; go("pantry");
      toast("🍲 " + name + " → " + locInfo(loc).t + " (" + qn + "×)");
    };
    if ($("lDel")) sure($("lDel"), function () { S.removeProduct(b); S.save(); closeEdit(); render(); toast("Entfernt"); });
    if (!p) setTimeout(function () { var x = $("lN"); if (x) x.focus(); }, 60);
  }

  /* ---------- Alle Artikel ---------- */
  var iFilter = "", iSort = "name";
  function viewItemsShell() {
    return '<div class="ihead"><input type="search" id="iq" placeholder="Artikel filtern …" value="' + esc(iFilter) + '" autocomplete="off">' +
      '<select id="isort" aria-label="Sortierung"><option value="name">A–Z</option><option value="new">Neueste</option><option value="miss">Ohne Preis</option><option value="cheap">Preis ↑</option><option value="dear">Preis ↓</option></select></div>' +
      '<div class="muted" id="icount"></div><div id="irows"></div>';
  }
  function renderItemRows() {
    $("isort").value = iSort;
    var qn = U.norm(iFilter), keys = Object.keys(S.products).filter(function (b) { return !S.products[b].loose; }), miss = 0;
    var rows = keys.map(function (b) { return S.products[b]; }).filter(function (p) {
      if (S.priceOf(p.b) == null) miss++;
      return !qn || U.norm(p.name).indexOf(qn) >= 0 || p.b.indexOf(iFilter) >= 0;
    });
    var pr = function (p) { var v = S.priceOf(p.b); return v == null ? Infinity : v; };
    rows.sort(function (a, b) {
      if (iSort === "miss") return (pr(b) === Infinity) - (pr(a) === Infinity) || a.name.localeCompare(b.name);
      if (iSort === "cheap") return pr(a) - pr(b);
      if (iSort === "dear") return (pr(b) === Infinity ? -1 : pr(b)) - (pr(a) === Infinity ? -1 : pr(a));
      if (iSort === "new") return keys.indexOf(b.b) - keys.indexOf(a.b);
      return a.name.localeCompare(b.name, "de");
    });
    $("icount").textContent = keys.length + " Artikel erfasst · " + miss + " ohne Preis bei " + state.store + (qn ? " · " + rows.length + " gefunden" : "");
    var h = "";
    rows.forEach(function (p) {
      var v = S.effPrice(p.b), others = [], have = inList(p.b), tg = offerTag(p.b);
      Object.keys(p.prices || {}).forEach(function (s) { if (s !== state.store) others.push(U.badge(s, "xs") + " " + money(p.prices[s])); });
      h += '<div class="row" data-b="' + esc(p.b) + '">' + thumb(p) + '<div class="info" data-act="edit"><div class="name">' + esc(p.name) + "</div>" +
        '<div class="sub">' + (others.length ? others.join(" · ") : (p.b.indexOf("r-") === 0 ? "ohne Barcode" : esc(p.b))) + (p.deposit ? " · Pfand " + money(p.deposit) : "") + "</div>" + (tg ? '<div class="sub">' + tg + "</div>" : "") + "</div>" +
        '<div class="price' + (v == null ? " warn" : "") + '">' + (v == null ? "–" : money(v)) + "</div>" +
        '<button class="addb' + (have ? " on" : "") + '" data-act="add" aria-label="Auf die Liste">' + (have ? have + "×" : "＋") + "</button></div>";
    });
    $("irows").innerHTML = h || '<div class="empty">Nichts gefunden.</div>';
  }

  /* ---------- Statistik ---------- */
  function bars(rows, fmtV) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="bar"><span class="bl">' + (r.h || esc(r.k)) + '</span><span class="bt"><i style="width:' + Math.max(2, Math.round(r.v / max * 100)) + "%" + (r.c ? ";background:" + r.c : "") + '"></i></span><b>' + (fmtV || money)(r.v) + "</b></div>";
    }).join("") + "</div>";
  }
  function viewStats() {
    var P = state.purchases, h = budgetCard(0) + wasteStats();
    var l = S.activeList(), cmp = S.storeCompare(l).sort(function (a, b) { return b.have / b.of - a.have / a.of || a.sum - b.sum; });
    if (!P.length) h += '<div class="card"><b>Noch keine Einkäufe gespeichert.</b><div class="sub">Nach dem Einkauf: Liste → 🧾 Mit Kassenbon vergleichen → Einkauf speichern. Dann füllt sich diese Seite.</div></div>';
    else {
      var sum = P.reduce(function (a, p) { return a + p.total; }, 0), diff = P.reduce(function (a, p) { return a + p.total - p.expected; }, 0);
      var now = monthKey(Date.now()), month = P.filter(function (p) { return monthKey(p.date) === now; }).reduce(function (a, p) { return a + p.total; }, 0);
      h += '<div class="tiles">' + tile(money(month), "Diesen Monat", "stats") + tile(money(Math.round(sum / P.length)), "Ø pro Einkauf", "stats") +
        tile(P.length, "Einkäufe", "stats") + '<div class="tile"><b class="' + (diff > 0 ? "bad" : "good") + '">' + U.signed(diff) + "</b><span>Bon vs. Liste gesamt</span></div></div>";
      var months = [], d = new Date(); d.setDate(1);
      for (var i = 5; i >= 0; i--) { var m = new Date(d.getFullYear(), d.getMonth() - i, 1), k = monthKey(m);
        months.push({ k: m.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), v: P.filter(function (p) { return monthKey(p.date) === k; }).reduce(function (a, p) { return a + p.total; }, 0) }); }
      h += "<h3>Ausgaben pro Monat</h3>" + bars(months);
      var bs = {}; P.forEach(function (p) { bs[p.store] = (bs[p.store] || 0) + p.total; });
      h += "<h3>Ausgaben pro Markt</h3>" + bars(Object.keys(bs).map(function (k) { return { k: k, h: U.badge(k, "xs"), c: U.brandOf(k)[0] === "#ffffff" ? U.brandOf(k)[1] : U.brandOf(k)[0], v: bs[k] }; }).sort(function (a, b) { return b.v - a.v; }));
      var top = {};
      P.forEach(function (p) { p.items.forEach(function (it) { var k = it.b && S.products[it.b] ? S.products[it.b].name : it.name; var t = top[k] || (top[k] = { n: 0, c: 0 }); t.n += it.qty || 1; t.c += it.price; }); });
      var tl = Object.keys(top).map(function (k) { return { k: k, n: top[k].n, c: top[k].c }; }).sort(function (a, b) { return b.n - a.n || b.c - a.c; }).slice(0, 8);
      h += "<h3>Am häufigsten gekauft</h3><div class=\"card\">" + tl.map(function (x) { return '<div class="kv s"><span>' + x.n + "× " + esc(x.k) + "</span><span>" + money(x.c) + "</span></div>"; }).join("") + "</div>";
    }
    if (cmp.length) h += '<h3>Liste „' + esc(l.name) + '“ in jedem Markt</h3>' + bars(cmp.map(function (r) { var c = U.brandOf(r.store); return { k: r.store, h: U.badge(r.store, "xs") + (r.have < r.of ? " <small>" + r.have + "/" + r.of + "</small>" : ""), c: c[0] === "#ffffff" ? c[1] : c[0], v: r.sum }; })) +
      '<div class="hint">In Klammern: für so viele Artikel ist dort ein Preis bekannt.</div>';
    var ch = [];
    Object.keys(S.products).forEach(function (b) {
      var hs = S.products[b].hist || [];
      for (var i = hs.length - 1; i > 0; i--) {
        for (var j = i - 1; j >= 0; j--) if (hs[j].s === hs[i].s) { if (hs[j].p !== hs[i].p) ch.push({ n: S.products[b].name, s: hs[i].s, a: hs[j].p, z: hs[i].p, d: hs[i].d }); break; }
      }
    });
    ch.sort(function (a, b) { return b.d - a.d; });
    if (ch.length) h += "<h3>Preisänderungen</h3><div class=\"card\">" + ch.slice(0, 10).map(function (c) {
      return '<div class="kv s"><span>' + esc(c.n) + " <small>" + esc(c.s) + " · " + U.day(c.d) + '</small></span><span class="' + (c.z > c.a ? "bad" : "good") + '">' + money(c.a) + " → " + money(c.z) + "</span></div>";
    }).join("") + "</div>";
    if (P.length) {
      h += "<h3>Letzte Einkäufe</h3>";
      P.slice().reverse().slice(0, 15).forEach(function (p) {
        var dd = p.total - p.expected;
        h += '<div class="lrow"><span><b>' + U.day(p.date) + " " + U.badge(p.store, "sm") + "</b><small>" + p.items.length + " Positionen · Liste " + money(p.expected) + ' · <span class="' + (dd > 0 ? "bad" : "good") + '">' + U.signed(dd) + "</span></small></span><b>" + money(p.total) +
          '</b><button class="del" data-act="delp" data-id="' + esc(p.id) + '" aria-label="Löschen">✕</button></div>';
      });
    }
    return h;
  }

  /* ---------- Klicks in den Seiten ---------- */
  $("view").addEventListener("click", function (e) {
    var a = e.target.closest("[data-act],[data-go],[data-list]"); if (!a) return;
    if (a.dataset.list) { state.active = a.dataset.list; var L = S.activeList(); if (L.store && state.stores.indexOf(L.store) >= 0) state.store = L.store; S.save(); go("list"); return; }
    if (a.dataset.go && !a.dataset.act) { go(a.dataset.go); return; }
    var act = a.dataset.act, row = a.closest(".row"), b = row && row.dataset.b;
    if (act === "scan") { openScan(); return; }
    if (act === "scanin") { openScan("in"); return; }
    if (act === "scanout") { openScan("out"); return; }
    if (act === "finish") { finishShopping(); return; }
    if (act === "pin") { S.pantryAdd(b, 1, Date.now(), "hand"); S.save(); render(); return; }
    if (act === "pout") { pantryOut(b); return; }
    if (act === "pwaste") { pantryOut(b, true); return; }
    if (act === "fill") { askFill(b); return; }
    if (act === "ploc") { pLoc = a.dataset.l; render(); return; }
    if (act === "setloc") { chooseLoc(b); return; }
    if (act === "tolist") { if (inList(b)) toast("Steht schon auf der Liste"); else { S.addToList(b, 1); S.save(); render(); toast("✓ " + S.products[b].name + " → " + S.activeList().name); } return; }
    if (act === "new") { openEdit(null, { add: true }); return; }
    if (act === "compare") { Compare.open(); return; }
    if (act === "offers") { checkOffers(true); return; }
    if (act === "newlist") { askNewList(); return; }
    if (act === "listmenu") { openListMenu(); return; }
    if (act === "edit") { if (S.products[b] && S.products[b].loose) openLoose(b); else openEdit(b); return; }
    if (act === "loose") { openLoose(null); return; }
    if (act === "mhd") { askMhd(b); return; }
    if (act === "backup") { doBackup(); render(); toast("💾 Sicherung heruntergeladen – am besten in die Cloud oder per Mail an dich legen.", 5000); return; }
    if (act === "snooze") { state.backupSnooze = Date.now() + 3 * 864e5; S.save(); render(); return; }
    if (act === "budget") { askBudget(); return; }
    if (act === "add") { addB(b); return; }
    if (act === "delp") {
      if (!a.dataset.sure) { a.dataset.sure = 1; a.textContent = "Löschen?"; a.classList.add("sure"); return; }
      state.purchases = state.purchases.filter(function (p) { return p.id !== a.dataset.id; }); S.save(); render(); return;
    }
    var it = b && itemOf(b); if (!it) return;
    if (act === "done") {
      it.done = !it.done;
      if (it.done) { var Ld = S.activeList(), before = Ld.items.filter(function (x) { return x.done && x !== it; }).length; S.learnRoute(state.store, b, before / Math.max(1, Ld.items.length - 1)); }
    }
    if (act === "plus") it.qty++;
    if (act === "minus") { it.qty--; if (it.qty <= 0) { var l = S.activeList(); l.items.splice(l.items.indexOf(it), 1); toast(S.products[b].name + " von der Liste genommen"); } }
    S.save(); render();
  });
  $("view").addEventListener("change", function (e) {
    if (e.target.id === "listSel") {
      if (e.target.value === "__new") { e.target.value = state.active; askNewList(); return; }
      state.active = e.target.value; var L = S.activeList(); if (L.store && state.stores.indexOf(L.store) >= 0) state.store = L.store; S.save(); render();
    }
    if (e.target.id === "isort") { iSort = e.target.value; renderItemRows(); }
  });
  $("view").addEventListener("input", function (e) { if (e.target.id === "iq") { iFilter = e.target.value.trim(); renderItemRows(); } });

  function askNewList() {
    openSimple("Neue Einkaufsliste", "Name der Liste", "z. B. Wocheneinkauf", "", "Anlegen", function (n) {
      S.newList(n || "Einkaufsliste"); S.save(); closeEdit(); go("list");
    });
  }
  function openListMenu() {
    var l = S.activeList();
    openShell("Liste", '<label class="f">Name</label><input type="text" id="fX" value="' + esc(l.name) + '" autocomplete="off">' +
      '<div class="col"><button class="btn primary" id="lRen" type="button" style="flex:none">Speichern</button>' +
      '<button class="btn" id="lDone" type="button">Abgehakte Artikel von der Liste nehmen</button>' +
      '<button class="btn" id="lUn" type="button">Alle Haken entfernen</button>' +
      '<button class="btn" id="lNew" type="button">＋ Neue Liste</button>' +
      '<button class="btn danger" id="lClr" type="button">Liste leeren</button>' +
      '<button class="btn danger" id="lDel" type="button">Liste löschen</button></div><div id="msg"></div>');
    ctx = { simple: true };
    $("lRen").onclick = function () { l.name = $("fX").value.trim() || l.name; S.save(); closeEdit(); render(); };
    $("lDone").onclick = function () { l.items = l.items.filter(function (i) { return !i.done; }); S.save(); closeEdit(); render(); };
    $("lUn").onclick = function () { l.items.forEach(function (i) { i.done = false; }); S.save(); closeEdit(); render(); };
    $("lNew").onclick = function () { closeEdit(); askNewList(); };
    sure($("lClr"), function () { l.items = []; S.save(); closeEdit(); render(); });
    sure($("lDel"), function () { S.removeList(l.id); S.save(); closeEdit(); go("home"); toast("Liste gelöscht"); });
  }
  function sure(btn, fn) { btn.onclick = function () { if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent += " – wirklich? Nochmal tippen"; return; } fn(); }; }

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
    pv.innerHTML = src ? '<img alt="" src="' + esc(src) + '" onerror="this.remove()">' : "📦";
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
      '<label class="btn" for="fCam">📷 Foto aufnehmen</label><label class="btn" for="fImg">🖼 Aus Galerie</label>' +
      '<button class="btn danger" id="fImgDel" type="button" style="display:none">Foto entfernen</button></div></div>' +
      '<input type="file" id="fCam" class="hide" accept="image/*" capture="environment"><input type="file" id="fImg" class="hide" accept="image/*">' +
      '<label class="f">Name</label><input type="text" id="fN" value="' + esc(p ? p.name : opts.name || "") + '" placeholder="z. B. Vollmilch 1 l" autocomplete="off">' +
      '<label class="f">Preis bei ' + esc(state.store) + ' (€)</label><input type="text" id="fP" inputmode="decimal" enterkeyhint="done" value="' + U.cents2str(pr) + '" placeholder="0,00" autocomplete="off">' +
      (others ? '<div class="hint">Bekannt: ' + others.replace(/ · $/, "") + "</div>" : "") +
      '<label class="f">Pfand pro Stück (€) – optional</label><input type="text" id="fD" inputmode="decimal" value="' + (p && p.deposit ? U.cents2str(p.deposit) : "") + '" placeholder="kein Pfand" autocomplete="off">' +
      '<div class="chips2"><button class="chip" type="button" data-d="">kein</button><button class="chip" type="button" data-d="0,08">0,08</button><button class="chip" type="button" data-d="0,15">0,15</button><button class="chip" type="button" data-d="0,25">0,25</button></div>' +
      '<label class="f">Lagerort im Vorrat</label><div class="chips2" id="fLoc">' + S.LOCS.map(function (x) {
        var cur = p ? S.locOf(b) : S.guessLoc(opts.name || "");
        return '<button class="chip loc l-' + x.k + (cur === x.k ? " on" : "") + '" type="button" data-loc="' + x.k + '">' + x.i + " " + x.t + "</button>"; }).join("") + "</div>" +
      '<label class="check"><input type="checkbox" id="fFill"' + (p && p.fill ? " checked" : "") + '> Füllstand anzeigen <small>(für angebrochene Packungen: Öl, Mehl, Kaffee …)</small></label>' +
      (real ? '<label class="f">Barcode</label><input type="text" id="fB" value="' + esc(b) + '" readonly>'
            : '<label class="f">Barcode – optional</label><input type="text" id="fB" inputmode="numeric" placeholder="Nummer unter dem Strichcode" autocomplete="off">') +
      (opts.target === "pantry"
        ? '<label class="check"><input type="checkbox" id="fL"' + (addDefault ? " checked" : "") + "> In den Vorrat (+1, heute)" + (p && S.pantryOf(b).q ? " – schon " + S.pantryOf(b).q + "× im Haus" : "") + "</label>"
        : '<label class="check"><input type="checkbox" id="fL"' + (addDefault ? " checked" : "") + "> Auf die Liste „" + esc(l.name) + "“" + (have ? " (steht schon " + have + "× drauf → +1)" : "") + "</label>") +
      (p && S.pantryOf(b).q && opts.target !== "pantry" ? '<div class="hint pan">🥫 Im Vorrat: ' + S.pantryOf(b).q + "× seit " + U.day(S.pantryOf(b).since) + "</div>" : "") +
      (p && !p.loose ? priceChart(p) : "") +
      (p ? '<h3>🏷 Angebote</h3><div id="offs"></div>' +
        '<div class="offadd"><select id="oS" aria-label="Markt">' + state.stores.map(function (x) { return '<option' + (x === state.store ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>" +
        '<input type="text" id="oP" inputmode="decimal" placeholder="Preis" autocomplete="off"><input type="date" id="oU" value="' + plusDays(6) + '" aria-label="gültig bis"></div>' +
        '<div class="col" style="margin-top:8px"><button class="btn" id="oAdd" type="button">＋ Angebot speichern</button></div>' +
        '<div class="links"><a class="btn" target="_blank" rel="noopener" href="https://www.marktguru.de/search/' + encodeURIComponent(p.name) + '">🔎 Marktguru</a>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://www.kaufda.de/Angebote/' + encodeURIComponent(p.name) + '">🔎 kaufDA</a></div>' : "") +
      '<div id="msg"></div>' +
      '<div class="col"><button class="btn primary" id="eSave" type="button" style="flex:none">Speichern</button>' +
      (real ? '<button class="btn" id="eFind" type="button">🔎 Online nach Name suchen</button>' : "") +
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
    var ms = state.stores.map(function (s, i) { return '<div class="kv mrow"><span>' + U.badge(s) + '</span><span class="mbtns"><button class="chip' + (state.cards[s] ? " on" : "") + '" data-card="' + i + '" type="button">' + (state.cards[s] ? "▣ Karte" : "＋ Karte") + '</button><button class="chip" data-del="' + i + '" type="button">entfernen</button></span></div>'; }).join("");
    openShell("Menü",
      "<h3>Märkte</h3><div class=\"card\">" + ms + '</div><div class="col" style="margin-top:8px"><button class="btn" id="mAdd" type="button">＋ Markt hinzufügen</button></div>' +
      '<h3>Budget</h3><div class="col" style="margin-top:0"><button class="btn" id="mBud" type="button">💶 ' + (state.budget ? "Monatsbudget: " + money(state.budget) + " – ändern" : "Monatsbudget festlegen") + "</button></div>" +
      '<h3>Sicherung</h3><div class="hint" style="margin-top:0">Deine Daten liegen nur auf diesem Gerät. ' + (state.lastBackup ? "Letzte Sicherung: " + U.day(state.lastBackup) + "." : "Noch keine Sicherung gemacht.") + "</div>" +
      '<div class="col">' +
      '<button class="btn primary" id="mSave" type="button" style="flex:none">⬇ Sicherung speichern</button>' +
      '<button class="btn" id="mCopy" type="button">📋 Sicherung kopieren</button>' +
      '<label class="btn" for="mFile">⬆ Sicherung aus Datei laden</label><input type="file" id="mFile" class="hide" accept=".json,application/json"></div>' +
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
      '<div class="col"><label class="btn primary" for="kPic" style="flex:none">🖼 Screenshot der Karte wählen</label>' +
      '<label class="btn" for="kCam">📷 Karte abfotografieren</label></div>' +
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
      toast((e && e.message || "Kamera nicht verfügbar") + " Nutze „📸 Foto“ oder „123“.", 7000);
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

  /* ---------- für compare.js ---------- */
  window.App = { openShell: openShell, closeEdit: closeEdit, msg: msg, render: render, go: go, sure: sure, speech: handleSpeech };

  /* ---------- Start ---------- */
  S.onStatus(setSync);
  S.load().then(function () {
    var seeded = S.applySeeds();
    render();
    if (seeded) toast("Lidl: Artikel von deinen Kassenbons eingetragen", 4000);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  });
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
