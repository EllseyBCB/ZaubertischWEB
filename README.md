# Zaubertisch – Website

Marketing-Website für das Kartenspiel **Zaubertisch** (das Spiel selbst lebt im
Repo [WIZ-WIZ](https://github.com/EllseyBCB/WIZ-WIZ)). Statische Seite, **kein
Build-Schritt** – direkt auf GitHub Pages deploybar.

## Inhalt

- **`index.html`** – Startseite: Hero, Download-Buttons, Features, Shop-Schaufenster.
- **`anleitung.html`** – ausführliche Spielanleitung (How-to-play) mit Kartenbildern.
- **`css/style.css`** – magisches Lila-Gold-Theme (aus dem Spiel abgeleitet).
- **`js/config.js`** – zentrale Links (App-Store-URL, Browser-Spiel-URL).
- **`js/shop-catalog.js`** – **1:1-Kopie** der Shop-Datenquelle aus WIZ-WIZ.
- **`js/shop.js`** – rendert das Shop-Schaufenster aus `shop-catalog.js`.
- **`js/cta.js`** – verdrahtet die Download-/Spielen-Buttons aus der Config.
- **`assets/game/`** – Grafiken aus WIZ-WIZ (Kristall-Pakete, Karten, Thumbs).
- **`assets/icons/`** – App-Icons / Favicon.

## Der Shop (Schaufenster)

Der Shop wird **read-only** angezeigt – es werden keine Käufe auf der Website
abgewickelt. Echte Käufe laufen weiterhin in der App über Apple StoreKit.
`js/shop.js` liest die Original-Datenquelle `js/shop-catalog.js` und rendert
Kristall-Pakete, Avatare, Kartendecks, Spielfelder, Kartenrückseiten und Truhen.

### Shop aus WIZ-WIZ aktualisieren

Ändert sich der Shop im Spiel, einfach neu übernehmen:

1. `shop-catalog.js` aus WIZ-WIZ nach `js/shop-catalog.js` kopieren (unverändert).
2. Neue/aktualisierte Grafiken nach `assets/game/` kopieren – dabei die
   Ordnerstruktur aus WIZ-WIZ spiegeln (z. B. `lobby/…`, `avatars/…`,
   `cards/backs/…`). `js/shop.js` stellt automatisch `assets/game/` voran
   (`ASSET_BASE` in `js/config.js`).

Fehlt zu einem Artikel ein Bild, zeigt das Schaufenster automatisch das
Emoji-Symbol aus dem Katalog.

## App-Store-Link eintragen

Sobald die App live ist, in **`js/config.js`** die echte URL setzen:

```js
export const APP_STORE_URL = 'https://apps.apple.com/app/idXXXXXXXXXX';
```

Solange der Wert leer ist, zeigen die Buttons „Bald im App Store" (deaktiviert).
Der Browser-Spiel-Link wird über `PLAY_URL` gesteuert (Default:
`https://ellseybcb.github.io/WIZ-WIZ/`).

## Lokal testen

```bash
python3 -m http.server 8080
# dann http://localhost:8080/ öffnen
```

> ES-Module (`shop.js`, `config.js`) werden per `http://` geladen – ein
> lokaler Server ist nötig; direktes Öffnen der Datei (`file://`) funktioniert nicht.

## Deploy (GitHub Pages)

Repository-Einstellungen → **Pages** → Branch `main` (Root). Die Seite läuft
dann unter `https://ellseybcb.github.io/ZaubertischWEB/`. Die Datei
`.nojekyll` sorgt dafür, dass alle Ordner unverändert ausgeliefert werden.
