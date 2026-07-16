// Erzeugt eine Bezahl-Sitzung für ein Kristallpaket und gibt die Redirect-URL
// zurück. Preis kommt SERVERSEITIG aus wizard_crystal_packs (nie vom Client).
// Aufruf: POST { pack_id, provider: 'stripe' | 'paypal' } mit Bearer-JWT.
import { adminClient, userFromRequest, loadPack, siteUrl, json, cors } from '../_shared/util.ts';

const PAYPAL_BASE = () =>
  (Deno.env.get('PAYPAL_ENV') || 'sandbox') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function paypalToken(): Promise<string> {
  const id = Deno.env.get('PAYPAL_CLIENT_ID')!;
  const secret = Deno.env.get('PAYPAL_SECRET')!;
  const r = await fetch(`${PAYPAL_BASE()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${id}:${secret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal-Token fehlgeschlagen: ' + JSON.stringify(j));
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST erforderlich' }, 405);

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Nicht angemeldet' }, 401);

    const { pack_id, provider } = await req.json().catch(() => ({}));
    if (!pack_id || !provider) return json({ error: 'pack_id/provider fehlt' }, 400);

    const admin = adminClient();
    const pack = await loadPack(admin, pack_id);
    if (!pack) return json({ error: 'Paket nicht gefunden' }, 404);

    const total = pack.crystals + (pack.bonus || 0);
    const site = siteUrl();
    const name = `${pack.crystals.toLocaleString('de-DE')} Kristalle` +
      (pack.bonus ? ` (+${pack.bonus} Bonus)` : '');

    if (provider === 'stripe') {
      const key = Deno.env.get('STRIPE_SECRET_KEY')!;
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', `${site}/shop.html?bezahlt=ok`);
      form.set('cancel_url', `${site}/shop.html?bezahlt=abbruch`);
      form.set('client_reference_id', user.id);
      form.set('metadata[uid]', user.id);
      form.set('metadata[pack_id]', pack.id);
      form.set('line_items[0][quantity]', '1');
      form.set('line_items[0][price_data][currency]', pack.currency);
      form.set('line_items[0][price_data][unit_amount]', String(pack.amount_cents));
      form.set('line_items[0][price_data][product_data][name]', name);
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const s = await r.json();
      if (!r.ok) return json({ error: s?.error?.message || 'Stripe-Fehler' }, 400);
      return json({ url: s.url });
    }

    if (provider === 'paypal') {
      const token = await paypalToken();
      const value = (pack.amount_cents / 100).toFixed(2);
      const r = await fetch(`${PAYPAL_BASE()}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: pack.currency.toUpperCase(), value },
            description: name,
            custom_id: `${user.id}|${pack.id}`,
          }],
          application_context: {
            brand_name: 'Zaubertisch',
            user_action: 'PAY_NOW',
            return_url: `${site}/shop.html?paypal=return`,
            cancel_url: `${site}/shop.html?bezahlt=abbruch`,
          },
        }),
      });
      const o = await r.json();
      if (!r.ok) return json({ error: 'PayPal-Fehler: ' + JSON.stringify(o) }, 400);
      const approve = (o.links || []).find((l: { rel: string; href: string }) => l.rel === 'approve');
      if (!approve) return json({ error: 'Kein Approve-Link' }, 400);
      return json({ url: approve.href, order_id: o.id });
    }

    return json({ error: 'Unbekannter Anbieter' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
