/* Offline-Fähigkeit: App-Dateien werden beim ersten Besuch gespeichert (im Laden oft kein Netz). */
var VERSION = "einkauf-v21";
var ASSETS = ["./", "index.html", "style.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "js/data.js", "js/ui.js", "js/store.js", "js/lookup.js", "js/scanner.js", "js/compare.js", "js/app.js", "js/zxing.min.js"];

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
