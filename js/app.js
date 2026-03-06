/**
 * app.js — Application Bootstrap & Screen Controller
 *
 * Responsibilities:
 *   1. Initialize Firebase (auth + Firestore) via imported modules
 *   2. Run the startup sequence: auth → profile → progressions → today's schedule
 *   3. Show the correct screen after initialization
 *   4. Manage screen navigation (Today / History / Progressions)
 *   5. Monitor online/offline status and show the banner accordingly
 *   6. Expose a global app state object (window._app) for use by other modules
 *   7. Show toast notifications
 *
 * Depends on (Phase 2 modules — already in repo):
 *   js/firebase-config.js   — Firebase app + db + auth instances
 *   js/auth.js              — initAuth(), getCurrentUID()
 *   js/firestore.js         — getProfile(), saveProfile(), getProgressions(), getLog(), todayStr()
 *   js/exercises.js         — EXERCISES array, getScheduledExercises()
 *   js/scheduler.js         — getDayNumber(), getScheduledExerciseIds()
 *   js/progression.js       — getCurrentLevel()
 *
 * Called by: index.html  (<script type="module" src="js/app.js"></script>)
 * Calls into: logger.js (T3.4), history.js (T3.5), progressions-ui.js (T3.6) — these
 *             modules are not yet written; app.js exposes hooks they will call once added.
 *
 * Screen IDs (must match index.html):
 *   #screen-loading       — shown during init, hidden after
 *   #screen-log           — Today screen (main)
 *   #screen-history       — 30-day history table
 *   #screen-progressions  — Progression management
 *
 * Nav button IDs (must match index.html):
 *   #nav-today, #nav-history, #nav-progressions
 *
 * Global state (window._app):
 *   uid          {string}   — Anonymous Firebase UID
 *   profile      {object}   — Patient profile from Firestore
 *   progressions {object}   — Map of exerciseId → current level
 *   todayLog     {object}   — Map of exerciseId → log entry for today
 *   todayIds     {string[]} — Exercise IDs scheduled for today
 *   dayNumber    {number}   — Days since surgery start (1-based)
 *   currentScreen {string} — Active screen name
 *   surgeryStart {string}  — ISO date string (YYYY-MM-DD)
 */

import { initAuth, getCurrentUID }              from './auth.js';
import { getProfile, saveProfile,
         getProgressions, getLog, todayStr }    from './firestore.js';
import { EXERCISES }                            from './exercises.js';
import { getDayNumber, getScheduledExerciseIds } from './scheduler.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCREENS = {
  loading:      'screen-loading',
  log:          'screen-log',
  history:      'screen-history',
  progressions: 'screen-progressions',
};

const NAV_MAP = {
  'nav-today':        'log',
  'nav-history':      'history',
  'nav-progressions': 'progressions',
};

// ─── Global app state ─────────────────────────────────────────────────────────

window._app = {
  uid:           null,
  profile:       null,
  progressions:  {},
  todayLog:      {},
  todayIds:      [],
  dayNumber:     0,
  currentScreen: 'loading',
  surgeryStart:  null,
};

// ─── Screen management ───────────────────────────────────────────────────────

/**
 * Shows one screen and hides all others.
 * Updates nav button active state.
 * @param {string} screenName — key from SCREENS object (e.g. 'log', 'history')
 */
function showScreen(screenName) {
  // Hide all screens
  Object.values(SCREENS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show the requested screen
  const targetId = SCREENS[screenName];
  const target = document.getElementById(targetId);
  if (target) {
    target.style.display = '';  // remove inline style, let CSS control display
  } else {
    console.error(`app.js showScreen: element #${targetId} not found`);
  }

  // Update nav button active states
  Object.entries(NAV_MAP).forEach(([btnId, screen]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.toggle('active', screen === screenName);
      btn.setAttribute('aria-current', screen === screenName ? 'page' : 'false');
    }
  });

  window._app.currentScreen = screenName;
  console.log('app.js: screen →', screenName);
}

// ─── Toast notifications ─────────────────────────────────────────────────────

/**
 * Shows a toast message.
 * @param {string} message   — Text to display
 * @param {'success'|'error'|'warn'} type — Visual style (default: 'success')
 * @param {number} duration  — Duration in ms before auto-hide (default: 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;

  // Clear any existing timer
  if (toast._hideTimer) clearTimeout(toast._hideTimer);

  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, duration);
}

// Expose so other modules can call it
window._app.showToast = showToast;

// ─── Online / Offline banner ─────────────────────────────────────────────────

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  if (navigator.onLine) {
    banner.style.display = 'none';
    banner.setAttribute('aria-hidden', 'true');
  } else {
    banner.style.display = '';
    banner.setAttribute('aria-hidden', 'false');
  }
}

window.addEventListener('online',  updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);

// ─── Loading screen label ────────────────────────────────────────────────────

/**
 * Updates the "Connecting…" text on the loading screen.
 * Helps give the user a sense of progress during init.
 * @param {string} text
 */
function setLoadingLabel(text) {
  const el = document.getElementById('loading-label');
  if (el) el.textContent = text;
}

// ─── Header update ───────────────────────────────────────────────────────────

/**
 * Updates the app header: day badge, formatted date, completion indicator.
 * Called after the today screen is populated.
 * @param {number} dayNumber
 * @param {number} totalScheduled  — total exercises due today
 * @param {number} totalLogged     — exercises logged so far today
 */
function updateHeader(dayNumber, totalScheduled, totalLogged) {
  const dayBadge  = document.getElementById('day-badge');
  const dateLabel = document.getElementById('header-date');
  const doneIcon  = document.getElementById('completion-indicator');

  if (dayBadge)  dayBadge.textContent  = `Day ${dayNumber}`;
  if (dateLabel) dateLabel.textContent = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const allDone = totalScheduled > 0 && totalLogged >= totalScheduled;
  if (doneIcon) {
    doneIcon.classList.toggle('completion--done', allDone);
    doneIcon.setAttribute('aria-label', allDone
      ? 'All exercises complete'
      : `${totalLogged} of ${totalScheduled} exercises logged`
    );
    doneIcon.title = doneIcon.getAttribute('aria-label');
  }
}

// Expose so logger.js can call it after each log action
window._app.updateHeader = updateHeader;

// ─── Navigation wiring ───────────────────────────────────────────────────────

function wireNavigation() {
  Object.entries(NAV_MAP).forEach(([btnId, screenName]) => {
    const btn = document.getElementById(btnId);
    if (!btn) {
      console.warn(`app.js wireNavigation: #${btnId} not found`);
      return;
    }

    btn.addEventListener('click', () => {
      if (window._app.currentScreen === screenName) return; // already here

      showScreen(screenName);

      // Notify the screen module to refresh its content if it exports a refresh fn
      switch (screenName) {
        case 'history':
          if (window._historyModule?.refresh) window._historyModule.refresh();
          break;
        case 'progressions':
          if (window._progressionsModule?.refresh) window._progressionsModule.refresh();
          break;
        case 'log':
          if (window._loggerModule?.refresh) window._loggerModule.refresh();
          break;
      }
    });
  });
}

// ─── Startup sequence ────────────────────────────────────────────────────────

/**
 * Main initialization sequence.
 * Steps:
 *   1. Show loading screen (already visible from HTML)
 *   2. Set up offline banner
 *   3. Initialize Firebase anonymous auth → get UID
 *   4. Load patient profile from Firestore (create default if first visit)
 *   5. Derive day number from surgery start date
 *   6. Load today's progressions and log entries
 *   7. Populate global state
 *   8. Wire navigation
 *   9. Switch to Today screen
 *  10. Signal logger.js to render exercise cards (T3.4)
 */
async function init() {
  try {
    // ── Step 2: Offline banner ──────────────────────────────────────────────
    updateOfflineBanner();

    // ── Step 3: Auth ────────────────────────────────────────────────────────
    setLoadingLabel('Authenticating…');
    const uid = await initAuth();
    window._app.uid = uid;
    console.log('app.js: auth OK, uid =', uid);

    // ── Step 4: Profile ─────────────────────────────────────────────────────
    setLoadingLabel('Loading profile…');
    let profile = await getProfile(uid);

    if (!profile) {
      // First visit — create a default profile.
      // Surgery start defaults to today so the app is immediately usable.
      // The patient or clinician can update this via settings (future task).
      const defaultProfile = {
        surgeryDate: todayStr(),    // ISO YYYY-MM-DD
        name: 'Patient',
        createdAt: new Date().toISOString(),
      };
      await saveProfile(uid, defaultProfile);
      profile = defaultProfile;
      console.log('app.js: first visit — default profile created');
    }

    window._app.profile      = profile;
    window._app.surgeryStart = profile.surgeryDate;

    // ── Step 5: Day number ──────────────────────────────────────────────────
    const dayNumber = getDayNumber(profile.surgeryDate);
    window._app.dayNumber = dayNumber;
    console.log('app.js: dayNumber =', dayNumber);

    // ── Step 6: Today's schedule, progressions, and log ─────────────────────
    setLoadingLabel('Loading exercises…');

    const [progressions, todayLog] = await Promise.all([
      getProgressions(uid),
      getLog(uid, todayStr()),
    ]);

    window._app.progressions = progressions || {};
    window._app.todayLog     = todayLog     || {};

    // Determine which exercise IDs are scheduled for today
    const todayIds = getScheduledExerciseIds(dayNumber);
    window._app.todayIds = todayIds;
    console.log('app.js: todayIds =', todayIds);

    // ── Step 7: Header ──────────────────────────────────────────────────────
    const loggedCount = todayIds.filter(id => window._app.todayLog[id]).length;
    updateHeader(dayNumber, todayIds.length, loggedCount);

    // ── Step 8: Wire navigation ─────────────────────────────────────────────
    wireNavigation();

    // ── Step 9: Switch to Today screen ─────────────────────────────────────
    showScreen('log');

    // ── Step 10: Signal logger module ──────────────────────────────────────
    // logger.js (T3.4) will attach to window._loggerModule and call renderExerciseList().
    // Because modules load asynchronously, we dispatch a custom event that
    // logger.js listens for — this avoids tight coupling and load-order issues.
    window.dispatchEvent(new CustomEvent('app:ready', {
      detail: {
        uid,
        profile,
        dayNumber,
        todayIds,
        progressions: window._app.progressions,
        todayLog:     window._app.todayLog,
      }
    }));

    console.log('app.js: init complete — app:ready dispatched');

  } catch (err) {
    console.error('app.js: init failed:', err);
    setLoadingLabel('Could not connect. Please check your internet connection and reload.');

    // Keep the loading screen visible but show the error label.
    // Do NOT navigate away — there is no meaningful screen to show
    // without a UID and profile.
    showToast('Connection failed. Please reload.', 'error', 10000);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

// DOMContentLoaded is guaranteed to have fired by the time a module script runs
// when the <script> tag is at the end of <body>. But we use it defensively.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}