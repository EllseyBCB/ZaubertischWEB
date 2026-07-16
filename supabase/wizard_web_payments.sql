-- =====================================================================
-- Zaubertisch – Web-Bezahlung (Kristalle mit echtem Geld über Stripe/PayPal)
-- Additive Migration: legt NUR neue Tabellen/Funktion an, ändert nichts
-- Bestehendes. Im Supabase-SQL-Editor des SPIEL-Projekts ausführen.
-- =====================================================================

-- 1) Echtgeld-Kristallpakete – Preise sind hier serverseitig die WAHRHEIT.
create table if not exists public.wizard_crystal_packs (
  id           text primary key,
  crystals     int  not null,          -- Grundmenge
  bonus        int  not null default 0, -- Bonus-Kristalle
  amount_cents int  not null,          -- Preis in Cent (z. B. 999 = 9,99 €)
  currency     text not null default 'eur',
  active       boolean not null default true
);

-- Pakete passend zu CRYSTAL_PACKS (js/shop-catalog.js). Bei Preisänderung hier anpassen.
insert into public.wizard_crystal_packs (id, crystals, bonus, amount_cents, currency, active) values
  ('crystals_100',  100,  0,    109,  'eur', true),
  ('crystals_500',  500,  50,   449,  'eur', true),
  ('crystals_1200', 1200, 200,  999,  'eur', true),
  ('crystals_2500', 2500, 500,  1999, 'eur', true),
  ('crystals_6000', 6000, 1500, 4999, 'eur', true)
on conflict (id) do update set
  crystals=excluded.crystals, bonus=excluded.bonus,
  amount_cents=excluded.amount_cents, currency=excluded.currency, active=excluded.active;

alter table public.wizard_crystal_packs enable row level security;
drop policy if exists packs_read_all on public.wizard_crystal_packs;
create policy packs_read_all on public.wizard_crystal_packs for select using (true);
-- Keine Schreib-Policy → nur Definer-Funktionen/Service-Role ändern.

-- 2) Käufe / Belege (Idempotenz über provider_ref + Nachweis für Steuer).
create table if not exists public.wizard_purchases (
  id           uuid primary key default gen_random_uuid(),
  uid          uuid not null references auth.users(id) on delete cascade,
  provider     text not null,                 -- 'stripe' | 'paypal'
  provider_ref text not null,                 -- Session-/Order-/Capture-ID
  pack_id      text not null,
  crystals     int  not null,                 -- gutgeschriebene Kristalle (inkl. Bonus)
  amount_cents int  not null,
  currency     text not null default 'eur',
  status       text not null default 'completed',
  created_at   timestamptz not null default now(),
  unique (provider, provider_ref)             -- verhindert Doppel-Gutschrift
);
alter table public.wizard_purchases enable row level security;
drop policy if exists purchases_read_own on public.wizard_purchases;
create policy purchases_read_own on public.wizard_purchases
  for select using (uid = auth.uid());
-- Keine Schreib-Policy → nur die Gutschrift-Funktion (Definer) schreibt.

-- 3) Kristalle nach bestätigter Zahlung gutschreiben. IDEMPOTENT:
--    gleiche (provider, provider_ref) wird nur EINMAL gutgeschrieben.
--    Wird ausschließlich server-seitig (Service-Role / Edge Function) aufgerufen.
create or replace function public.wizard_credit_crystals(
  p_uid uuid, p_pack_id text, p_provider text, p_ref text
) returns table(ok boolean, crystals int, message text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_pack   public.wizard_crystal_packs%rowtype;
  v_total  int;
  v_new    int;
  v_ins    int;
begin
  if p_uid is null or p_ref is null or p_pack_id is null then
    return query select false, 0, 'Ungültige Parameter'; return;
  end if;

  select * into v_pack from public.wizard_crystal_packs where id = p_pack_id and active;
  if not found then
    return query select false, 0, 'Paket nicht gefunden'; return;
  end if;
  v_total := v_pack.crystals + coalesce(v_pack.bonus, 0);

  -- Wallet sicherstellen.
  insert into public.wizard_wallets(uid) values (p_uid) on conflict (uid) do nothing;

  -- Idempotenz: nur einfügen, wenn (provider, provider_ref) neu ist.
  insert into public.wizard_purchases(uid, provider, provider_ref, pack_id, crystals, amount_cents, currency)
    values (p_uid, p_provider, p_ref, p_pack_id, v_total, v_pack.amount_cents, v_pack.currency)
  on conflict (provider, provider_ref) do nothing;
  get diagnostics v_ins = row_count;

  if v_ins = 0 then
    -- Bereits gutgeschrieben → nur aktuelles Guthaben zurückgeben.
    select w.crystals into v_new from public.wizard_wallets w where w.uid = p_uid;
    return query select true, coalesce(v_new,0), 'Bereits gutgeschrieben'; return;
  end if;

  update public.wizard_wallets
     set crystals = crystals + v_total, updated_at = now()
   where uid = p_uid
   returning crystals into v_new;

  insert into public.wizard_ledger(uid, d_crystals, d_gold, reason, ref)
    values (p_uid, v_total, 0, 'kauf_web_' || p_provider, p_ref);

  return query select true, v_new, 'Gutgeschrieben';
end; $$;

-- WICHTIG (Sicherheit): Gutschrift darf NICHT vom Browser/Client aufrufbar sein.
revoke execute on function public.wizard_credit_crystals(uuid, text, text, text) from public, anon, authenticated;
grant  execute on function public.wizard_credit_crystals(uuid, text, text, text) to service_role;
