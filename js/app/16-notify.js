/* MHD-Erinnerung als Handy-Benachrichtigung (ohne Server):
   – beim Einschalten wird die Erlaubnis geholt und eine Test-Nachricht gezeigt
   – im Hintergrund prüft der Service Worker per „Periodic Background Sync“ (nur Chrome/Android, App installiert)
*/
"use strict";

function notifySupport() { return "Notification" in window && "serviceWorker" in navigator; }
function notifyStatus() {
  if (!notifySupport()) return "nicht möglich";
  if (Notification.permission === "denied") return "blockiert (in den Browser-Einstellungen erlauben)";
  return state.notify ? "An" : "Aus";
}
function toggleNotify() {
  if (!notifySupport()) { toast("Dieser Browser kann keine Benachrichtigungen.", 4000); return Promise.resolve(); }
  if (state.notify) {
    state.notify = false; S.save();
    return navigator.serviceWorker.ready.then(function (reg) { if (reg.periodicSync) return reg.periodicSync.unregister("mhd"); }).catch(function () {}).then(function () { toast("MHD-Erinnerung aus"); });
  }
  return Notification.requestPermission().then(function (perm) {
    if (perm !== "granted") { toast("Ohne Erlaubnis geht es leider nicht.", 4000); return; }
    state.notify = true; S.save();
    return navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification("Einkauf: Erinnerung ist an", { body: "So sieht es aus, wenn etwas im Vorrat bald abläuft.", icon: "icon-192.png", tag: "mhd-test" });
      if (!reg.periodicSync) return "nosync";
      return navigator.permissions.query({ name: "periodic-background-sync" }).then(function (st) {
        if (st.state !== "granted") return "nosync";
        return reg.periodicSync.register("mhd", { minInterval: 12 * 36e5 }).then(function () { return "ok"; });
      }).catch(function () { return "nosync"; });
    }).then(function (r) {
      toast(r === "ok" ? "✓ Erinnerung an – das Handy meldet sich, wenn etwas abläuft." : "✓ Erinnerung an. Im Hintergrund klappt es nur, wenn die App auf dem Startbildschirm installiert ist (Chrome/Android) – sonst siehst du die Warnung auf dem Start.", 6000);
    });
  });
}
