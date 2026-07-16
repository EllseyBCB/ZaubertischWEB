// PayPal: schließt eine genehmigte Order ab (capture) und schreibt Kristalle gut.
// Aufruf vom Frontend nach Rücksprung: POST { order_id }.
// Sicherheit: uid + pack_id kommen aus der Order (custom_id), NICHT vom Client.
// Idempotenz: wizard_credit_crystals bucht dieselbe Capture-ID nur einmal.
import { adminClient, json, cors } from '../_shared/util.ts';

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
  if (!r.ok) throw new Error('PayPal-Token fehlgeschlagen');
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST erforderlich' }, 405);

  try {
    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: 'order_id fehlt' }, 400);

    const token = await paypalToken();
    const r = await fetch(`${PAYPAL_BASE()}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const o = await r.json();
    // 'ORDER_ALREADY_CAPTURED' o. Ä. ist ok (Idempotenz greift unten trotzdem).
    if (!r.ok && o?.name !== 'UNPROCESSABLE_ENTITY') {
      return json({ error: 'Capture-Fehler: ' + JSON.stringify(o) }, 400);
    }

    const pu = o?.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    const custom = pu?.custom_id || cap?.custom_id || '';
    const [uid, packId] = String(custom).split('|');
    const ref = cap?.id || order_id;
    const completed = (cap?.status === 'COMPLETED') || (o?.status === 'COMPLETED');

    if (!completed) return json({ ok: false, message: 'Zahlung nicht abgeschlossen' });
    if (!uid || !packId) return json({ error: 'Order ohne Zuordnung' }, 400);

    const admin = adminClient();
    const { data, error } = await admin.rpc('wizard_credit_crystals', {
      p_uid: uid, p_pack_id: packId, p_provider: 'paypal', p_ref: ref,
    });
    if (error) return json({ error: 'Gutschrift-Fehler: ' + error.message }, 500);
    const row = Array.isArray(data) ? data[0] : data;
    return json({ ok: true, crystals: row?.crystals, message: row?.message || 'Gutgeschrieben' });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
