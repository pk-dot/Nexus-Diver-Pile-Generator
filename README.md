# Pile Generator

Leichte HTML-, CSS- und JavaScript-WebApp für die zufällige Generierung von Spielfeld-Quadranten für Nexus Diver.

## Funktionen

- 7×7-Spielfeld mit X-/Y-Koordinaten
- 4 bis 8 zufällige Ressourcen und Gegner pro Wurf
- Maximal 2 Gegner pro Generierung
- Monster und Piraten tragen je zwei zufällige Ressourcen (Doppelungen erlaubt, Gewichte werden beachtet)
- Keine doppelten Feldbelegungen
- Konfigurierbare Ressourcen, Gegner und Generierungsregeln
- Settings mit JSON-Editor und lokaler Speicherung im Browser
- Default-Konfiguration wiederherstellen
- Responsive Desktop-, Tablet- und Smartphone-Ansicht
- Spielfeld-Scan als Beta-Funktion mit Kamera-/Foto-Upload
- Quadratischer Bildzuschnitt für nicht quadratische Fotos
- Manuelle Sperrzonen-Auswahl ohne Foto
- Gesperrte Felder werden bei der Generierung ausgeschlossen

## Lokal starten

Die App benötigt keine Installation und keine externen Abhängigkeiten. Im Projektordner ausführen:

```bash
python3 -m http.server 4173
```

Danach im Browser öffnen:

```text
http://localhost:4173
```

## Als App installieren

Der Pile Generator ist eine installierbare Web-App (PWA) und funktioniert nach dem ersten Aufruf auch offline.

- **iPhone/iPad (Safari):** Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **Desktop (Chrome/Edge):** Installieren-Symbol in der Adressleiste.

Voraussetzung ist HTTPS (lokal genügt `localhost`). Zuständige Dateien: `manifest.webmanifest`, `sw.js` und die Icons in `img/app/`. Bei einer neuen Version `CACHE_VERSION` in `sw.js` zusammen mit `APP_VERSION` in `app.js` anheben – ein Test prüft das.

## Deployment

Mit dem Build-Skript wird der Ordner `dist/` mit allen Dateien für den Server erzeugt:

```bash
./build-dist.sh
```

Anschließend den Inhalt von `dist/` auf den Webserver hochladen. Der Ordner wird bei jedem Aufruf neu erstellt und ist per `.gitignore` vom Repository ausgeschlossen.

## Tests

Die Tests nutzen den eingebauten Node-Testrunner, ohne Abhängigkeiten:

```bash
node --test tests/
```

## Konfiguration

Über **Settings** kann das JSON direkt bearbeitet werden. Änderungen werden nach „Konfiguration übernehmen“ im Browser unter dem Schlüssel `pile-generator-config` gespeichert.

Die gespeicherten Settings sind ausschließlich lokal im jeweiligen Browser verfügbar. Über „Auf Default zurücksetzen“ werden sie gelöscht und durch die Standardwerte ersetzt.

## Spielfeld-Scan

„Spielfeld scannen · Beta“ erlaubt den Upload eines Fotos oder die Aufnahme über die Handykamera. Vor der Analyse kann ein quadratischer Ausschnitt gewählt werden. Dunkle Innenflächen werden automatisch als mögliche Wände erkannt.

Die Erkennung ist eine heuristische Beta-Funktion. Schwarze Randlinien können Wege begrenzen und werden deshalb nicht automatisch als Wand gewertet. Erkannte Felder können vor der Übernahme manuell korrigiert werden. Alternativ lassen sich Sperrzonen direkt ohne Foto im 7×7-Raster markieren.

## Projektstruktur

```text
index.html       Hauptansicht und Settings-/Scan-Dialog
app.js           Generator, Konfiguration und Fotoanalyse
styles.css       Responsive Gestaltung
changelog.html   Versionshistorie
roadmap.html     Geplante Features
img/             Gegner- und UI-Icons
tests/           Automatisierte Tests (node --test)
build-dist.sh    Erstellt dist/ für den Server
manifest.webmanifest, sw.js  Installierbare Web-App (PWA)
```

Aktuelle Version: **1.4.1**
