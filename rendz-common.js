/* ============================================================
   rendz-common.js — JavaScript partagé Rendz
   Utilisé par : medecin.html, assistante.html, admin.html,
                 patient.html, cabinet.html
   ============================================================ */

// ── CONFIGURATION SUPABASE ────────────────────────────────────────────────────
const SUPABASE_URL = 'https://rynxvdqjplqccekulcfe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5bnh2ZHFqcGxxY2Nla3VsY2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDY5ODQsImV4cCI6MjA4NzcyMjk4NH0.Ab-HQgVhGzxdyXbY8xeFF0HveQGxstNgEIUeELVPWk8';

// Headers prêts à l'emploi
const SB_H  = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
const SB_HJ = { ...SB_H, 'Content-Type': 'application/json' };

// ── SHA-256 (Web Crypto API — natif, aucune dépendance) ───────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── TOAST SYSTEM ──────────────────────────────────────────────────────────────
// Usage : showToast('Message', 'success' | 'error' | 'warning' | 'info', ms?)
(function () {
  const ICONS = { success: '✅', error: '⛔', warning: '⚠️', info: 'ℹ️' };

  function showToast(msg, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.style.setProperty('--dur', duration + 'ms');
    t.innerHTML = `
      <span class="toast-icon">${ICONS[type] || 'ℹ️'}</span>
      <span class="toast-msg">${msg}</span>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
      <div class="toast-bar"></div>`;
    container.appendChild(t);
    const timer = setTimeout(() => {
      t.classList.add('hide');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    }, duration);
    t.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
  }

  window.showToast = showToast;
})();

// ── MODAL SYSTÈME ─────────────────────────────────────────────────────────────
// Nécessite dans le HTML : <div class="modal-overlay" id="modalOverlay">…</div>
let _pendingAction = null;

function showModal(icon, title, msg, confirmClass, action) {
  document.getElementById('modalIcon').textContent  = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent   = msg;
  const btn = document.getElementById('modalConfirm');
  btn.className = `modal-confirm ${confirmClass}`;
  btn.textContent = 'Confirmer';
  _pendingAction = action;
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  _pendingAction = null;
}

async function confirmAction() {
  const action = _pendingAction;
  closeModal();
  if (action) await action();
}

// ── RÉINITIALISATION AUTOMATIQUE CHAQUE MATIN ────────────────────────────────
// Appeler après avoir chargé les params Supabase du cabinet.
// Si le jour a changé → remet numero_en_cours=0, ouvert=false, derniere_date=today.
async function checkAutoReset(params, cabinetId) {
  const today       = new Date().toISOString().split('T')[0];
  const derniereDate = params.derniere_date || '';
  if (derniereDate === today) return;

  await fetch(`${SUPABASE_URL}/rest/v1/parametres?cabinet_id=eq.${cabinetId}`, {
    method: 'PATCH',
    headers: SB_HJ,
    body: JSON.stringify({ numero_en_cours: 0, ouvert: false, derniere_date: today })
  });
  console.log(`[Rendz] Nouveau jour (${today}) — Compteur remis à zéro.`);
}

// ── RECHERCHE + FILTRES ───────────────────────────────────────────────────────
// fullList  : tableau complet des patients (mis à jour après chaque fetch)
// renderFilteredList(list, q) : fonction à définir dans chaque page
let fullList     = [];
let activeFilter = 'all';

function setFilter(f, el) {
  activeFilter = f;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  applyFilters();
}

function applyFilters() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let filtered = fullList;

  if (activeFilter !== 'all') {
    filtered = filtered.filter(p => (p.statut || 'en_attente') === activeFilter);
  }
  if (q) {
    filtered = filtered.filter(p =>
      (p.nom       || '').toLowerCase().includes(q) ||
      (p.prenom    || '').toLowerCase().includes(q) ||
      (p.telephone || '').includes(q)
    );
  }

  const countEl = document.getElementById('searchCount');
  if (countEl) {
    countEl.textContent = (q || activeFilter !== 'all')
      ? `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}`
      : '';
  }

  if (typeof renderFilteredList === 'function') renderFilteredList(filtered, q);
}

function highlight(text, q) {
  if (!q || !text) return text || '';
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="highlight">$1</mark>');
}
