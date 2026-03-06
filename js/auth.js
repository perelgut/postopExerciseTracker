// Firebase Anonymous Authentication — creates/restores anonymous UID, localStorage fallback.

import { auth } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const UID_KEY = 'postop_uid';
let currentUID = null;

/**
 * Initialises anonymous authentication.
 * Returns a Promise that resolves with the UID when auth is ready.
 * On failure falls back to the UID stored in localStorage.
 */
function initAuth() {
  return new Promise((resolve, reject) => {
    let resolved = false;

    // onAuthStateChanged fires immediately if a session already exists,
    // or after signInAnonymously completes on first visit.
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user && !resolved) {
        resolved = true;
        unsubscribe(); // stop listening after first resolution
        currentUID = user.uid;
        localStorage.setItem(UID_KEY, currentUID);
        console.log('Auth ready. UID:', currentUID);
        resolve(currentUID);
      }
    });

    // Attempt anonymous sign-in — no-op if already signed in
    signInAnonymously(auth).catch(err => {
      console.error('Anonymous sign-in failed:', err.code, err.message);
      if (!resolved) {
        resolved = true;
        unsubscribe();
        const storedUID = localStorage.getItem(UID_KEY);
        if (storedUID) {
          console.warn('Using cached UID from localStorage:', storedUID);
          currentUID = storedUID;
          resolve(currentUID);
        } else {
          reject(new Error('Authentication failed and no cached UID available. ' +
                           'Please check your internet connection and reload.'));
        }
      }
    });
  });
}

/**
 * Returns the current anonymous UID.
 * Returns null if initAuth() has not been called yet or has not resolved.
 */
function getCurrentUID() {
  return currentUID || localStorage.getItem(UID_KEY);
}

export { initAuth, getCurrentUID };