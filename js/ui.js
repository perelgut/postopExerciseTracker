/**
 * ui.js — UI Utilities: Screen Switching, Toast Notifications, Loading, Card Toggle
 *
 * This module owns all direct DOM manipulation that is shared across screens.
 * Other modules import from here — they do NOT manipulate screens or toasts directly.
 *
 * Exports:
 *   showScreen(screenName)               — hide all screens, show the target
 *   showToast(message, type, duration)   — floating notification (success/error/warn)
 *   setLoadingLabel(text)                — update the "Connecting…" label on loading screen
 *   updateOfflineBanner()                — sync offline banner to navigator.onLine
 *   toggleCard(exerciseId)               — expand/collapse an exercise card
 *   setCardLogged(exerciseId, entry)     — put a card into logged state
 *   setCardEditing(exerciseId, entry)    — put a logged card back into edit mode
 *   setCardError(exerciseId, message)    — show inline error on a card
 *
 * Screen names (must match index.html IDs with prefix "screen-"):
 *   'loading' | 'log' | 'history' | 'progressions'
 *
 * Nav button IDs (must match index.html):
 *   #nav-today | #nav-history | #nav-progressions
 *
 * Called by: app.js, logger.js (T3.4), history.js (T3.5), progressions-ui.js (T3.6)
 * Does NOT import from any other local module — zero circular dependency risk.
 */

// ─── Screen registry ─────────────────────────────────────────────────────────

const SCREEN_IDS = {
  loading:      'screen-loading',
  log:          'screen-log',
  history:      'screen-history',
  progressions: 'screen-progressions',
};

// Map nav button IDs to screen names
const NAV_SCREEN_MAP = {
  'nav-today':        'log',
  'nav-history':      'history',
  'nav-progressions': 'progressions',
};

// ─── Screen switching ─────────────────────────────────────────────────────────

/**
 * Hides all screens and shows the requested one.
 * Updates nav button aria/active state.
 * @param {string} screenName — one of 'loading' | 'log' | 'history' | 'progressions'
 */
function showScreen(screenName) {
  if (!SCREEN_IDS[screenName]) {
    console.error(`ui.js showScreen: unknown screen "${screenName}"`);
    return;
  }

  // Hide all screens
  Object.values(SCREEN_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show the target screen
  const target = document.getElementById(SCREEN_IDS[screenName]);
  if (target) {
    target.style.display = '';   // remove inline override, let CSS rule apply
  } else {
    console.error(`ui.js showScreen: element #${SCREEN_IDS[screenName]} not found in DOM`);
  }

  // Update nav button active states (loading screen has no nav button)
  Object.entries(NAV_SCREEN_MAP).forEach(([btnId, screen]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isActive = screen === screenName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  console.log('ui.js: screen →', screenName);
}

// Convenience wrappers used by app.js startup sequence
function showLoading() { showScreen('loading'); }
function hideLoading() { /* showScreen('log') is called explicitly by app.js */ }

// ─── Loading screen label ─────────────────────────────────────────────────────

/**
 * Updates the status text on the loading screen (e.g. "Authenticating…").
 * Safe to call before DOM is fully ready — will silently no-op if element absent.
 * @param {string} text
 */
function setLoadingLabel(text) {
  const el = document.getElementById('loading-label');
  if (el) el.textContent = text;
}

// ─── Offline banner ───────────────────────────────────────────────────────────

/**
 * Shows or hides the offline banner based on navigator.onLine.
 * Call this on startup and whenever online/offline events fire.
 */
function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  const online = navigator.onLine;
  banner.style.display = online ? 'none' : '';
  banner.setAttribute('aria-hidden', online ? 'true' : 'false');
}

// ─── Toast notifications ──────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Shows a floating toast notification.
 * @param {string} message                        — Text to display
 * @param {'success'|'error'|'warn'} [type]       — Visual style (default: 'success')
 * @param {number} [duration]                     — Auto-hide delay in ms (default: 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    // Fallback: at least log it so nothing is silently swallowed
    console.warn(`ui.js showToast [${type}]: ${message}`);
    return;
  }

  // Clear any running hide timer so rapid toasts don't fight each other
  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }

  toast.textContent = message;

  // Reset classes then apply new ones
  toast.className = '';
  toast.classList.add('toast', `toast--${type}`, 'toast--visible');

  _toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    _toastTimer = null;
  }, duration);
}

// ─── Exercise card toggle (expand / collapse) ─────────────────────────────────

/**
 * Expands a collapsed exercise card or collapses an expanded one.
 * The card element must have id="card-{exerciseId}".
 * The expandable body must have class="card__body".
 * The chevron icon must have class="card__chevron".
 *
 * @param {string|number} exerciseId
 */
function toggleCard(exerciseId) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) {
    console.warn(`ui.js toggleCard: #card-${exerciseId} not found`);
    return;
  }

  const isExpanded = card.classList.contains('card--expanded');

  if (isExpanded) {
    card.classList.remove('card--expanded');
    card.setAttribute('aria-expanded', 'false');
  } else {
    card.classList.add('card--expanded');
    card.setAttribute('aria-expanded', 'true');
  }
}

// ─── Exercise card state helpers ──────────────────────────────────────────────

/**
 * Transitions an exercise card into the "logged" state.
 * Hides the log form, shows the logged summary badge, adds the logged CSS modifier.
 *
 * @param {string|number} exerciseId
 * @param {{count: number, repeats: number, timeOfDay: string, level: number}} entry
 */
function setCardLogged(exerciseId, entry) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) return;

  card.classList.add('card--logged');
  card.classList.remove('card--expanded');
  card.setAttribute('aria-expanded', 'false');

  // Update the logged summary badge if it exists
  const summary = card.querySelector('.card__logged-summary');
  if (summary) {
    const typeLabel = entry.type === 'Time' ? 's' : 'r';
    summary.textContent =
      `P${entry.level} · ${entry.count}${typeLabel} × ${entry.repeats} · ${entry.timeOfDay}`;
    summary.style.display = '';
  }

  // Hide the log form, show the edit hint
  const form = card.querySelector('.card__log-form');
  if (form) form.style.display = 'none';
}

/**
 * Transitions a logged card back into edit mode.
 * Pre-fills the count and repeats inputs with previously saved values.
 * Changes the submit button label to "Update".
 *
 * @param {string|number} exerciseId
 * @param {{count: number, repeats: number, timeOfDay: string, level: number}} entry
 */
function setCardEditing(exerciseId, entry) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) return;

  card.classList.remove('card--logged');
  card.classList.add('card--expanded', 'card--editing');
  card.setAttribute('aria-expanded', 'true');

  // Show the log form
  const form = card.querySelector('.card__log-form');
  if (form) form.style.display = '';

  // Pre-fill inputs
  const countInput   = card.querySelector('.card__input-count');
  const repeatsInput = card.querySelector('.card__input-repeats');
  if (countInput)   countInput.value   = entry.count;
  if (repeatsInput) repeatsInput.value = entry.repeats;

  // Update submit button to "Update"
  const submitBtn = card.querySelector('.card__log-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Update';
    submitBtn.classList.add('card__log-btn--update');
  }

  // Hide the logged summary
  const summary = card.querySelector('.card__logged-summary');
  if (summary) summary.style.display = 'none';
}

/**
 * Shows an inline validation error message on an exercise card.
 * Clears automatically when the card is toggled or re-submitted.
 *
 * @param {string|number} exerciseId
 * @param {string} message
 */
function setCardError(exerciseId, message) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) return;

  let errorEl = card.querySelector('.card__error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'card__error';
    const form = card.querySelector('.card__log-form');
    if (form) form.appendChild(errorEl);
    else card.appendChild(errorEl);
  }

  errorEl.textContent = message;
  errorEl.style.display = '';
}

/**
 * Clears any inline error on an exercise card.
 * @param {string|number} exerciseId
 */
function clearCardError(exerciseId) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) return;
  const errorEl = card.querySelector('.card__error');
  if (errorEl) errorEl.style.display = 'none';
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  showScreen,
  showLoading,
  hideLoading,
  setLoadingLabel,
  updateOfflineBanner,
  showToast,
  toggleCard,
  setCardLogged,
  setCardEditing,
  setCardError,
  clearCardError,
};