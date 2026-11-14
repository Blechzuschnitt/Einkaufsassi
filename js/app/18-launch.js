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
  d.innerHTML = '<div class="lwrap"><img class="llogo" src="logo.webp" alt="EinkaufsAssi" width="220" height="220"><div class="lq">Wohin möchtest du?</div>' +
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
  d.innerHTML = '<div class="lwrap"><img class="llogo sm" src="logo.webp" alt="EinkaufsAssi" width="150" height="150"><div class="ltitle">Willkommen beim EinkaufsAssi</div><div class="lq">Schritt 1 von 2 · Welche Funktionen möchtest du nutzen?<br><small>Du kannst das jederzeit im Menü unter „Funktionen“ ändern.</small></div>' +
    '<div class="card" id="oFeat">' + FEATURES.map(function (f) {
      return '<label class="tog"><span><b>' + f[1] + "</b><small>" + f[2] + '</small></span><input type="checkbox" data-f="' + f[0] + '"' + (F(f[0]) ? " checked" : "") + "><i></i></label>"; }).join("") + "</div>" +
    '<div class="col"><button class="btn primary" id="oGo" type="button" style="flex:none">Weiter</button></div></div>';
  document.body.appendChild(d);
  $("oGo").onclick = function () {
    state.features = {};
    Array.prototype.forEach.call(d.querySelectorAll("[data-f]"), function (x) { state.features[x.dataset.f] = x.checked; });
    state.onboarded = true; S.save(); d.remove(); render(); showAccountStep(next);
  };
}
/* Erster Start, Schritt 2: Konto für die Cloud-Sicherung – oder bewusst ohne */
function showAccountStep(next) {
  if (cloud.user) { next(); return; }
  var d = document.createElement("div"); d.id = "launch"; d.className = "onb"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Konto anlegen");
  d.innerHTML = '<div class="lwrap"><img class="llogo sm" src="logo.webp" alt="EinkaufsAssi" width="150" height="150">' +
    '<div class="ltitle">Konto anlegen</div><div class="lq">Schritt 2 von 2<br><small>Mit Konto werden deine Daten automatisch in der Cloud gesichert und sind auf jedem Handy wieder da.</small></div>' +
    '<div class="card"><label class="f" style="margin-top:0">Benutzername</label><input type="text" id="aUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="z. B. sascha">' +
    '<label class="f">Passwort</label><input type="password" id="aPass" autocomplete="new-password" placeholder="mindestens 6 Zeichen">' +
    '<div id="aMsg" class="amsg"></div>' +
    '<div class="col"><button class="btn primary" id="aReg" type="button" style="flex:none">Konto anlegen</button>' +
    '<button class="btn" id="aIn" type="button">Ich habe schon ein Konto – anmelden</button></div>' +
    '<div class="hint">Merk dir das Passwort gut – ohne E-Mail-Adresse lässt es sich nicht zurücksetzen.</div></div>' +
    '<div class="warnbox">' + I("alert") + ' <b>Ohne Konto</b> werden deine Daten nur in diesem Browser gespeichert. Löschst du die Browserdaten oder wechselst das Handy, sind Listen, Preise und Vorrat weg.</div>' +
    '<div class="col"><button class="btn" id="aSkip" type="button">Ohne Konto weiter</button></div>' +
    '<div class="hint" style="text-align:center">Ein Konto kannst du auch später im Menü unter „Cloud-Sicherung“ anlegen.</div></div>';
  document.body.appendChild(d);
  var say = function (t, bad) { var m = $("aMsg"); m.textContent = t; m.className = "amsg " + (bad ? "bad" : "ok"); };
  function go(register) {
    var u = cloudName($("aUser").value), p = $("aPass").value;
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) { say("Benutzername: 3–30 Zeichen, nur Buchstaben a–z, Ziffern und . _ -", true); $("aUser").focus(); return; }
    if (p.length < 6) { say("Das Passwort braucht mindestens 6 Zeichen.", true); $("aPass").focus(); return; }
    say(register ? "Lege Konto an …" : "Melde an …");
    cloudLogin(u, p, register).then(function () {
      d.remove(); toast(register ? "Konto angelegt – deine Daten werden ab jetzt gesichert." : "Angemeldet – Daten aus der Cloud geholt.", 4000); next();
    }, function (e) { say(e.message, true); });
  }
  $("aReg").onclick = function () { go(true); };
  $("aIn").onclick = function () { go(false); };
  $("aPass").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(true); } };
  $("aSkip").onclick = function () { d.remove(); next(); };
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
