/* Startauswahl beim Öffnen der App: Einkaufen, Einkaufsmodus oder Lager */
"use strict";

var LAUNCH = [
  { k: "home", t: "Einkaufen", i: "cart", sub: function () { var t = S.totals(S.activeList()); return "Listen, Preise, Statistik · " + money(t.total); } },
  { k: "shop", t: "Einkaufsmodus", i: "list", sub: function () { var l = S.activeList(), n = l.items.filter(function (i) { return !i.done; }).length; return n ? esc(l.name) + " · " + n + " offen" : "Die Liste ist noch leer"; } },
  { k: "pantry", t: "Lager", i: "jar", sub: function () {
    var ks = Object.keys(state.pantry).filter(function (b) { return S.products[b] && S.pantryOf(b).q > 0; }), soon = soonKeys(3).length;
    return ks.length + " Artikel im Vorrat" + (soon ? " · " + soon + " laufen bald ab" : ""); } }
];
function launchTo(k) {
  if (k === "shop") { if (S.activeList().items.some(function (i) { return !i.done; })) enterShop(); else { go("list"); toast("Die Liste ist leer – erst Artikel hinzufügen."); } return; }
  go(k === "pantry" ? "pantry" : "home");
}
function showLaunch() {
  var d = document.createElement("div"); d.id = "launch"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Wohin möchtest du?");
  d.innerHTML = '<div class="lwrap"><div class="ltitle">Einkauf</div><div class="lq">Wohin möchtest du?</div>' +
    LAUNCH.map(function (x) { return '<button type="button" class="lopt" data-k="' + x.k + '"><span class="li">' + ico(IC[x.i], 2) + '</span><span class="lt"><b>' + x.t + "</b><small>" + x.sub() + "</small></span></button>"; }).join("") +
    '<label class="check lremember"><input type="checkbox" id="lRem"> Merken und beim nächsten Mal direkt dorthin</label></div>';
  document.body.appendChild(d);
  d.onclick = function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    if ($("lRem").checked) { state.launch = b.dataset.k; S.save(); toast("Startet ab jetzt direkt – ändern im Menü unter „Beim Öffnen“.", 4000); }
    d.remove(); launchTo(b.dataset.k);
  };
}
/* Erster Start: Funktionen auswählen (später im Menü änderbar) */
function showOnboard(next) {
  var d = document.createElement("div"); d.id = "launch"; d.className = "onb"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Willkommen");
  d.innerHTML = '<div class="lwrap"><div class="ltitle">Willkommen</div><div class="lq">Welche Funktionen möchtest du nutzen?<br><small>Du kannst das jederzeit im Menü unter „Funktionen“ ändern.</small></div>' +
    '<div class="card" id="oFeat">' + FEATURES.map(function (f) {
      return '<label class="tog"><span><b>' + f[1] + "</b><small>" + f[2] + '</small></span><input type="checkbox" data-f="' + f[0] + '"' + (F(f[0]) ? " checked" : "") + "><i></i></label>"; }).join("") + "</div>" +
    '<div class="col"><button class="btn primary" id="oGo" type="button" style="flex:none">Los geht’s</button></div></div>';
  document.body.appendChild(d);
  $("oGo").onclick = function () {
    state.features = {};
    Array.prototype.forEach.call(d.querySelectorAll("[data-f]"), function (x) { state.features[x.dataset.f] = x.checked; });
    state.onboarded = true; S.save(); d.remove(); render(); next();
  };
}
/* beim Start aufrufen */
function launchStart() {
  if (!state.onboarded) {
    /* wer schon Daten hat, nutzt die App bereits – nicht nochmal fragen */
    if (Object.keys(S.products).length || state.purchases.length) { state.onboarded = true; S.save(); }
    else { showOnboard(launchStart); return; }
  }
  if (state.launch) { launchTo(state.launch); return; }
  showLaunch();
}
