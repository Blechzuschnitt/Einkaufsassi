/* Cloud-Sicherung über Supabase: Anmeldung per Mail-Link, danach wird nach jeder Änderung
   automatisch gesichert (eine Zeile je Person, nur für sie lesbar). Wiederherstellen = zusammenführen. */
"use strict";

var CLOUD_URL = "https://ktpjtmoezirsccgjbafe.supabase.co";
var CLOUD_KEY = "sb_publishable_JthhfbzVbUjImGFvevYXaA_j_ssZ3tB";   /* öffentlicher Schlüssel – nur zusammen mit Anmeldung + Zugriffsregeln nutzbar */
var cloud = { sb: null, user: null, timer: null, busy: false, err: "" };

function cloudLast(v) {
  try { if (v) localStorage.setItem("einkauf-cloud-last", String(v)); return +localStorage.getItem("einkauf-cloud-last") || 0; } catch (e) { return v || 0; }
}
function cloudCfg() { return state.cloud || (state.cloud = { on: false, last: 0, cards: false }); }
function loadSupabase() {
  if (window.supabase) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
    s.onload = res; s.onerror = function () { rej(new Error("Supabase nicht ladbar (kein Netz?)")); };
    document.head.appendChild(s);
  });
}
function cloudClient() {
  if (cloud.sb) return Promise.resolve(cloud.sb);
  return loadSupabase().then(function () {
    cloud.sb = window.supabase.createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    cloud.sb.auth.onAuthStateChange(function (ev, session) {
      var was = cloud.user; cloud.user = session && session.user || null;
      if (cloud.user && !was) cloudConnected();
    });
    return cloud.sb.auth.getSession().then(function (r) { cloud.user = r.data.session && r.data.session.user || null; return cloud.sb; });
  });
}
/* Daten für die Cloud: alles außer Cloud-Einstellungen; Kundenkarten nur, wenn gewünscht */
function cloudPayload() {
  var d = JSON.parse(S.exportJSON()), c = cloudCfg();
  delete d.state.cloud;
  if (!c.cards) delete d.state.cards;
  return d;
}
function cloudPush() {
  if (!cloud.user || cloud.busy) return Promise.resolve();
  cloud.busy = true;
  return cloud.sb.from("einkauf_backup").upsert({ user_id: cloud.user.id, data: cloudPayload(), updated_at: new Date().toISOString(), device: navigator.userAgent.slice(0, 120) })
    .then(function (r) {
      cloud.busy = false;
      if (r.error) { cloud.err = r.error.message; return; }
      cloud.err = ""; cloudLast(Date.now());   /* nicht über S.save(), sonst löst jede Sicherung die nächste aus */
    }, function (e) { cloud.busy = false; cloud.err = e && e.message || "Netzfehler"; });
}
function cloudPull() {
  if (!cloud.user) return Promise.resolve(0);
  return cloud.sb.from("einkauf_backup").select("data,updated_at").eq("user_id", cloud.user.id).maybeSingle().then(function (r) {
    if (r.error) throw new Error(r.error.message);
    if (!r.data || !r.data.data) return -1;
    return S.importJSON(JSON.stringify(r.data.data));
  });
}
/* Nach dem Anmelden: erst vorhandene Cloud-Daten zusammenführen, dann sichern */
function cloudConnected() {
  var c = cloudCfg(); c.on = true; c.email = cloud.user.email; S.save();
  if (location.hash.indexOf("access_token") >= 0) history.replaceState(null, "", location.pathname + location.search);
  cloudPull().then(function (n) {
    render();
    toast(n < 0 ? "Cloud-Sicherung verbunden – erste Sicherung läuft" : "Cloud-Sicherung verbunden" + (n ? " · " + n + " Artikel aus der Cloud übernommen" : ""), 5000);
    return cloudPush();
  }).catch(function (e) { cloud.err = e.message; toast("Cloud: " + e.message, 5000); });
}
/* Nach jedem Speichern (mit Verzögerung) automatisch sichern */
function cloudSchedule() {
  if (!cloudCfg().on || !cloud.user) return;
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(cloudPush, 8000);
}
function cloudStart() {
  var c = cloudCfg(), fromLink = location.hash.indexOf("access_token") >= 0;
  if (!CLOUD_KEY || (!c.on && !fromLink)) return;
  cloudClient().then(function () { if (cloud.user && c.on) cloudPush(); }).catch(function (e) { cloud.err = e.message; });
}
function cloudSignIn(email) {
  return cloudClient().then(function (sb) {
    return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
  }).then(function (r) { if (r.error) throw new Error(r.error.message); });
}
function cloudSignOut() {
  var c = cloudCfg(); c.on = false; S.save();
  return (cloud.sb ? cloud.sb.auth.signOut() : Promise.resolve()).then(function () { cloud.user = null; });
}
function cloudStatusText() {
  var c = cloudCfg();
  if (!CLOUD_KEY) return "noch nicht eingerichtet";
  if (!c.on || !cloud.user) return "aus";
  return "an · " + esc(cloud.user.email || c.email || "") + (cloudLast() ? " · zuletzt " + new Date(cloudLast()).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "") + (cloud.err ? ' · <span class="bad">Fehler: ' + esc(cloud.err) + "</span>" : "");
}
/* Menü-Bildschirm */
function openCloud() {
  var c = cloudCfg(), on = c.on && cloud.user;
  openShell("Cloud-Sicherung",
    '<div class="hint" style="margin-top:0">Status: <b>' + cloudStatusText() + "</b></div>" +
    (on ? '<div class="col"><button class="btn primary" id="cNow" type="button" style="flex:none">' + I("upload") + " Jetzt sichern</button>" +
          '<button class="btn" id="cPull" type="button">' + I("download") + " Aus der Cloud holen (zusammenführen)</button></div>" +
          '<label class="check"><input type="checkbox" id="cCards"' + (c.cards ? " checked" : "") + "> Kundenkarten mitsichern</label>" +
          '<div class="col"><button class="btn danger" id="cOut" type="button">Abmelden (Daten bleiben auf dem Handy)</button></div>'
        : '<div class="hint">Gib deine E-Mail-Adresse ein. Du bekommst einen Anmelde-Link – kein Passwort nötig. Danach sichert die App automatisch nach jeder Änderung. Auf einem neuen Handy meldest du dich genauso an und alles ist wieder da.</div>' +
          '<label class="f">E-Mail</label><input type="text" id="cMail" inputmode="email" autocomplete="email" value="' + esc(c.email || "") + '" placeholder="name@beispiel.de">' +
          '<div class="col"><button class="btn primary" id="cGo" type="button" style="flex:none">Anmelde-Link schicken</button></div>' +
          '<div class="hint">Öffne den Link aus der Mail auf <b>diesem</b> Handy im selben Browser.</div>') +
    '<div id="msg"></div>');
  ctx = { simple: true };
  if ($("cGo")) $("cGo").onclick = function () {
    var m = $("cMail").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { msg("Bitte eine gültige E-Mail-Adresse eingeben.", "bad"); return; }
    msg("Sende …", "ok"); c.email = m; S.save();
    cloudSignIn(m).then(function () { msg("Link verschickt – schau in dein Postfach (auch im Spam-Ordner).", "ok"); }, function (e) { msg("Hat nicht geklappt: " + e.message, "bad"); });
  };
  if ($("cNow")) $("cNow").onclick = function () { msg("Sichere …", "ok"); cloudPush().then(function () { if (cloud.err) msg("Fehler: " + cloud.err, "bad"); else openCloud(); }); };
  if ($("cPull")) $("cPull").onclick = function () { cloudPull().then(function (n) { render(); msg(n < 0 ? "In der Cloud liegt noch nichts." : "Zusammengeführt: " + n + " neue Artikel.", "ok"); }, function (e) { msg("Fehler: " + e.message, "bad"); }); };
  if ($("cCards")) $("cCards").onchange = function () { c.cards = this.checked; S.save(); cloudPush(); };
  if ($("cOut")) sure($("cOut"), function () { cloudSignOut().then(function () { openCloud(); }); });
}
