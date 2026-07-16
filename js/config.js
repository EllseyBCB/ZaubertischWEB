// Zentrale Konfiguration der Website-Links.
// Hier trägst du später den echten App-Store-Link ein – der Rest der Seite
// zieht sich die Werte automatisch von hier.

// Sobald die App live im App Store ist: die apps.apple.com-URL eintragen.
// Solange dieser Wert LEER ist, zeigen die Buttons "Bald im App Store"
// (deaktiviert) statt eines echten Links.
export const APP_STORE_URL = ''; // z. B. 'https://apps.apple.com/app/id0000000000'

// Spielbare Web-Version (WIZ-WIZ auf GitHub Pages). Bei eigener Domain hier ändern.
export const PLAY_URL = 'https://ellseybcb.github.io/WIZ-WIZ/';

// Basis-Ordner für die aus dem Spiel übernommenen Grafiken. shop.js stellt diesen
// Pfad vor die in shop-catalog.js hinterlegten (relativen) Bildpfade – so bleibt
// shop-catalog.js unverändert und lässt sich jederzeit aus WIZ-WIZ neu kopieren.
export const ASSET_BASE = 'assets/game/';

// --- Supabase (gemeinsames Konto mit dem Spiel) -----------------------------
// Trage hier dieselben Werte wie in der config.js des Spiels ein
// (Supabase-Dashboard → Project Settings → API). Der anon/publishable Key ist
// für den Client gedacht und durch Row Level Security geschützt (kein Geheimnis).
// Solange diese Werte LEER sind, bleibt die Anmeldung auf der Website deaktiviert
// (es erscheint kein „Anmelden"-Button, die Seite funktioniert normal weiter).
export const SUPABASE_URL = 'https://mpvosmtsbvwasvnzjuwd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_DGG2ulMkqrCUgUrwzy0KvQ_6pPlbqrq';

// True, sobald beide Supabase-Werte gesetzt sind.
export const AUTH_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// --- Echtgeld-Zahlungen (Phase 2: Kristalle mit Karte/Apple Pay + PayPal) ----
// Erst auf true stellen, WENN die Supabase Edge Functions (create-checkout,
// stripe-webhook, paypal-capture) deployt und die Secrets gesetzt sind
// (siehe PHASE2-BEZAHLUNG-SETUP.md). Solange false, zeigen die Kristall-Pakete
// keinen Kauf-Button (Seite bleibt unverändert/funktionsfähig).
export const PAYMENTS_ENABLED = false;

// Basis-URL der Supabase Edge Functions (aus SUPABASE_URL abgeleitet).
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';
