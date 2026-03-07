// app.js — Application bootstrap and startup sequence.
//
// Implements the 9-step startup sequence per Functional Specification Section 6.1.
//
// Step 1 — Loading screen already visible from HTML default (no JS needed)
// Step 2 — Register online/offline listeners, sync offline banner
// Step 3 — initAuth() → UID
// Step 4 — getProfile() → create default profile on first visit
// Step 5 — getDayNumber() from profile.day1
// Step 6 — getProgressions() + getLog() in parallel
// Step 7 — getApplicableExercises() for today → todayExercises array
// Step 8 — updateHeader() with day number and completion counts
// Step 9 — Wire nav buttons, show screen-log, dispatch 'app:ready'
//
// Imports verified against actual Phase 2 source files:
//   ui.js         — showScreen, setLoadingLabel, updateOfflineBanner, showToast, updateHeader
//   auth.js       — initAuth() → Promise<string uid>
//   firestore.js  — getProfile, saveProfile, getProgressions, getLog, todayStr
//                   All return { success: boolean, data | error }
//   exercises.js  — EXERCISES array (id, name, displayName, frequency, maxProgression, progressions[])
//   scheduler.js  — getApplicableExercises(date, exercises) → filtered array
//                   getDayLabel(date) → string
//                   getDayNumber(day1Str) → number

import { showScreen, setLoadingLabel, updateOfflineBanner,
         showToast, updateHeader }                         from './ui.js';
import { initAuth }                                        from './auth.js';
import { getProfile, saveProfile, getProgressions,
         getLog, todayStr }                                from './firestore.js';
import { EXERCISES }                                       from './exercises.js';
import { getApplicableExercises, getDayLabel,
         getDayNumber }                                    from './scheduler.js';

// ── Global app state ───────────────────────────────────────────────────────────
//
// Exposed on window._app so logger.js, history.js, and progressions-ui.js
// can read shared state without creating circular imports.
// These modules must NOT write back to window._app except through the
// functions defined here (updateTodayLog, refreshHeader).

window._app = {
  uid:            null,    // string  — anonymous Firebase UID
  profile:        null,    // object  — raw profile data from Firestore
  day1:           null,    // string  — 'YYYY-MM-DD' surgery/start date
  dayNumber:      0,       // number  — recovery day (1-based)
  progressions:   {},      // object  — { [exerciseId]: level }
  todayLog:       {},      // object  — { [exerciseId]: entry } built from log entries array
  todayExercises: [],      // array   — exercise objects scheduled for today (from EXERCISES)
  currentScreen:  'screen-loading',

  // Called by logger.js after saving a log entry, to keep todayLog in sync
  // and refresh the header completion badge without a full page reload.
  updateTodayLog(exerciseId, entry) {
    window._app.todayLog[exerciseId] = entry;
    const logged    = Object.keys(window._app.todayLog).length;
    const scheduled = window._app.todayExercises.length;
    updateHeader(window._app.dayNumber, scheduled, logged);
  },
};

// ── Navigation wiring ──────────────────────────────────────────────────────────

/**
 * Wires click handlers on all .nav-btn elements.
 * Uses data-screen attribute to determine which screen to show.
 * Notifies screen modules to refresh their content via window._*Module.refresh().
 */
function wireNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screenId = btn.dataset.screen;
      if (!screenId || screenId === window._app.currentScreen) return;

      showScreen(screenId);
      window._app.currentScreen = screenId;

      // Notify screen modules to refresh if they have loaded
      switch (screenId) {
        case 'screen-history':
          if (window._historyModule?.refresh) window._historyModule.refresh();
          break;
        case 'screen-progressions':
          if (window._progressionsModule?.refresh) window._progressionsModule.refresh();
          break;
        case 'screen-log':
          if (window._loggerModule?.refresh) window._loggerModule.refresh();
          break;
      }
    });
  });
}

// ── Today log index builder ────────────────────────────────────────────────────

/**
 * Converts the log document's entries array into a keyed map for fast lookup.
 * firestore.js getLog() returns { date, dayOfWeek, entries[], updatedAt }.
 * We index by exerciseId so logger.js can do todayLog[exerciseId] instantly.
 *
 * If an exercise appears more than once in entries (e.g. after an update),
 * the last entry wins — this is consistent with how updateLogEntry works
 * (remove old, append new).
 *
 * @param {object|null} logDoc — the data property from getLog() result
 * @returns {object} — { [exerciseId]: entryObject }
 */
function buildTodayLogIndex(logDoc) {
  if (!logDoc || !Array.isArray(logDoc.entries)) return {};
  const index = {};
  logDoc.entries.forEach(entry => {
    index[entry.exerciseId] = entry;
  });
  return index;
}

// ── Startup sequence ───────────────────────────────────────────────────────────

async function init() {
  try {

    // Step 2 — Online/offline banner
    updateOfflineBanner();
    window.addEventListener('online',  updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);

    // Step 3 — Anonymous auth
    setLoadingLabel('Authenticating…');
    const uid = await initAuth();
    window._app.uid = uid;
    console.log('app.js: auth OK, uid =', uid);

    // Step 4 — Patient profile
    setLoadingLabel('Loading profile…');
    const profileResult = await getProfile(uid);

    if (!profileResult.success) {
      throw new Error(`getProfile failed: ${profileResult.error}`);
    }

    let profileData = profileResult.data;

    if (!profileData) {
      // First visit — create a default profile.
      // day1 defaults to today so the app is immediately usable.
      // The clinician updates day1 via the profile screen (future task).
      const defaultProfile = {
        uid,
        day1:      todayStr(),
        createdAt: new Date().toISOString(),
      };
      const saveResult = await saveProfile(uid, defaultProfile);
      if (!saveResult.success) {
        // Non-fatal — we can still proceed with the default in memory
        console.warn('app.js: saveProfile failed on first visit:', saveResult.error);
      }
      profileData = defaultProfile;
      console.log('app.js: first visit — default profile, day1 =', defaultProfile.day1);
    }

    window._app.profile = profileData;
    window._app.day1    = profileData.day1;

    // Step 5 — Recovery day number
    const dayNumber = getDayNumber(profileData.day1);
    window._app.dayNumber = dayNumber;
    console.log('app.js: dayNumber =', dayNumber);

    // Step 6 — Progressions + today's log (parallel, non-blocking each other)
    setLoadingLabel('Loading exercises…');
    const today = todayStr();

    const [progressionsResult, logResult] = await Promise.all([
      getProgressions(uid),
      getLog(uid, today),
    ]);

    if (!progressionsResult.success) {
      // Non-fatal — proceed with empty progressions (all exercises at level 0)
      console.warn('app.js: getProgressions failed:', progressionsResult.error);
    }
    window._app.progressions = progressionsResult.success
      ? (progressionsResult.data || {})
      : {};

    if (!logResult.success) {
      // Non-fatal — proceed with empty log (no exercises logged yet today)
      console.warn('app.js: getLog failed:', logResult.error);
    }
    window._app.todayLog = buildTodayLogIndex(
      logResult.success ? logResult.data : null
    );

    // Step 7 — Today's exercise schedule
    // getApplicableExercises takes a Date object and the full EXERCISES array.
    const todayExercises = getApplicableExercises(new Date(), EXERCISES);
    window._app.todayExercises = todayExercises;
    console.log('app.js: today —', getDayLabel(new Date()),
                '— exercises:', todayExercises.map(e => e.id));

    // Step 8 — Update header
    const loggedCount = todayExercises.filter(
      e => window._app.todayLog[e.id]
    ).length;
    updateHeader(dayNumber, todayExercises.length, loggedCount);

    // Step 9 — Wire nav, show Today screen, signal ready
    wireNavigation();
    showScreen('screen-log');
    window._app.currentScreen = 'screen-log';

    // Dispatch app:ready so logger.js can render exercise cards.
    // Custom event decouples module load order — logger.js listens independently
    // rather than being called directly, avoiding a direct import dependency.
    window.dispatchEvent(new CustomEvent('app:ready', {
      detail: {
        uid,
        profile:        profileData,
        dayNumber,
        todayExercises,
        progressions:   window._app.progressions,
        todayLog:       window._app.todayLog,
      }
    }));

    console.log('app.js: startup complete — app:ready dispatched');

  } catch (err) {
    // Keep loading screen visible — there is no usable state without auth + profile.
    console.error('app.js: startup failed:', err);
    setLoadingLabel('Could not connect. Please check your internet connection and reload.');
    showToast('Connection failed — please reload the page.', 'error', 0);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

// <script type="module"> runs after HTML is parsed, so DOMContentLoaded has
// usually already fired. The guard below handles the rare edge case where it has not.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}