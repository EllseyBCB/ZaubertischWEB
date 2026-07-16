// Web-Login + Kristall-Guthaben – gemeinsames Konto mit dem Spiel (Supabase).
// Solange SUPABASE_URL / SUPABASE_ANON_KEY in config.js leer sind, ist alles
// inaktiv (kein „Anmelden"-Button, Seite läuft normal weiter).
//
// Sicherheit: Der anon/publishable Key ist client-safe; das Guthaben ist durch
// Row Level Security geschützt und kann NUR von server-seitigen Funktionen
// (SECURITY DEFINER) geändert werden – der Browser darf es nur lesen.
import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_CONFIGURED } from './config.js';

// Supabase-Bibliothek liegt LOKAL im Repo (kein externer CDN zur Laufzeit) und
// wird nur bei Bedarf geladen (siehe loadLib).
const SUPABASE_LIB = 'assets/vendor/supabase.umd.js';

let _client = null;
let _clientPromise = null;
let _libPromise = null;

export function authConfigured() { return AUTH_CONFIGURED; }

// Projekt-Referenz aus der URL → Schlüssel, unter dem Supabase die Sitzung im
// localStorage ablegt. Damit können wir OHNE Laden der Bibliothek prüfen, ob
// überhaupt jemand angemeldet ist (spart auf den meisten Seiten den Download).
function projectRef() {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0]; } catch (_) { return ''; }
}
export function hasStoredSession() {
  if (!AUTH_CONFIGURED) return false;
  try {
    const key = `sb-${projectRef()}-auth-token`;
    return !!localStorage.getItem(key);
  } catch (_) { return false; }
}

// Lokales UMD-Build per Script-Tag laden (einmalig) → window.supabase.
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (_libPromise) return _libPromise;
  _libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SUPABASE_LIB;
    s.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('supabase global fehlt'));
    s.onerror = () => reject(new Error('supabase konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
  return _libPromise;
}

// Supabase-Client bei Bedarf laden (einmalig).
export async function getClient() {
  if (!AUTH_CONFIGURED) return null;
  if (_client) return _client;
  if (!_clientPromise) {
    _clientPromise = loadLib().then((lib) => {
      _client = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return _client;
    });
  }
  return _clientPromise;
}

export async function currentUser() {
  const c = await getClient(); if (!c) return null;
  const { data } = await c.auth.getUser();
  return data?.user || null;
}

export async function signIn(email, password) {
  const c = await getClient(); if (!c) return { error: 'nicht konfiguriert' };
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  return { user: data?.user || null, error: error?.message || null };
}

export async function signUp(email, password) {
  const c = await getClient(); if (!c) return { error: 'nicht konfiguriert' };
  const redirect = location.origin + location.pathname; // zurück auf konto.html
  const { data, error } = await c.auth.signUp({
    email, password, options: { emailRedirectTo: redirect },
  });
  // needsConfirm = true, wenn noch keine Session (E-Mail-Bestätigung nötig)
  return { user: data?.user || null, needsConfirm: !data?.session, error: error?.message || null };
}

export async function signOut() {
  const c = await getClient(); if (!c) return;
  try { await c.auth.signOut(); } catch (_) {}
}

// Kristall-Guthaben (+ gold) des angemeldeten Kontos lesen.
export async function fetchWallet() {
  const c = await getClient(); if (!c) return null;
  const { data, error } = await c.rpc('wizard_wallet');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { crystals: row.crystals ?? 0, gold: row.gold ?? 0, inventory: row.inventory || [] };
}

// Auf Login/Logout reagieren.
export async function onAuthChange(cb) {
  const c = await getClient(); if (!c) return;
  cb(await currentUser());
  c.auth.onAuthStateChange((_e, session) => cb(session?.user || null));
}

const CRYSTAL_IMG = '<img class="crystal-ic" src="assets/icons/kristall.png" alt="Kristalle">';
const fmt = (n) => Number(n || 0).toLocaleString('de-DE');

// --- Header-Konto-Button (wird von layout.js aufgerufen) --------------------
export async function mountAccountHeader() {
  const slot = document.getElementById('account-slot');
  if (!slot) return;
  if (!AUTH_CONFIGURED) { slot.innerHTML = ''; return; }
  // Ohne gespeicherte Sitzung: nur „Anmelden" zeigen (Bibliothek NICHT laden).
  if (!hasStoredSession()) {
    slot.innerHTML = `<a class="btn-account" href="konto.html">Anmelden</a>`;
    return;
  }
  const render = async (user) => {
    if (user) {
      const w = await fetchWallet();
      const bal = w ? `<span class="acc-bal">${CRYSTAL_IMG}${fmt(w.crystals)}</span>` : '';
      slot.innerHTML = `<a class="btn-account" href="konto.html">${bal}<span class="acc-name">Konto</span></a>`;
    } else {
      slot.innerHTML = `<a class="btn-account" href="konto.html">Anmelden</a>`;
    }
  };
  onAuthChange(render);
}

// --- Konto-Seite (konto.html ruft initAccountPage() auf) --------------------
export async function initAccountPage() {
  const root = document.getElementById('account-page');
  if (!root) return;

  if (!AUTH_CONFIGURED) {
    root.innerHTML = `
      <div class="legal-page">
        <p>Die Anmeldung wird gerade eingerichtet und ist bald verfügbar.
        Bis dahin verwaltest du dein Konto direkt im Spiel.</p>
      </div>`;
    return;
  }

  const draw = async (user) => {
    if (user) {
      const w = await fetchWallet();
      root.innerHTML = `
        <div class="auth-card">
          <p class="auth-hi">Angemeldet als <strong>${esc(user.email || 'Konto')}</strong></p>
          <div class="wallet-box">
            <span class="wallet-label">Dein Guthaben</span>
            <span class="wallet-amount">${CRYSTAL_IMG}${fmt(w ? w.crystals : 0)}</span>
          </div>
          <p class="auth-note">Dieses Guthaben ist mit deinem Spiel-Konto identisch.
          Kristalle kaufen kannst du bald direkt hier auf der Website.</p>
          <button class="btn sekundaer" id="acc-logout" type="button">Abmelden</button>
        </div>`;
      root.querySelector('#acc-logout').onclick = async (e) => {
        e.target.disabled = true; await signOut();
      };
    } else {
      root.innerHTML = authFormsHTML();
      wireForms(root);
    }
  };

  onAuthChange(draw);
}

function authFormsHTML() {
  return `
  <div class="auth-tabs">
    <button class="auth-tab active" data-tab="login" type="button">Anmelden</button>
    <button class="auth-tab" data-tab="register" type="button">Registrieren</button>
  </div>

  <form class="auth-card auth-form" data-form="login">
    <label>E-Mail<input type="email" name="email" autocomplete="email" required></label>
    <label>Passwort<input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Anmelden</button>
    <p class="auth-msg" data-msg></p>
  </form>

  <form class="auth-card auth-form" data-form="register" hidden>
    <label>E-Mail<input type="email" name="email" autocomplete="email" required></label>
    <label>Passwort (mind. 6 Zeichen)<input type="password" name="password" autocomplete="new-password" minlength="6" required></label>
    <button class="btn" type="submit">Konto erstellen</button>
    <p class="auth-msg" data-msg></p>
    <p class="auth-note">Hast du im Spiel bereits eine E-Mail hinterlegt? Dann melde dich einfach mit denselben Daten an – es ist dasselbe Konto.</p>
  </form>`;
}

function wireForms(root) {
  const tabs = root.querySelectorAll('.auth-tab');
  const forms = { login: root.querySelector('[data-form="login"]'), register: root.querySelector('[data-form="register"]') };
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    forms.login.hidden = t.dataset.tab !== 'login';
    forms.register.hidden = t.dataset.tab !== 'register';
  });

  forms.login.onsubmit = async (e) => {
    e.preventDefault();
    const msg = forms.login.querySelector('[data-msg]');
    const btn = forms.login.querySelector('button[type=submit]');
    msg.textContent = ''; btn.disabled = true;
    const { error } = await signIn(forms.login.email.value.trim(), forms.login.password.value);
    btn.disabled = false;
    if (error) { msg.className = 'auth-msg err'; msg.textContent = übersetzeFehler(error); }
    // Erfolg: onAuthChange rendert die Konto-Ansicht automatisch neu.
  };

  forms.register.onsubmit = async (e) => {
    e.preventDefault();
    const msg = forms.register.querySelector('[data-msg]');
    const btn = forms.register.querySelector('button[type=submit]');
    msg.textContent = ''; btn.disabled = true;
    const { needsConfirm, error } = await signUp(forms.register.email.value.trim(), forms.register.password.value);
    btn.disabled = false;
    if (error) { msg.className = 'auth-msg err'; msg.textContent = übersetzeFehler(error); return; }
    if (needsConfirm) {
      msg.className = 'auth-msg ok';
      msg.textContent = 'Fast geschafft! Bitte bestätige die E-Mail, die wir dir geschickt haben.';
    }
  };
}

function übersetzeFehler(m) {
  const s = String(m).toLowerCase();
  if (s.includes('invalid login')) return 'E-Mail oder Passwort ist falsch.';
  if (s.includes('already registered') || s.includes('already been registered')) return 'Diese E-Mail ist bereits registriert – bitte anmelden.';
  if (s.includes('confirm')) return 'Bitte bestätige zuerst deine E-Mail.';
  if (s.includes('password')) return 'Das Passwort erfüllt die Anforderungen nicht (mind. 6 Zeichen).';
  return m;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
