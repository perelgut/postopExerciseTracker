// auth.js — Firebase Google Sign-In authentication.
//
// Replaces anonymous auth (T2.3) with Google Sign-In so the patient's data
// is accessible from any device using the same Google account.
//
// BEHAVIOUR:
//   initAuth() checks if Firebase already has a signed-in user (persistent
//   session from a previous visit). If yes, returns the UID immediately —
//   the patient does not see the sign-in screen again.
//   If no current user, returns null so app.js can show the sign-in screen.
//   signInWithGoogle() triggers the Google sign-in popup and returns the UID.
//
// EXPORTS:
//   initAuth()         → Promise<string|null>  — UID if already signed in, null if not
//   signInWithGoogle() → Promise<string>        — triggers popup, returns UID on success
//   getCurrentUID()    → string|null            — synchronous, current UID or null
//
// FIREBASE CONSOLE REQUIREMENT (manual step):
//   Authentication → Sign-in method → Google → Enable
//   Set a project support email address.

import { auth, provider }          from './firebase-config.js';
import { onAuthStateChanged,
         signInWithPopup }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Module state ───────────────────────────────────────────────────────────────

let _currentUID = null;

// ── initAuth ───────────────────────────────────────────────────────────────────

/**
 * Checks Firebase auth state on startup.
 * Returns the current user's UID if already signed in, or null if not.
 * Uses a Promise wrapping onAuthStateChanged so the startup sequence can
 * await the result before deciding whether to show the sign-in screen.
 *
 * @returns {Promise<string|null>}
 */
function initAuth() {
  return new Promise((resolve) => {
    // onAuthStateChanged fires once immediately with the current user (or null),
    // then continues to fire on subsequent sign-in/sign-out events.
    // We unsubscribe after the first call — app.js only needs the initial state.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        _currentUID = user.uid;
        console.log('auth.js: existing session, uid =', user.uid);
      } else {
        _currentUID = null;
        console.log('auth.js: no current session');
      }
      resolve(_currentUID);
    });
  });
}

// ── signInWithGoogle ───────────────────────────────────────────────────────────

/**
 * Opens the Google sign-in popup. Called when the patient taps "Sign in with Google"
 * on the sign-in screen.
 *
 * On success: sets _currentUID and returns the UID string.
 * On failure: throws an error — app.js catches it and shows an error toast.
 *
 * @returns {Promise<string>} — the signed-in user's UID
 */
async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  _currentUID = result.user.uid;
  console.log('auth.js: Google sign-in successful, uid =', _currentUID);
  return _currentUID;
}

// ── getCurrentUID ──────────────────────────────────────────────────────────────

/**
 * Returns the current user's UID synchronously.
 * Returns null if not yet signed in.
 *
 * @returns {string|null}
 */
function getCurrentUID() {
  return _currentUID;
}

// ── Exports ────────────────────────────────────────────────────────────────────

export { initAuth, signInWithGoogle, getCurrentUID };