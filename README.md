# Einkauf – Barcode scannen, Preise merken, Wagensumme sehen

Eine kleine Web-App für dein Handy. Alles läuft im Browser, deine Daten bleiben auf dem Gerät.

## Was sie kann
- **Start (Dashboard):** Summe der aktiven Liste, alle Einkaufslisten, Anzahl erfasster Artikel, Ausgaben im Monat, letzter Einkauf, günstigster Markt für die Liste.
- **Immer oben:** Markt-Auswahl (Dropdown), Suchleiste mit Vorschlägen (antippen = auf die Liste), ＋ für einen neuen Artikel. Unten in der Mitte: **Scannen** (Barcode → auf die Liste).
- **Einkaufslisten:** mehrere Listen, Menge, abhaken („im Wagen“), Summe mit Pfand.
- **Artikel-Seite:** alle erfassten Artikel mit Preisen je Markt, filtern, sortieren.
- **Kassenbon-Vergleich:** Bon-Text einfügen, die App ordnet die Zeilen der Liste zu und zeigt teurer/günstiger, nicht geplant, vergessen. Neue Preise lassen sich übernehmen.
- **Angebote:** Die Liste prüft Artikel mit Barcode automatisch in Open Prices (offene Preisdatenbank, in Deutschland gemeldete Angebote der letzten 3 Wochen). Eigene Angebote (Markt, Preis, gültig bis) trägst du im Artikel ein; sie zählen in Summe und Marktvergleich mit und verschwinden nach Ablauf. Dazu Such-Knöpfe für Marktguru und kaufDA.
- **Vorrat:** was du zu Hause hast, mit Datum. Ein- und Austragen per Suche, +/− oder Scan (Scan-Modus „＋ Vorrat“ / „− Vorrat“). Nach dem Einkauf („Einkauf fertig“ oder Bon-Vergleich) landen die Artikel mit Datum im Vorrat. Willst du etwas auf die Liste setzen, das noch im Vorrat ist, fragt die App nach, ob es noch da ist.
- **MHD:** im Vorrat je Artikel „＋ MHD“ (Schnellwahl oder Datum); auf dem Start erscheint eine Warnung, wenn etwas in ≤ 3 Tagen abläuft.
- **Laufweg:** Die App merkt sich je Markt, in welcher Reihenfolge du abhakst, und sortiert die Liste beim nächsten Mal so.
- **Spracheingabe:** 🎤 neben der Suche – z. B. „Milch, zwei Butter und Eier“ (Chrome/Android; die Spracherkennung läuft über den Dienst des Browsers).
- **Bon per Foto:** Beim Kassenbon-Vergleich „📷 Bon fotografieren“ – Texterkennung (Tesseract.js, wird beim ersten Mal aus dem Netz geladen). Ergebnis bitte kurz prüfen.
- **Preisverlauf** je Artikel und Markt als kleines Diagramm, **Monatsbudget** auf Start und Statistik, **Sicherungs-Erinnerung** nach 7 Tagen.
- **Statistik:** Ausgaben pro Monat und Markt, häufigste Artikel, Preisänderungen, Listenpreis je Markt.
- **Live-Scan:** Kamera-Zeile unten, Barcode davorhalten, Piepton, fertig. Bekannte Artikel landen sofort im Wagen.
- **Neuer Artikel:** Name, Foto und (wenn möglich) Pfand holt sich die App online aus Open Food Facts. Du tippst nur den Preis ein.
- **Preise pro Markt:** Einmal eingegeben, beim nächsten Einkauf sofort da. Im Laden nur noch antippen, was in den Wagen kommt.
- **Pfand** wird automatisch zur Summe addiert.
- **Offline:** Nach dem ersten Öffnen läuft die App auch ohne Netz (nur die Online-Namenssuche braucht Netz).
- **Sicherung:** Menü ⚙︎ → Sicherung speichern oder kopieren, später wieder laden.

## Wichtig: Die Kamera braucht https
Öffnest du die Dateien direkt vom Handy-Speicher, geht die Kamera nicht. Die App muss über eine https-Adresse laufen.

### Weg 1 – Netlify Drop (ca. 2 Minuten, kein Konto nötig)
1. Am PC https://app.netlify.com/drop öffnen.
2. Den **ganzen Ordner** `Einkaufen` auf die Seite ziehen.
3. Du bekommst eine Adresse wie `https://irgendwas.netlify.app`. Die am Handy öffnen.
4. Browser-Menü → **„Zum Startbildschirm hinzufügen“**. Danach startet sie wie eine App.

### Weg 2 – GitHub Pages
Ordnerinhalt in ein GitHub-Repository legen, unter *Settings → Pages* den Hauptzweig aktivieren.

### Nur zum Ausprobieren am PC
Im Ordner `python -m http.server 8000` ausführen und `http://localhost:8000` öffnen (Webcam des PCs).

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst |
| `style.css` | Aussehen (dunkel, hoher Kontrast) |
| `js/data.js` | Märkte und die Artikel aus deinen Lidl-Bons |
| `js/ui.js` | Helfer (Geld, Text-Ähnlichkeit) |
| `js/store.js` | Speichern, Listen, Einkäufe, Sicherung |
| `js/compare.js` | Kassenbon einlesen und mit der Liste vergleichen |
| `js/lookup.js` | Online-Suche (Open Food Facts) |
| `js/scanner.js` | Live-Scan, Foto-Scan, Produktfoto |
| `js/app.js` | Seiten und Bedienung |
| `js/zxing.min.js` | Barcode-Bibliothek für iPhones (Android braucht sie meist nicht) |
| `sw.js`, `manifest.webmanifest`, `icon-*` | Offline-Betrieb und App-Symbol |

## Grenzen
- Preise gibt es online nicht verlässlich, die gibst du selbst ein.
- Open Food Facts kennt nicht jeden Artikel, vor allem Eigenmarken. Dann tippst du den Namen selbst.
- Der Pfand-Vorschlag ist eine Schätzung, bitte kurz prüfen.
