// Stripe-Webhook: schreibt Kristalle NACH bestätigter Zahlung gut.
// Signatur wird geprüft (STRIPE_WEBHOOK_SECRET) → nur echte Stripe-Events zählen.
// Idempotenz: wizard_credit_crystals bucht dieselbe Session nur einmal.
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { adminClient } from '../_shared/util.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST erforderlich', { status: 405 });

  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, secret);
  } catch (e) {
    return new Response('Signatur ungültig: ' + (e as Error).message, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    // Nur bezahlte Sessions gutschreiben.
    if (s.payment_status === 'paid' || s.status === 'complete') {
      const uid = s.metadata?.uid || s.client_reference_id;
      const packId = s.metadata?.pack_id;
      if (uid && packId) {
        const admin = adminClient();
        const { error } = await admin.rpc('wizard_credit_crystals', {
          p_uid: uid, p_pack_id: packId, p_provider: 'stripe', p_ref: s.id,
        });
        if (error) return new Response('Gutschrift-Fehler: ' + error.message, { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
