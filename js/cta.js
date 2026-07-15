// Verdrahtet alle Call-to-Action-Buttons zentral aus config.js.
// Verwendung im HTML:
//   <a data-cta="appstore" ...>…</a>   -> App-Store-Link ODER "Bald verfügbar"
//   <a data-cta="play" ...>…</a>       -> Web-Version (PLAY_URL)
import { APP_STORE_URL, PLAY_URL } from './config.js';

function wireAppStore(el) {
  if (APP_STORE_URL) {
    el.href = APP_STORE_URL;
    el.target = '_blank';
    el.rel = 'noopener';
    el.classList.remove('is-soon');
    el.removeAttribute('aria-disabled');
  } else {
    // Noch kein Store-Link: Button als "Bald verfügbar" markieren und Klick sperren.
    el.classList.add('is-soon');
    el.setAttribute('aria-disabled', 'true');
    el.removeAttribute('href');
    el.addEventListener('click', (e) => e.preventDefault());
    const label = el.querySelector('[data-cta-label]');
    if (label) label.textContent = 'Bald im App Store';
  }
}

function wirePlay(el) {
  el.href = PLAY_URL;
  el.target = '_blank';
  el.rel = 'noopener';
}

export function initCTAs() {
  document.querySelectorAll('[data-cta="appstore"]').forEach(wireAppStore);
  document.querySelectorAll('[data-cta="play"]').forEach(wirePlay);
}

// Auto-Start entfällt: layout.js ruft initCTAs() auf, nachdem Header/Footer
// eingefügt sind (sonst wären die Buttons in der injizierten Fußzeile noch nicht da).
