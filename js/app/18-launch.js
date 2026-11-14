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
/* beim Start aufrufen */
function launchStart() {
  if (state.launch) { launchTo(state.launch); return; }
  showLaunch();
}
