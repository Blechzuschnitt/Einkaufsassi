/* Daten + Speicherung (IndexedDB, Rückfall localStorage). Alles bleibt auf dem Gerät. */
var Store = (function () {
  var KEY = "data", LS = "einkauf-v2";
  var state = { stores: DEFAULT_STORES.slice(), store: "Rewe", listed: {}, cart: {}, seeded: [] };
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

  function apply(d) {
    if (!d) return;
    if (d.state) for (var k in d.state) state[k] = d.state[k];
    if (d.products) products = d.products;
    if (!state.seeded) state.seeded = [];
  }

  function load() {
    return idbGet(KEY).then(function (d) { apply(d); }).catch(function () {
      mode = "ls";
      try { apply(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) {}
    });
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
     .catch(function (e) {
       saving = false;
       if (mode === "idb") { mode = "ls"; dirty = true; flush(); return; }
       emit("error");
     });
  }

  /* ----- Helfer ----- */
  function listedFor(st) { st = st || state.store; return state.listed[st] || (state.listed[st] = []); }
  function cartFor(st) { st = st || state.store; return state.cart[st] || (state.cart[st] = {}); }
  function priceOf(b, st) { var p = products[b]; return p && p.prices ? p.prices[st || state.store] : undefined; }
  function ensureListed(b, st) { var l = listedFor(st); if (l.indexOf(b) < 0) l.push(b); }
  function slug(n) {
    return String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  }

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
    Object.keys(state.listed).forEach(function (st) {
      var out = [];
      state.listed[st].forEach(function (x) { x = x === old ? nb : x; if (out.indexOf(x) < 0) out.push(x); });
      state.listed[st] = out;
    });
    Object.keys(state.cart).forEach(function (st) {
      var c = state.cart[st];
      if (c[old] != null) { c[nb] = (c[nb] || 0) + c[old]; delete c[old]; }
    });
    return p;
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
        ensureListed(key, sd.store);
      });
      state.seeded.push(sd.id); changed = true;
    });
    if (changed) save();
    return changed;
  }

  /* ----- Sicherung ----- */
  function exportJSON() { return JSON.stringify({ app: "einkauf", version: 2, state: state, products: products }, null, 1); }
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
    Object.keys(s.listed || {}).forEach(function (st) {
      (s.listed[st] || []).forEach(function (b) { if (products[b]) ensureListed(b, st); });
    });
    (s.seeded || []).forEach(function (id) { if (state.seeded.indexOf(id) < 0) state.seeded.push(id); });
    save();
    return n;
  }

  return {
    get state() { return state; }, get products() { return products; },
    load: load, save: save, onStatus: onStatus,
    listedFor: listedFor, cartFor: cartFor, priceOf: priceOf, ensureListed: ensureListed,
    slug: slug, rekey: rekey, applySeeds: applySeeds, exportJSON: exportJSON, importJSON: importJSON
  };
})();
