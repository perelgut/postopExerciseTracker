// ui.js — UI utilities: screen switching, toast notifications, offline banner, header update.
// All direct DOM manipulation shared across screens lives here.
// Other modules import from this file — they do not touch screens or toasts directly.
//
// Depends on: nothing — zero local imports, no circular dependency risk.
//
// DOM references verified against index.html:
//   Screens:           #screen-loading, #screen-signin, #screen-log,
//                      #screen-history, #screen-progressions
//   Loading label:     .loading-label  (class selector — element has no id)
//   Offline banner:    #offline-banner
//   Toast:             #toast
//   Nav buttons:       .nav-btn[data-screen]  (no id attributes on nav buttons)
//   Day badge:         #hdr-day-label
//   Date label:        #hdr-date
//   Completion badge:  #hdr-completion

// ── Screen registry ────────────────────────────────────────────────────────────

// All screen div IDs present in index.html.
// Order does not matter — used only for hide-all iteration.
const ALL_SCREENS = [
  'screen-loading',
  'screen-signin',
  'screen-log',
  'screen-history',
  'screen-progressions',
];

// ── Screen switching ───────────────────────────────────────────────────────────

/**
 * Hides all screens and reveals the requested one.
 * Syncs the nav button active state via .nav-btn--active class and aria-current.
 *
 * Note: screen-loading has no nav button — calling showScreen('screen-loading')
 * will correctly remove the active class from all nav buttons.
 *
 * @param {string} screenId — must be one of ALL_SCREENS, e.g. 'screen-log'
 */
function showScreen(screenId) {
  if (!ALL_SCREENS.includes(screenId)) {
    console.error(`ui.js showScreen: unknown screenId "${screenId}"`);
    return;
  }

  // Hide every screen by setting inline display:none
  ALL_SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show the target by removing the inline override (lets CSS decide display value)
  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = '';
  } else {
    console.error(`ui.js showScreen: #${screenId} not found in DOM`);
    return;
  }

  // Sync nav button active state.
  // Buttons use class .nav-btn and data-screen attribute — they have no id attributes.
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.screen === screenId;
    btn.classList.toggle('nav-btn--active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  console.log('ui.js: screen →', screenId);
}

// ── Loading label ──────────────────────────────────────────────────────────────

/**
 * Updates the status text shown on the loading screen.
 * Element is a <p class="loading-label"> — no id, so use querySelector.
 * Safe to call before DOM is fully ready — silently no-ops if element absent.
 *
 * @param {string} text
 */
function setLoadingLabel(text) {
  const el = document.querySelector('.loading-label');
  if (el) el.textContent = text;
}

// ── Offline banner ─────────────────────────────────────────────────────────────

/**
 * Shows or hides #offline-banner based on navigator.onLine.
 * Call on app startup and on window 'online' / 'offline' events.
 */
function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const online = navigator.onLine;
  banner.style.display = online ? 'none' : '';
  banner.setAttribute('aria-hidden', String(online));
}

// ── Toast notifications ────────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Displays a floating toast notification in #toast.
 * Rapid successive calls cancel the previous auto-hide timer.
 *
 * @param {string} message
 * @param {'success'|'error'|'warn'} [type='success']  — controls CSS modifier class
 * @param {number} [duration=3000]  — ms before auto-hide; 0 = stays until next call
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    // Fallback so nothing is silently swallowed during early startup
    console.warn(`ui.js showToast [${type}]: ${message}`);
    return;
  }

  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }

  toast.textContent = message;

  // Reset to base class then apply modifier
  toast.className = 'toast';
  toast.classList.add(`toast--${type}`, 'toast--visible');

  if (duration > 0) {
    _toastTimer = setTimeout(() => {
      toast.classList.remove('toast--visible');
      _toastTimer = null;
    }, duration);
  }
}

// ── Header update ──────────────────────────────────────────────────────────────

/**
 * Updates the log-screen header: day badge, date string, and completion indicator.
 * Called by app.js on startup and by logger.js after each log or update action.
 *
 * Completion badge CSS classes (defined in styles.css):
 *   .completion-badge--pending  — default amber ring
 *   .completion-badge--done     — green checkmark state
 *
 * @param {number} dayNumber       — recovery day number (1-based)
 * @param {number} totalScheduled  — exercises scheduled for today
 * @param {number} totalLogged     — exercises logged so far today
 */
function updateHeader(dayNumber, totalScheduled, totalLogged) {
  const dayBadge  = document.getElementById('hdr-day-label');
  const dateLabel = document.getElementById('hdr-date');
  const badge     = document.getElementById('hdr-completion');

  if (dayBadge) {
    dayBadge.textContent = `Day ${dayNumber}`;
  }

  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  if (badge) {
    const allDone = totalScheduled > 0 && totalLogged >= totalScheduled;
    badge.classList.toggle('completion-badge--done',    allDone);
    badge.classList.toggle('completion-badge--pending', !allDone);
    const label = allDone
      ? 'All exercises complete'
      : `${totalLogged} of ${totalScheduled} exercises logged`;
    badge.setAttribute('aria-label', label);
    badge.title = label;
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

export {
  showScreen,
  setLoadingLabel,
  updateOfflineBanner,
  showToast,
  updateHeader,
};