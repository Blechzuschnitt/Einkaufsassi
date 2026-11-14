/* Daten + Speicherung (IndexedDB, Rückfall localStorage). Alles bleibt auf dem Gerät.
   products: { key: {b, name, prices:{Markt:Cent}, deposit, img, imgUrl, hist:[{s,p,d}]} }
   state.lists: [{id, name, store, created, items:[{b, qty, done}]}]
   state.purchases: [{id, date, store, list, total, expected, items:[{name,b,price,qty}], extra, missing}] */
var Store = (function () {
  var KEY = "data", LS = "einkauf-v2";
  var state = { v: 3, stores: DEFAULT_STORES.slice(), store: "Lidl", lists: [], active: "", purchases: [], seeded: [] };
  var products = {};
  var listeners = [], saveTimer = null, saving = false, dirty = false, mode = "idb";

  /* ----- IndexedDB ----- */
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("kein IndexedDB"));
      var r = indexedDB.open("einkauf", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(k) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function idbSet(k, v) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(v, k);
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function apply(d) {
    if (!d) return;
    if (d.state) for (var k in d.state) state[k] = d.state[k];
    if (d.products) products = d.products;
  }

  /* Alte Version (ein „Wagen“ pro Markt) → Einkaufslisten */
  function migrate() {
    if (!state.seeded) state.seeded = [];
    if (!state.purchases) state.purchases = [];
    if (!state.lists) state.lists = [];
    if (!state.cards) state.cards = {};
    if (!state.pantry) state.pantry = {};   // Vorrat: {key: [{q, d, src}]} – Einlagerungen mit Datum   // Kundenkarten: {Markt: {code, d}} – nur auf diesem Gerät
    if (state.v !== 3) {
      var cart = state.cart || {};
      Object.keys(cart).forEach(function (st) {
        var items = Object.keys(cart[st]).filter(function (b) { return products[b] && cart[st][b] > 0; })
          .map(function (b) { return { b: b, qty: cart[st][b], done: false }; });
        if (items.length) state.lists.push({ id: uid(), name: "Einkauf " + st, store: st, created: Date.now(), items: items });
      });
      delete state.cart; delete state.listed; state.v = 3;
    }
    if (!state.lists.length) state.lists.push({ id: uid(), name: "Einkaufsliste", store: state.store, created: Date.now(), items: [] });
    if (!listById(state.active)) state.active = state.lists[0].id;
    if (state.stores.indexOf(state.store) < 0) state.store = state.stores[0];
  }

  function load() {
    return idbGet(KEY).then(function (d) { apply(d); }).catch(function () {
      mode = "ls";
      try { apply(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) {}
    }).then(migrate);
  }

  function emit(s) { listeners.forEach(function (f) { f(s); }); }
  function onStatus(f) { listeners.push(f); }

  function save() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 150);
  }
  function flush() {
    if (saving) { saveTimer = setTimeout(flush, 100); return; }
    if (!dirty) return;
    dirty = false; saving = true;
    var blob = JSON.parse(JSON.stringify({ state: state, products: products }));
    var p = mode === "idb" ? idbSet(KEY, blob) : new Promise(function (res, rej) {
      try { localStorage.setItem(LS, JSON.stringify(blob)); res(); } catch (e) { rej(e); }
    });
    p.then(function () { saving = false; emit("ok"); })
     .catch(function () {
       saving = false;
       if (mode === "idb") { mode = "ls"; dirty = true; flush(); return; }
       emit("error");
     });
  }

  /* ----- Artikel ----- */
  function priceOf(b, st) { var p = products[b]; return p && p.prices ? p.prices[st || state.store] : undefined; }
  function setPrice(b, st, c) {
    var p = products[b]; if (!p) return;
    if (!p.prices) p.prices = {};
    if (p.prices[st] === c) return;
    p.prices[st] = c;
    (p.hist || (p.hist = [])).push({ s: st, p: c, d: Date.now() });
    if (p.hist.length > 30) p.hist.shift();
  }
  /* ----- Angebote: p.offers = [{s:Markt, p:Cent, until:"JJJJ-MM-TT"}] ; p.op = {t, hits} (Open Prices) ----- */
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function offersOf(b) {
    var p = products[b]; if (!p || !p.offers) return [];
    var t = today(), act = p.offers.filter(function (o) { return o.until >= t; });
    if (act.length !== p.offers.length) p.offers = act;
    return act;
  }
  function offerAt(b, st) { st = st || state.store; return offersOf(b).filter(function (o) { return o.s === st; }).sort(function (a, c) { return a.p - c.p; })[0]; }
  /* Preis, der wirklich gilt: Angebot, wenn es günstiger ist, sonst Normalpreis */
  function effPrice(b, st) {
    var r = priceOf(b, st), o = offerAt(b, st);
    if (o && (r == null || o.p < r)) return o.p;
    return r;
  }
  function addOffer(b, st, c, until) {
    var p = products[b]; if (!p) return;
    p.offers = offersOf(b).filter(function (o) { return o.s !== st; });
    p.offers.push({ s: st, p: c, until: until });
  }
  function removeOffer(b, i) { var o = offersOf(b); o.splice(i, 1); products[b].offers = o; }
  /* „REWE Markt GmbH“ → „Rewe“, wenn es den Markt in der App gibt */
  function matchStore(brand) {
    var n = String(brand || "").toLowerCase();
    return state.stores.filter(function (s) { var k = s.toLowerCase(); return n.indexOf(k) >= 0 || k.indexOf(n) >= 0; })[0] || "";
  }

  function slug(n) {
    return String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  }
  function newKey(name) { var base = "r-" + slug(name), k = base, i = 2; while (products[k]) k = base + "-" + i++; return k; }
  function eachListItem(fn) { state.lists.forEach(function (l) { l.items.forEach(function (it) { fn(it, l); }); }); }

  /* Artikel ohne Barcode ("r-…") bekommt später einen echten Barcode */
  function rekey(old, nb, p) {
    var q = products[nb];
    if (q) {
      q.prices = Object.assign(q.prices || {}, p.prices || {});
      if (p.img && !q.img) q.img = p.img;
      if (p.deposit && !q.deposit) q.deposit = p.deposit;
      if (!q.name) q.name = p.name;
      p = q;
    } else { p.b = nb; products[nb] = p; }
    delete products[old];
    if (state.pantry[old]) { state.pantry[nb] = (state.pantry[nb] || []).concat(state.pantry[old]); delete state.pantry[old]; }
    state.lists.forEach(function (l) {
      var out = [];
      l.items.forEach(function (it) {
        if (it.b === old) it.b = nb;
        var dup = out.filter(function (o) { return o.b === it.b; })[0];
        if (dup) dup.qty += it.qty; else out.push(it);
      });
      l.items = out;
    });
    return p;
  }
  function removeProduct(b) {
    delete products[b]; delete state.pantry[b];
    state.lists.forEach(function (l) { l.items = l.items.filter(function (it) { return it.b !== b; }); });
  }

  /* ----- Lagerort: trocken | kuehl | tk ----- */
  var LOCS = [{ k: "trocken", t: "Trocken", i: "🥫" }, { k: "kuehl", t: "Kühlschrank", i: "🥛" }, { k: "tk", t: "Gefrierschrank", i: "🧊" }];
  var TK = /(tiefk[uü]hl|\btk\b|gefrier|\beis\b|eiscreme|pizza|pommes|fischst[aä]bchen|frozen)/i;
  var KUEHL = /(milch(?!schoko)|joghurt|quark|k[aä]se|butter|sahne|schmand|wurst|salami|schinken|fleisch|h[aä]hn|geschnetzel|cordon|antipasti|\beier\b|tofu|hack|lachs|aufschnitt|s[oö]derg[aå]rden|remoulade|feinkost|salat\b)/i;
  function guessLoc(name) { return TK.test(name || "") ? "tk" : KUEHL.test(name || "") ? "kuehl" : "trocken"; }
  function locOf(b) { var p = products[b]; return p && p.loc || guessLoc(p && p.name); }

  /* ----- Vorrat (zu Hause) ----- */
  function pantryOf(b) {
    var lots = state.pantry[b] || [], q = 0, since = 0;
    lots.forEach(function (l) { q += l.q; if (!since || l.d < since) since = l.d; });
    return { q: q, since: since, lots: lots };
  }
  function pantryAdd(b, q, d, src) {
    if (!products[b] || !(q > 0)) return;
    (state.pantry[b] || (state.pantry[b] = [])).push({ q: q, d: d || Date.now(), src: src || "hand" });
  }
  /* Älteste zuerst verbrauchen; gibt den Rest im Vorrat zurück */
  function pantryTake(b, q) {
    var lots = (state.pantry[b] || []).sort(function (x, y) { return x.d - y.d; });
    while (q > 0 && lots.length) { var t = Math.min(q, lots[0].q); lots[0].q -= t; q -= t; if (!lots[0].q) lots.shift(); }
    if (!lots.length) delete state.pantry[b];
    return pantryOf(b).q;
  }
  function pantryClear(b) { delete state.pantry[b]; }

  /* ----- Listen ----- */
  function listById(id) { return state.lists.filter(function (l) { return l.id === id; })[0]; }
  function activeList() { return listById(state.active) || state.lists[0]; }
  function newList(name) {
    var l = { id: uid(), name: name || "Einkaufsliste", store: state.store, created: Date.now(), items: [] };
    state.lists.push(l); state.active = l.id; return l;
  }
  function removeList(id) {
    state.lists = state.lists.filter(function (l) { return l.id !== id; });
    if (!state.lists.length) newList("Einkaufsliste");
    if (!listById(state.active)) state.active = state.lists[0].id;
  }
  function addToList(b, n, l) {
    l = l || activeList();
    var it = l.items.filter(function (x) { return x.b === b; })[0];
    if (it) { it.qty += n || 1; it.done = false; } else { it = { b: b, qty: n || 1, done: false }; l.items.push(it); }
    return it;
  }
  /* Summen einer Liste für einen Markt */
  function totals(l, st) {
    l = l || activeList(); st = st || l.store || state.store;
    var t = { n: 0, sum: 0, dep: 0, miss: 0, doneN: 0, doneSum: 0, rows: l.items.length, offers: 0, saved: 0 };
    l.items.forEach(function (it) {
      var p = products[it.b]; if (!p) return;
      var pr = effPrice(it.b, st), dep = (p.deposit || 0) * it.qty, reg = priceOf(it.b, st);
      if (pr != null && reg != null && pr < reg) { t.offers++; t.saved += (reg - pr) * it.qty; }
      t.n += it.qty; t.dep += dep;
      if (pr == null) t.miss++; else t.sum += pr * it.qty;
      if (it.done) { t.doneN += it.qty; t.doneSum += (pr || 0) * it.qty + dep; }
    });
    t.total = t.sum + t.dep;
    return t;
  }
  /* Was würde die Liste in jedem Markt kosten? */
  function storeCompare(l) {
    l = l || activeList();
    return state.stores.map(function (st) {
      var r = { store: st, sum: 0, have: 0, of: l.items.length };
      l.items.forEach(function (it) { var pr = effPrice(it.b, st); if (pr != null) { r.have++; r.sum += pr * it.qty + ((products[it.b] || {}).deposit || 0) * it.qty; } });
      return r;
    }).filter(function (r) { return r.have > 0; });
  }

  /* Einmalige Startdaten */
  function applySeeds() {
    var changed = false;
    SEEDS.forEach(function (sd) {
      if (state.seeded.indexOf(sd.id) >= 0) return;
      if (state.stores.indexOf(sd.store) < 0) state.stores.push(sd.store);
      sd.items.forEach(function (it) {
        var key = "r-" + slug(it[0]), p = products[key];
        if (!p) p = products[key] = { b: key, name: it[0], prices: {} };
        if (!p.prices) p.prices = {};
        if (p.prices[sd.store] == null) p.prices[sd.store] = it[1];
        if (it[2] && p.deposit == null) p.deposit = it[2];
      });
      state.seeded.push(sd.id); changed = true;
    });
    if (changed) save();
    return changed;
  }

  /* ----- Sicherung ----- */
  function exportJSON() { return JSON.stringify({ app: "einkauf", version: 3, state: state, products: products }, null, 1); }
  function importJSON(text) {
    var d = JSON.parse(text);
    if (!d || typeof d !== "object" || !d.products) throw new Error("Keine gültige Sicherung");
    var n = 0;
    Object.keys(d.products).forEach(function (k) {
      var ip = d.products[k]; if (!ip || !ip.name) return;
      var p = products[k];
      if (!p) { products[k] = ip; n++; return; }
      p.prices = Object.assign({}, ip.prices || {}, p.prices || {});
      if (!p.img && ip.img) p.img = ip.img;
      if (p.deposit == null && ip.deposit) p.deposit = ip.deposit;
    });
    var s = d.state || {};
    (s.stores || []).forEach(function (st) { if (state.stores.indexOf(st) < 0) state.stores.push(st); });
    (s.lists || []).forEach(function (l) { if (!listById(l.id)) state.lists.push(l); });
    (s.purchases || []).forEach(function (pu) { if (!state.purchases.some(function (x) { return x.id === pu.id; })) state.purchases.push(pu); });
    Object.keys(s.pantry || {}).forEach(function (b) { if (!state.pantry[b] && products[b]) state.pantry[b] = s.pantry[b]; });
    Object.keys(s.cards || {}).forEach(function (st) { if (!state.cards[st]) state.cards[st] = s.cards[st]; });
    (s.seeded || []).forEach(function (id) { if (state.seeded.indexOf(id) < 0) state.seeded.push(id); });
    state.purchases.sort(function (a, b) { return a.date - b.date; });
    save();
    return n;
  }

  return {
    get state() { return state; }, get products() { return products; },
    load: load, save: save, onStatus: onStatus, uid: uid,
    priceOf: priceOf, effPrice: effPrice, setPrice: setPrice, today: today,
    offersOf: offersOf, offerAt: offerAt, addOffer: addOffer, removeOffer: removeOffer, matchStore: matchStore, newKey: newKey, rekey: rekey, removeProduct: removeProduct, eachListItem: eachListItem,
    listById: listById, activeList: activeList, newList: newList, removeList: removeList, addToList: addToList,
    LOCS: LOCS, locOf: locOf, guessLoc: guessLoc,
    pantryOf: pantryOf, pantryAdd: pantryAdd, pantryTake: pantryTake, pantryClear: pantryClear,
    totals: totals, storeCompare: storeCompare,
    applySeeds: applySeeds, exportJSON: exportJSON, importJSON: importJSON
  };
})();
