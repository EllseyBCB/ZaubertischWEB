// Rendert das Shop-SCHAUFENSTER der Website aus der Original-Datenquelle des
// Spiels (js/shop-catalog.js, unverändert aus WIZ-WIZ übernommen). Reine
// Anzeige: Es wird NICHTS gekauft – echte Käufe laufen in der App über Apple
// StoreKit. Bei künftigen Shop-Änderungen einfach shop-catalog.js + Assets neu
// aus WIZ-WIZ kopieren, dieses Schaufenster übernimmt sie automatisch.
import {
  SHOP_SECTIONS, CRYSTAL_PACKS, RARITY, CHEST_TIERS,
} from './shop-catalog.js';
import { ASSET_BASE, AUTH_CONFIGURED } from './config.js';
import {
  hasStoredSession, refreshWallet, buyItem, buyChest, toast,
} from './auth.js';

// Kaufzustand des angemeldeten Nutzers (für Kauf-Buttons).
let loggedIn = false;
let myCrystals = null;         // null = unbekannt/ausgeloggt
let owned = new Set();         // besessene Katalog-Artikel (item_id)

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Gemaltes Kristall-Symbol (ersetzt das 💎-Emoji in den Preisen).
const CRYSTAL = '<img class="crystal-ic" src="assets/icons/kristall.png" alt="Kristalle">';

// Seltenheits-Badge (Farbe + Label aus dem Katalog).
function rarityBadge(rarity) {
  const r = RARITY[rarity];
  if (!r) return '';
  return `<span class="rarity" style="--rar:${r.color}">${esc(r.label)}</span>`;
}

// Kristall-Preis-Zeile (In-Game-Währung).
function crystalCost(cost, free) {
  if (free || cost === 0) return `<span class="cost cost-free">Gratis</span>`;
  return `<span class="cost">${CRYSTAL}${Number(cost).toLocaleString('de-DE')}</span>`;
}

// Bild ODER Emoji-Fallback (wie im Spiel): fehlt/lädt das Bild nicht, wird das
// Emoji-Icon eingeblendet.
function thumb(item) {
  const emoji = `<span class="thumb-emoji" aria-hidden="true">${esc(item.icon || '✨')}</span>`;
  if (!item.img) return emoji;
  const src = ASSET_BASE + item.img;
  return `<img class="thumb-img" src="${esc(src)}" alt="${esc(item.name)}" loading="lazy"
            onerror="this.remove();this.parentNode.querySelector('.thumb-emoji').style.display='flex'">
          <span class="thumb-emoji thumb-emoji-hidden" aria-hidden="true">${esc(item.icon || '✨')}</span>`;
}

// Kauf-Aktion je nach Zustand (nur wenn Anmeldung aktiv). Rückgabe = HTML.
//  free/Standard → „Gratis" · im Besitz → Badge · genug → Kaufen · zu wenig →
//  deaktiviert · ausgeloggt → „Anmelden".
function buyAction(item) {
  if (!AUTH_CONFIGURED) return '';
  if (item.free || item.cost === 0 || item.isDefault) return `<span class="owned-badge">Gratis</span>`;
  if (!loggedIn) return `<a class="btn-buy btn-buy-login" href="konto.html">Anmelden zum Kaufen</a>`;
  if (owned.has(item.id)) return `<span class="owned-badge">✓ Im Besitz</span>`;
  if (myCrystals != null && myCrystals >= item.cost) {
    return `<button class="btn-buy" type="button" data-buy-item="${esc(item.id)}">Kaufen</button>`;
  }
  return `<button class="btn-buy" type="button" disabled>Zu wenig</button>`;
}

// Eine Katalog-Kachel (Avatar/Deck/Spielfeld/Rückseite).
function catalogTile(item) {
  return `
  <li class="tile">
    <div class="tile-thumb">${thumb(item)}</div>
    <div class="tile-body">
      <div class="tile-name">${esc(item.name)}</div>
      <div class="tile-meta">
        ${rarityBadge(item.rarity)}
        ${crystalCost(item.cost, item.free)}
      </div>
      ${buyAction(item)}
    </div>
  </li>`;
}

// Kristall-Paket-Kachel (Echtgeld-Anzeigepreis).
function packTile(p) {
  const total = p.amount + (p.bonus || 0);
  const bonus = p.bonus ? `<span class="pack-bonus">+${p.bonus} Bonus</span>` : '';
  const tag = p.tag ? `<span class="tile-tag">${esc(p.tag)}</span>` : '';
  const src = ASSET_BASE + (p.img || '');
  return `
  <li class="tile tile-pack">
    ${tag}
    <div class="tile-thumb">
      <img class="thumb-img" src="${esc(src)}" alt="${esc(p.amount)} Kristalle" loading="lazy"
        onerror="this.remove();this.parentNode.querySelector('.thumb-emoji').style.display='flex'">
      <span class="thumb-emoji thumb-emoji-hidden" aria-hidden="true">${CRYSTAL}</span>
    </div>
    <div class="tile-body">
      <div class="tile-name">${Number(p.amount).toLocaleString('de-DE')} Kristalle</div>
      <div class="pack-total">${bonus}<span class="pack-sum">= ${total.toLocaleString('de-DE')} ${CRYSTAL}</span></div>
      <div class="tile-meta"><span class="price">${esc(p.priceEUR)}</span></div>
    </div>
  </li>`;
}

// Truhen-Kachel.
function chestTile(c) {
  return `
  <li class="tile tile-chest" style="--rar:${c.color}">
    <div class="tile-thumb">
      <img class="thumb-img chest-img" src="assets/icons/chest-${esc(c.rarity)}.png" alt="${esc(c.label)}" loading="lazy"
        onerror="this.remove();this.parentNode.querySelector('.thumb-emoji').style.display='flex'">
      <span class="thumb-emoji chest-emoji thumb-emoji-hidden" aria-hidden="true">${esc(c.emoji)}</span>
    </div>
    <div class="tile-body">
      <div class="tile-name">${esc(c.label)}</div>
      <div class="tile-meta">${crystalCost(c.price)}</div>
      ${chestAction(c)}
    </div>
  </li>`;
}

// Kauf-Aktion für Truhen (Truhen sind Verbrauchsware → immer kaufbar).
function chestAction(c) {
  if (!AUTH_CONFIGURED) return '';
  if (!loggedIn) return `<a class="btn-buy btn-buy-login" href="konto.html">Anmelden zum Kaufen</a>`;
  if (myCrystals != null && myCrystals >= c.price) {
    return `<button class="btn-buy" type="button" data-buy-chest="${esc(c.rarity)}">Kaufen</button>`;
  }
  return `<button class="btn-buy" type="button" disabled>Zu wenig</button>`;
}

function block(title, subtitle, tilesHtml, extraClass = '') {
  return `
  <div class="shop-block">
    <div class="shop-block-head">
      <h3>${esc(title)}</h3>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
    </div>
    <ul class="tile-grid ${extraClass}">${tilesHtml}</ul>
  </div>`;
}

export function renderShowcase(rootId = 'shop-showcase') {
  const root = document.getElementById(rootId);
  if (!root) return;

  const parts = [];

  // 1) Kristall-Pakete (Echtgeld)
  parts.push(block(
    'Kristalle', 'Die Premium-Währung – schaltet Avatare, Decks, Tische und Truhen frei.',
    CRYSTAL_PACKS.map(packTile).join(''), 'grid-packs'
  ));

  // 2) Katalog-Sektionen aus dem Spiel (Avatare, Decks, Spielfelder, Rückseiten)
  const subtitles = {
    avatar: 'Zeig, wer am Tisch sitzt – von gewöhnlich bis mythisch.',
    deck:   'Eigene Kartenmotive für dein Blatt.',
    table:  'Verwandle den Spieltisch in magische Welten.',
    back:   'Deine persönliche Kartenrückseite.',
  };
  for (const sec of SHOP_SECTIONS) {
    // Nur ECHTE Artikel zeigen: solche mit hinterlegter Grafik. Platzhalter
    // (nur Emoji, noch keine echte Ware im Original-Shop) werden ausgeblendet.
    const items = sec.items.filter(it => it.img);
    if (!items.length) continue;
    parts.push(block(sec.title, subtitles[sec.key] || '', items.map(catalogTile).join('')));
  }

  // 3) Truhen (Loot)
  parts.push(block(
    'Truhen', 'Öffne Truhen und ziehe zufällige Belohnungen.',
    CHEST_TIERS.map(chestTile).join(''), 'grid-chests'
  ));

  root.innerHTML = parts.join('');
}

// --- Kaufzustand laden + Klicks verdrahten ---------------------------------
function applyWallet(w) {
  loggedIn = !!w;
  myCrystals = w ? w.crystals : null;
  if (w && Array.isArray(w.inventory)) owned = new Set(w.inventory);
}

async function loadWallet() {
  if (!AUTH_CONFIGURED || !hasStoredSession()) { loggedIn = false; myCrystals = null; return; }
  applyWallet(await refreshWallet());  // löst 'wallet-updated' aus → Re-Render
  renderShowcase();
}

async function doBuyItem(btn) {
  const id = btn.dataset.buyItem;
  btn.disabled = true; btn.textContent = '…';
  const r = await buyItem(id);
  toast(r.message, r.ok ? 'ok' : 'err');
  if (r.ok) { owned.add(id); await refreshWallet(); }  // frisches Inventar/Guthaben
  renderShowcase();
}

async function doBuyChest(btn) {
  const rarity = btn.dataset.buyChest;
  btn.disabled = true; btn.textContent = '…';
  const r = await buyChest(rarity);
  toast(r.message, r.ok ? 'ok' : 'err');
  if (r.ok) await refreshWallet();
  renderShowcase();
}

function wireRoot(rootId = 'shop-showcase') {
  const root = document.getElementById(rootId);
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  root.addEventListener('click', (e) => {
    const itemBtn = e.target.closest('[data-buy-item]');
    const chestBtn = e.target.closest('[data-buy-chest]');
    if (itemBtn) { e.preventDefault(); doBuyItem(itemBtn); }
    else if (chestBtn) { e.preventDefault(); doBuyChest(chestBtn); }
  });
}

// Guthaben-Änderungen (Header/Kauf) → Zustand übernehmen + neu rendern.
window.addEventListener('wallet-updated', (e) => {
  const w = e.detail;
  if (w) {
    loggedIn = true;
    if (typeof w.crystals === 'number') myCrystals = w.crystals;
    if (Array.isArray(w.inventory)) owned = new Set(w.inventory);
    renderShowcase();
  }
});

function init() {
  renderShowcase();   // sofort (ausgeloggt-Zustand)
  wireRoot();
  loadWallet();       // bei aktiver Sitzung: Guthaben + Kauf-Buttons
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
