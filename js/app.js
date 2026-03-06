/**
 * app.js — Application Bootstrap & Startup Sequence
 *
 * Implements the 9-step startup sequence per Functional Specification Section 6.1.
 * Screen switching and toast notifications are delegated to ui.js.
 *
 * Startup sequence:
 *   Step 1 — Show loading screen (already visible from HTML default)
 *   Step 2 — Monitor online/offline state
 *   Step 3 — Initialize Firebase anonymous auth → get UID
 *   Step 4 — Load patient profile from Firestore (create default on first visit)
 *   Step 5 — Derive day number from surgery start date
 *   Step 6 — Load today's progressions and log entries (parallel)
 *   Step 7 — Determine scheduled exercise IDs for today
 *   Step 8 — Update header (day badge, date, completion indicator)
 *   Step 9 — Wire navigation, hide loading screen, show Today screen
 *             Dispatch 'app:ready' event for logger.js (T3.4) to consume
 *
 * Depends on:
 *   js/ui.js          — showScreen(), showToast(), setLoadingLabel(), updateOfflineBanner()
 *   js/auth.js        — initAuth(), getCurrentUID()
 *   js/firestore.js   — getProfile(), saveProfile(), getProgressions(), getLog(), todayStr()
 *   js/exercises.js   — EXERCISES array
 *   js/scheduler.js   — getDayNumber(), getScheduledExerciseIds()
 *
 * Called by: index.html  <script type="module" src="js/app.js"></script>
 *
 * Global state exposed via window._app (read by logger.js, history.js, progressions-ui.js):
 *   uid           {string}    — anonymous Firebase UID
 *   profile       {object}    — patient profile from Firestore
 *   progressions  {object}    — map of exerciseId → current level
 *   todayLog      {object}    — map of exerciseId → log entry for today
 *   todayIds      {string[]}  — exercise IDs scheduled for today
 *   dayNumber     {number}    — recovery day number (1-based)
 *   surgeryStart  {string}    — ISO date YYYY-MM-DD
 *   currentScreen {string}    — currently visible screen name
 *   showToast     {function}  — proxy to ui.js showToast (for convenience)
 *   updateHeader  {function}  — callable by logger.js after each log action
 */

import {
  showScreen,
  setLoadingLabel,
  updateOfflineBanner,
  showToast,
} from './ui.js';

import { initAuth }                              from './auth.js';
import { getProfile, saveProfile,
         getProgressions, getLog, todayStr }     from './firestore.js';
import { getDayNumber, getScheduledExerciseIds } from './scheduler.js';

// ─── Global app state ─────────────────────────────────────────────────────────

window._app = {
  uid:           null,
  profile:       null,
  progressions:  {},
  todayLog:      {},
  todayIds:      [],
  dayNumber:     0,
  surgeryStart:  null,
  currentScreen: 'loading',

  // Proxy convenience methods so other modules can call window._app.showToast()
  // without importing ui.js themselves.
  showToast,
  updateHeader: null,   // assigned below after function declaration
};

// ─── Navigation wiring ────────────────────────────────────────────────────────

const NAV_MAP = {
  'nav-today':        'log',
  'nav-history':      'history',
  'nav-progressions': 'progressions',
};

function wireNavigation() {
  Object.entries(NAV_MAP).forEach(([btnId, screenName]) => {
    const btn = document.getElementById(btnId);
    if (!btn) {
      console.warn(`app.js wireNavigation: #${btnId} not found`);
      return;
    }

    btn.addEventListener('click', () => {
      if (window._app.currentScreen === screenName) return;

      showScreen(screenName);
      window._app.currentScreen = screenName;

      // Notify screen modules to refresh content if they are ready
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

// ─── Header update ────────────────────────────────────────────────────────────

/**
 * Updates the app header: day badge, formatted date, completion ring.
 * Called once during init and again by logger.js after each log/update action.
 *
 * @param {number} dayNumber
 * @param {number} totalScheduled  — exercises due today
 * @param {number} totalLogged     — exercises logged so far today
 */
function updateHeader(dayNumber, totalScheduled, totalLogged) {
  const dayBadge  = document.getElementById('day-badge');
  const dateLabel = document.getElementById('header-date');
  const doneIcon  = document.getElementById('completion-indicator');

  if (dayBadge) dayBadge.textContent = `Day ${dayNumber}`;

  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  const allDone = totalScheduled > 0 && totalLogged >= totalScheduled;
  if (doneIcon) {
    doneIcon.classList.toggle('completion--done', allDone);
    const label = allDone
      ? 'All exercises complete'
      : `${totalLogged} of ${totalScheduled} exercises logged`;
    doneIcon.setAttribute('aria-label', label);
    doneIcon.title = label;
  }
}

// Expose so logger.js can refresh the header without importing app.js
window._app.updateHeader = updateHeader;

// ─── Startup sequence ─────────────────────────────────────────────────────────

async function init() {
  try {

    // ── Step 2: Online/offline banner ───────────────────────────────────────
    updateOfflineBanner();
    window.addEventListener('online',  updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);

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
      // Surgery start defaults to today so the app works immediately.
      // The clinician can update the surgery date via the profile screen (future task).
      const defaultProfile = {
        surgeryDate: todayStr(),
        name:        'Patient',
        createdAt:   new Date().toISOString(),
      };
      await saveProfile(uid, defaultProfile);
      profile = defaultProfile;
      console.log('app.js: first visit — default profile created, surgeryDate =', defaultProfile.surgeryDate);
    }

    window._app.profile      = profile;
    window._app.surgeryStart = profile.surgeryDate;

    // ── Step 5: Day number ──────────────────────────────────────────────────
    const dayNumber = getDayNumber(profile.surgeryDate);
    window._app.dayNumber = dayNumber;
    console.log('app.js: dayNumber =', dayNumber);

    // ── Step 6: Progressions + today's log (parallel) ───────────────────────
    setLoadingLabel('Loading exercises…');

    const [progressions, todayLog] = await Promise.all([
      getProgressions(uid),
      getLog(uid, todayStr()),
    ]);

    window._app.progressions = progressions || {};
    window._app.todayLog     = todayLog     || {};

    // ── Step 7: Today's schedule ────────────────────────────────────────────
    const todayIds = getScheduledExerciseIds(dayNumber);
    window._app.todayIds = todayIds;
    console.log('app.js: todayIds =', todayIds);

    // ── Step 8: Header ──────────────────────────────────────────────────────
    const loggedCount = todayIds.filter(id => window._app.todayLog[id]).length;
    updateHeader(dayNumber, todayIds.length, loggedCount);

    // ── Step 9: Wire nav, show Today screen ─────────────────────────────────
    wireNavigation();
    showScreen('log');
    window._app.currentScreen = 'log';

    // Dispatch app:ready so logger.js can render exercise cards.
    // Using a custom event decouples loading order — logger.js loads independently
    // and listens for this event rather than being called directly.
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

    console.log('app.js: startup complete — app:ready dispatched');

  } catch (err) {
    // Keep the loading screen visible so the patient sees the error label.
    // Do not navigate away — there is no usable state without a UID and profile.
    console.error('app.js: startup failed:', err);
    setLoadingLabel('Could not connect. Please check your internet connection and reload.');
    showToast('Connection failed — please reload the page.', 'error', 0); // duration 0 = persist
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// A module script runs after the DOM is parsed, so DOMContentLoaded has
// almost certainly already fired — but we guard defensively anyway.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}