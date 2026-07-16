// Geteilte Helfer für die Edge Functions (Deno).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

// CORS: erlaubt Aufrufe von der Website. Für Produktion kannst du '*' durch
// deine Domain(en) ersetzen.
export const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extra },
  });
}

// Service-Role-Client (darf Guthaben gutschreiben). Secret NUR serverseitig.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

// Ermittelt den angemeldeten Nutzer aus dem mitgesendeten JWT (Authorization).
export async function userFromRequest(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const c = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data } = await c.auth.getUser();
  return data?.user || null;
}

// Basis-URL der Website (für Rücksprung nach der Zahlung).
export function siteUrl(): string {
  return Deno.env.get('SITE_URL') || 'https://ellseybcb.github.io/ZaubertischWEB';
}

// Kristallpaket serverseitig laden (Preis = Wahrheit aus der DB).
export async function loadPack(admin: ReturnType<typeof adminClient>, packId: string) {
  const { data, error } = await admin
    .from('wizard_crystal_packs')
    .select('*')
    .eq('id', packId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data as
    | { id: string; crystals: number; bonus: number; amount_cents: number; currency: string }
    | null;
}
