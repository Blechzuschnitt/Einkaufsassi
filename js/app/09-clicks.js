/* Klicks in den Seiten, Listen-Menü */
"use strict";
/* ---------- Klicks in den Seiten ---------- */
$("view").addEventListener("click", function (e) {
  var a = e.target.closest("[data-act],[data-go],[data-list]"); if (!a) return;
  if (a.dataset.list) { state.active = a.dataset.list; var L = S.activeList(); if (L.store && state.stores.indexOf(L.store) >= 0) state.store = L.store; S.save(); go("list"); return; }
  if (a.dataset.go && !a.dataset.act) { go(a.dataset.go); return; }
  var act = a.dataset.act, row = a.closest(".row"), b = row && row.dataset.b;
  if (ACTS[act]) { ACTS[act](b || a.dataset.b, a); return; }
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
  if (act === "backup") { doBackup(); render(); toast("Sicherung heruntergeladen – am besten in die Cloud oder per Mail an dich legen.", 5000); return; }
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

function askNewList() { newListDialog(); }
function openListMenu() {
  var l = S.activeList();
  openShell("Liste", '<label class="f">Name</label><input type="text" id="fX" value="' + esc(l.name) + '" autocomplete="off">' +
    '<div class="col"><button class="btn primary" id="lRen" type="button" style="flex:none">Speichern</button>' +
    '<button class="btn" id="lDone" type="button">Abgehakte Artikel von der Liste nehmen</button>' +
    '<button class="btn" id="lUn" type="button">Alle Haken entfernen</button>' +
    '<button class="btn" id="lNew" type="button">＋ Neue Liste</button>' +
    '<button class="btn" id="lTpl" type="button">' + I("star") + ' Als Vorlage speichern</button>' +
    '<button class="btn danger" id="lClr" type="button">Liste leeren</button>' +
    '<button class="btn danger" id="lDel" type="button">Liste löschen</button></div><div id="msg"></div>');
  ctx = { simple: true };
  $("lRen").onclick = function () { l.name = $("fX").value.trim() || l.name; S.save(); closeEdit(); render(); };
  $("lDone").onclick = function () { l.items = l.items.filter(function (i) { return !i.done; }); S.save(); closeEdit(); render(); };
  $("lUn").onclick = function () { l.items.forEach(function (i) { i.done = false; }); S.save(); closeEdit(); render(); };
  $("lNew").onclick = function () { closeEdit(); askNewList(); };
  $("lTpl").onclick = ACTS.tplsave;
  sure($("lClr"), function () { l.items = []; S.save(); closeEdit(); render(); });
  sure($("lDel"), function () { S.removeList(l.id); S.save(); closeEdit(); go("home"); toast("Liste gelöscht"); });
}
function sure(btn, fn) { btn.onclick = function () { if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent += " – wirklich? Nochmal tippen"; return; } fn(); }; }
