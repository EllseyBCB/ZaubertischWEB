// Zentrale Kopf-Navigation + Fußzeile für alle Seiten (Single Source).
// Jede Seite hat nur die Platzhalter <div id="site-header"></div> und
// <footer id="site-footer"></footer> sowie <body data-page="…"> für den
// aktiven Menüpunkt. Menü-Änderungen also nur HIER pflegen.
import { initCTAs } from './cta.js';
import { PLAY_URL } from './config.js';
import { mountAccountHeader } from './auth.js';

const NAV = [
  { page: 'start',     href: 'index.html',     label: 'Start' },
  { page: 'spiel',     href: 'spiel.html',     label: 'Das Spiel' },
  { page: 'shop',      href: 'shop.html',      label: 'Shop' },
  { page: 'anleitung', href: 'anleitung.html', label: 'Anleitung' },
  { page: 'download',  href: 'download.html',  label: 'Download' },
];

function headerHTML(active) {
  const links = NAV.map(n =>
    `<a href="${n.href}"${n.page === active ? ' aria-current="page" class="active"' : ''}>${n.label}</a>`
  ).join('');
  return `
  <div class="wrap">
    <a class="brand" href="index.html">
      <img src="assets/icons/icon-192.png" alt="Zaubertisch-Icon">
      <span class="goldtext">Zaubertisch</span>
    </a>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Menü" aria-expanded="false">☰</button>
    <nav class="nav" id="nav">${links}</nav>
    <div class="account-slot" id="account-slot"></div>
  </div>`;
}

function footerHTML() {
  return `
  <div class="wrap">
    <div>
      <div class="foot-brand">Zaubertisch</div>
      <p class="foot-legal">
        Bereitgestellt von Alpha Blueprint Management and Consulting – FZCO,
        Dubai (VAE). Kontakt: <a href="mailto:info@alphablueprint.de">info@alphablueprint.de</a>
      </p>
    </div>
    <div class="foot-links">
      <a href="spiel.html">Das Spiel</a>
      <a href="shop.html">Shop</a>
      <a href="anleitung.html">Anleitung</a>
      <a href="download.html">Download</a>
      <a data-cta="play" role="button">Im Browser spielen</a>
    </div>
    <div class="foot-links">
      <a href="impressum.html">Impressum</a>
      <a href="datenschutz.html">Datenschutz</a>
      <a href="nutzungsbedingungen.html">Nutzungsbedingungen</a>
    </div>
  </div>`;
}

function mount() {
  const active = document.body.dataset.page || '';
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = headerHTML(active);
  if (footer) footer.innerHTML = footerHTML();

  // Mobiles Menü auf-/zuklappen.
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // CTAs verdrahten (jetzt existiert auch der Footer-Play-Link).
  initCTAs();

  // Konto-Button (nur aktiv, wenn Supabase in config.js hinterlegt ist).
  try { mountAccountHeader(); } catch (_) {}
}

// PLAY_URL wird in initCTAs über config.js genutzt; Import hier nur, um die
// Abhängigkeit sichtbar zu halten (kein direkter Gebrauch nötig).
void PLAY_URL;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
