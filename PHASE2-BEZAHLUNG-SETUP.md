# Phase 2 – Kristalle mit echtem Geld kaufen (Stripe + PayPal)

Der komplette Code ist fertig im Repo. Sobald die folgenden Schritte erledigt
sind, kannst du auf der Website Kristalle per **Kreditkarte/Apple Pay (Stripe)**
und **PayPal** kaufen; die Kristalle werden dem Konto **server-seitig** gutgeschrieben.

> Beginne mit dem **Test-/Sandbox-Modus**. Erst wenn alles läuft, auf „Live" umstellen.

---

## Übersicht der Teile
- **SQL:** `supabase/wizard_web_payments.sql` (Pakete, Käufe, Gutschrift-Funktion)
- **Edge Functions:** `supabase/functions/create-checkout`, `stripe-webhook`, `paypal-capture`
- **Frontend:** `js/checkout.js` + Kauf-Buttons an den Paketen (in `js/shop.js`)
- **Schalter:** `js/config.js` → `PAYMENTS_ENABLED`

---

## Schritt 1 – Konten anlegen (Sandbox)
1. **Stripe:** Konto auf https://stripe.com. Im **Testmodus** unter *Entwickler → API-Schlüssel* den **Secret Key** (`sk_test_…`) kopieren.
2. **PayPal Developer:** https://developer.paypal.com → *Apps & Credentials* → **Sandbox** → App erstellen → **Client ID** + **Secret** kopieren.

## Schritt 2 – SQL einspielen
Supabase-Dashboard (dein Spiel-Projekt) → **SQL Editor** → Inhalt von
`supabase/wizard_web_payments.sql` einfügen → **Run**. (Additiv, ändert nichts Bestehendes.)

## Schritt 3 – Edge Functions deployen
Mit der Supabase CLI (lokal), aus dem Repo-Ordner:
```bash
supabase login
supabase link --project-ref mpvosmtsbvwasvnzjuwd
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy paypal-capture
```
> `stripe-webhook` braucht `--no-verify-jwt` (Stripe sendet kein Supabase-JWT;
> die Echtheit wird stattdessen über die Stripe-Signatur geprüft).

## Schritt 4 – Secrets setzen (server-seitig, nie im Browser)
```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  PAYPAL_CLIENT_ID=xxx \
  PAYPAL_SECRET=xxx \
  PAYPAL_ENV=sandbox \
  SITE_URL=https://ellseybcb.github.io/ZaubertischWEB \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=sb_publishable_DGG2ulMkqrCUgUrwzy0KvQ_6pPlbqrq
```
- `SUPABASE_URL` ist in Edge Functions automatisch gesetzt.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase → *Project Settings → API → service_role* (**geheim!**).
- `STRIPE_WEBHOOK_SECRET`: kommt aus Schritt 5.

## Schritt 5 – Stripe-Webhook einrichten
Stripe-Dashboard → *Entwickler → Webhooks → Endpoint hinzufügen*:
- URL: `https://mpvosmtsbvwasvnzjuwd.functions.supabase.co/stripe-webhook`
- Event: **`checkout.session.completed`**
- Den angezeigten **Signing secret** (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` setzen (Schritt 4) und die Function neu deployen.

## Schritt 6 – Zahlungen aktivieren
In `js/config.js`:
```js
export const PAYMENTS_ENABLED = true;
```
committen/pushen. Danach erscheinen an den Kristall-Paketen die Buttons
**„Mit Karte"** und **„PayPal"** (nur für eingeloggte Nutzer).

## Schritt 7 – Testen (kein echtes Geld)
- **Stripe-Testkarte:** `4242 4242 4242 4242`, beliebiges zukünftiges Datum, CVC, PLZ.
- **PayPal:** mit einem **Sandbox-Käuferkonto** (aus developer.paypal.com) bezahlen.
- Erwartung: nach Zahlung Rücksprung auf `shop.html`, Toast „gutgeschrieben",
  Guthaben oben steigt. Zweiter identischer Webhook/Capture verdoppelt **nicht**
  (Idempotenz über `provider_ref`).

## Schritt 8 – Live schalten
- Stripe in den **Live-Modus** (echte `sk_live_…`, neuer Live-Webhook + `whsec_…`).
- PayPal: **Live-App** anlegen, `PAYPAL_ENV=live`, Live-Client-ID/Secret setzen.
- Für **Apple Pay** in Stripe: *Settings → Payment Methods → Apple Pay* → deine
  Domain(s) verifizieren (Stripe stellt dafür eine Datei/den Automatik-Weg bereit).

---

## Sicherheit (bereits eingebaut)
- Preise/Beträge kommen **serverseitig** aus `wizard_crystal_packs` – nie vom Browser.
- Gutschrift nur nach **verifizierter** Zahlung (Stripe-Signatur bzw. PayPal-Capture).
- `wizard_credit_crystals` ist **idempotent** und nur mit **Service-Role** aufrufbar
  (für `anon`/`authenticated` entzogen) – vom Browser aus nicht ausführbar.
- Steuer/Umsatzsteuer liegt bei dir (so gewünscht) – die Käufe stehen als Belege
  in `wizard_purchases`.
