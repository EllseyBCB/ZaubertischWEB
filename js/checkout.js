// Echtgeld-Kauf von Kristallpaketen (Phase 2). Ruft die Supabase Edge Function
// 'create-checkout' auf und leitet zur gehosteten Stripe-/PayPal-Seite weiter.
// Nach Rücksprung wird das Guthaben aktualisiert (PayPal zusätzlich abgeschlossen).
import { FUNCTIONS_URL, PAYMENTS_ENABLED } from './config.js';
import { getClient, refreshWallet, toast } from './auth.js';

export function paymentsEnabled() { return PAYMENTS_ENABLED && !!FUNCTIONS_URL; }

async function accessToken() {
  const c = await getClient(); if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.access_token || null;
}

// Kauf starten: Paket + Anbieter → Redirect-URL holen → weiterleiten.
export async function startPackCheckout(packId, provider) {
  if (!paymentsEnabled()) { toast('Bezahlung ist noch nicht aktiv.', 'err'); return; }
  const token = await accessToken();
  if (!token) { location.href = 'konto.html'; return; }
  try {
    const r = await fetch(`${FUNCTIONS_URL}/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pack_id: packId, provider }),
    });
    const j = await r.json();
    if (!r.ok || !j.url) { toast(j.error || 'Kauf konnte nicht gestartet werden.', 'err'); return; }
    // PayPal-Order-ID für den Abschluss nach Rücksprung merken.
    if (provider === 'paypal' && j.order_id) {
      try { sessionStorage.setItem('paypal_order', j.order_id); } catch (_) {}
    }
    location.href = j.url;
  } catch (e) {
    toast('Netzwerkfehler: ' + (e?.message || e), 'err');
  }
}

// Nach Rücksprung von Stripe/PayPal (auf shop.html) aufrufen.
export async function handleReturn() {
  const q = new URLSearchParams(location.search);
  const clean = () => history.replaceState(null, '', location.pathname);

  if (q.get('bezahlt') === 'ok') {
    // Stripe: Gutschrift erfolgt per Webhook (evtl. kurze Verzögerung) → pollen.
    toast('Danke! Kristalle werden gutgeschrieben …', 'ok');
    await pollWallet();
    clean();
    return;
  }
  if (q.get('bezahlt') === 'abbruch') {
    toast('Kauf abgebrochen.', 'err'); clean(); return;
  }
  if (q.get('paypal') === 'return') {
    let orderId = q.get('token'); // PayPal hängt ?token=<orderID> an
    if (!orderId) { try { orderId = sessionStorage.getItem('paypal_order'); } catch (_) {} }
    if (!orderId) { clean(); return; }
    toast('Zahlung wird abgeschlossen …', 'ok');
    try {
      const r = await fetch(`${FUNCTIONS_URL}/paypal-capture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      const j = await r.json();
      if (j.ok) { await refreshWallet(); toast('Kristalle gutgeschrieben! 💎', 'ok'); }
      else toast(j.error || j.message || 'Zahlung nicht abgeschlossen.', 'err');
    } catch (e) {
      toast('Fehler beim Abschluss: ' + (e?.message || e), 'err');
    }
    try { sessionStorage.removeItem('paypal_order'); } catch (_) {}
    clean();
  }
}

// Guthaben ein paar Mal nachladen (Webhook-Verzögerung überbrücken).
async function pollWallet(tries = 6) {
  for (let i = 0; i < tries; i++) {
    await refreshWallet();
    await new Promise((r) => setTimeout(r, 1500));
  }
}
