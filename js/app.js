// app.js — Application bootstrap and startup sequence.
//
// Startup sequence (revised for Google Sign-In):
//
// Step 1 — Loading screen already visible from HTML default (no JS needed)
// Step 2 — Register online/offline listeners, sync offline banner
// Step 3 — initAuth() → UID if already signed in, null if not
//           If null → show #screen-signin and wait for patient to sign in
//           If UID  → proceed directly to Step 4
// Step 4 — getProfile() → create default profile on first visit
// Step 5 — getDayNumber() from profile.day1
// Step 6 — getProgressions() + getLog() in parallel
// Step 7 — getApplicableExercises() for today → todayExercises array
// Step 8 — updateHeader() with day number and completion counts
// Step 9 — Wire nav buttons, show screen-log, dispatch 'app:ready'

import { showScreen, setLoadingLabel, updateOfflineBanner,
         showToast, updateHeader }                         from './ui.js';
import { initAuth, signInWithGoogle }                      from './auth.js';
import { getProfile, saveProfile, getProgressions,
         getLog, todayStr }                                from './firestore.js';
import { EXERCISES }                                       from './exercises.js';
import { getApplicableExercises, getDayLabel,
         getDayNumber }                                    from './scheduler.js';

// ── Global app state ───────────────────────────────────────────────────────────

window._app = {
  uid:            null,
  profile:        null,
  day1:           null,
  dayNumber:      0,
  progressions:   {},
  todayLog:       {},
  todayExercises: [],
  currentScreen:  'screen-loading',

  updateTodayLog(exerciseId, entry) {
    window._app.todayLog[exerciseId] = entry;
    const logged    = Object.keys(window._app.todayLog).length;
    const scheduled = window._app.todayExercises.length;
    updateHeader(window._app.dayNumber, scheduled, logged);
  },
};

// ── Navigation wiring ──────────────────────────────────────────────────────────

function wireNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screenId = btn.dataset.screen;
      if (!screenId || screenId === window._app.currentScreen) return;

      showScreen(screenId);
      window._app.currentScreen = screenId;

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

function buildTodayLogIndex(logDoc) {
  if (!logDoc || !Array.isArray(logDoc.entries)) return {};
  const index = {};
  logDoc.entries.forEach(entry => {
    index[entry.exerciseId] = entry;
  });
  return index;
}

// ── Sign-in screen wiring ──────────────────────────────────────────────────────

/**
 * Shows the sign-in screen and wires the "Sign in with Google" button.
 * Returns a Promise that resolves with the UID once the patient signs in.
 * On error, shows a toast and re-enables the button so they can try again.
 *
 * @returns {Promise<string>} — resolves with uid after successful sign-in
 */
function waitForSignIn() {
  return new Promise((resolve) => {
    showScreen('screen-signin');
    window._app.currentScreen = 'screen-signin';

    const btn = document.getElementById('btn-google-signin');
    if (!btn) {
      console.error('app.js: #btn-google-signin not found in DOM');
      return;
    }

    btn.addEventListener('click', async () => {
      btn.disabled    = true;
      btn.textContent = 'Signing in…';

      try {
        const uid = await signInWithGoogle();
        resolve(uid);
      } catch (err) {
        console.error('app.js: Google sign-in failed:', err);
        // Re-enable button so patient can try again
        btn.disabled    = false;
        btn.textContent = 'Sign in with Google';
        showToast('Sign-in failed — please try again.', 'error');
      }
    });
  });
}

// ── Startup sequence ───────────────────────────────────────────────────────────

async function init() {
  try {

    // Step 2 — Online/offline banner
    updateOfflineBanner();
    window.addEventListener('online',  updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);

    // Step 3 — Check for existing Google session
    setLoadingLabel('Checking sign-in…');
    let uid = await initAuth();

    if (!uid) {
      // No existing session — show sign-in screen and wait
      uid = await waitForSignIn();
      // Back to loading screen while we load data
      showScreen('screen-loading');
      window._app.currentScreen = 'screen-loading';
    }

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
      // First visit on this Google account — create default profile
      const defaultProfile = {
        uid,
        day1:      todayStr(),
        createdAt: new Date().toISOString(),
      };
      const saveResult = await saveProfile(uid, defaultProfile);
      if (!saveResult.success) {
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

    // Step 6 — Progressions + today's log (parallel)
    setLoadingLabel('Loading exercises…');
    const today = todayStr();

    const [progressionsResult, logResult] = await Promise.all([
      getProgressions(uid),
      getLog(uid, today),
    ]);

    if (!progressionsResult.success) {
      console.warn('app.js: getProgressions failed:', progressionsResult.error);
    }
    window._app.progressions = progressionsResult.success
      ? (progressionsResult.data || {})
      : {};

    if (!logResult.success) {
      console.warn('app.js: getLog failed:', logResult.error);
    }
    window._app.todayLog = buildTodayLogIndex(
      logResult.success ? logResult.data : null
    );

    // Step 7 — Today's exercise schedule
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
    console.error('app.js: startup failed:', err);
    setLoadingLabel('Could not connect. Please check your internet connection and reload.');
    showToast('Connection failed — please reload the page.', 'error', 0);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}