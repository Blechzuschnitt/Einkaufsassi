/* Offline-Fähigkeit: App-Dateien werden beim ersten Besuch gespeichert (im Laden oft kein Netz). */
var VERSION = "einkauf-v33";
var ASSETS = ["./", "index.html", "style.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "js/data.js", "js/ui.js", "js/store.js", "js/lookup.js", "js/scanner.js", "js/compare.js", "js/app/00-icons.js", "js/app/01-core.js", "js/app/02-header.js", "js/app/03-nav.js", "js/app/04-home.js", "js/app/05-list.js", "js/app/06-pantry.js", "js/app/07-items.js", "js/app/08-stats.js", "js/app/09-clicks.js", "js/app/10-forms.js", "js/app/11-cards.js", "js/app/12-scan.js", "js/app/14-shop.js", "js/app/15-extras.js", "js/app/16-notify.js", "js/app/17-cloud.js", "js/app/18-launch.js", "js/app/13-main.js", "js/zxing.min.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // Online-Suche geht direkt ins Netz
  e.respondWith(
    fetch(e.request.mode === "navigate" ? e.request.url : e.request, { cache: "no-cache" }).then(function (r) {   // erst Netz (aktuell, am HTTP-Cache vorbei) …
      var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match("index.html"); }); })   // … sonst Speicher
  );
});

/* ---- MHD-Erinnerung im Hintergrund (Periodic Background Sync, Chrome/Android) ---- */
function readData() {
  return new Promise(function (res) {
    var r = indexedDB.open("einkauf", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
    r.onsuccess = function () { try { var q = r.result.transaction("kv").objectStore("kv").get("data"); q.onsuccess = function () { res({ db: r.result, d: q.result }); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } };
    r.onerror = function () { res(null); };
  });
}
function iso(t) { var d = new Date(t); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function checkMhd() {
  return readData().then(function (x) {
    if (!x || !x.d || !x.d.state || !x.d.state.notify) return;
    var st = x.d.state, P = x.d.products || {}, today = iso(Date.now()), lim = iso(Date.now() + 864e5), soon = [];
    Object.keys(st.pantry || {}).forEach(function (b) {
      var exp = ""; (st.pantry[b] || []).forEach(function (l) { if (l.exp && (!exp || l.exp < exp)) exp = l.exp; });
      if (exp && exp <= lim && P[b]) soon.push(P[b].name + (exp < today ? " (abgelaufen)" : exp === today ? " (heute)" : " (morgen)"));
    });
    if (!soon.length || st.notified === today) return;
    st.notified = today;
    try { x.db.transaction("kv", "readwrite").objectStore("kv").put(x.d, "data"); } catch (e) {}
    return self.registration.showNotification(soon.length === 1 ? "Läuft bald ab" : soon.length + " Artikel laufen bald ab",
      { body: soon.slice(0, 4).join("\n"), icon: "icon-192.png", tag: "mhd", data: { url: "./?tab=pantry" } });
  });
}
self.addEventListener("periodicsync", function (e) { if (e.tag === "mhd") e.waitUntil(checkMhd()); });
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ("focus" in cs[i]) { cs[i].navigate(url); return cs[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
