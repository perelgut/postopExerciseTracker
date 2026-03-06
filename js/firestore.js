// Firestore operations — all database read/write functions. No Firestore calls outside this module.

import { db } from './firebase-config.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── PATH HELPERS ──────────────────────────────────────────────────────────────

function profileRef(uid) {
  return doc(db, 'patients', uid, 'profile', 'data');
}

function progressionsRef(uid) {
  return doc(db, 'patients', uid, 'progressions', 'data');
}

function logRef(uid, dateStr) {
  return doc(db, 'patients', uid, 'logs', dateStr);
}

// ── PROFILE ───────────────────────────────────────────────────────────────────

/**
 * Fetches the patient profile.
 * Returns { success: true, data: { uid, day1, createdAt } }
 * or      { success: false, error }
 */
async function getProfile(uid) {
  try {
    const snap = await getDoc(profileRef(uid));
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    } else {
      return { success: true, data: null };
    }
  } catch (err) {
    console.error('getProfile failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Saves or updates the patient profile.
 * profileData should include: { uid, day1 (ISO date string), createdAt }
 */
async function saveProfile(uid, profileData) {
  try {
    await setDoc(profileRef(uid), {
      ...profileData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('saveProfile failed:', err);
    return { success: false, error: err.message };
  }
}

// ── PROGRESSIONS ──────────────────────────────────────────────────────────────

/**
 * Fetches all exercise progressions for the patient.
 * Returns { success: true, data: { exerciseId: level, ... } }
 * or      { success: false, error }
 */
async function getProgressions(uid) {
  try {
    const snap = await getDoc(progressionsRef(uid));
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    } else {
      return { success: true, data: {} };
    }
  } catch (err) {
    console.error('getProgressions failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates a single exercise progression level.
 * exerciseId should be the numeric id (e.g. 7 for Bridge).
 * level is the new progression level (integer).
 */
async function updateProgression(uid, exerciseId, level) {
  try {
    await setDoc(progressionsRef(uid), {
      [exerciseId]: level,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('updateProgression failed:', err);
    return { success: false, error: err.message };
  }
}

// ── LOG ENTRIES ───────────────────────────────────────────────────────────────

/**
 * Fetches the log document for a single date.
 * dateStr format: 'YYYY-MM-DD'
 * Returns { success: true, data: { date, dayOfWeek, entries[], updatedAt } }
 * or      { success: true, data: null } if no log exists for that date
 * or      { success: false, error }
 */
async function getLog(uid, dateStr) {
  try {
    const snap = await getDoc(logRef(uid, dateStr));
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    } else {
      return { success: true, data: null };
    }
  } catch (err) {
    console.error('getLog failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetches log documents for multiple dates in a single batch.
 * dateStrings: array of 'YYYY-MM-DD' strings
 * Returns { success: true, data: { 'YYYY-MM-DD': logData, ... } }
 * Dates with no log document are present in the result as null.
 */
async function getLogs(uid, dateStrings) {
  try {
    const promises = dateStrings.map(d => getDoc(logRef(uid, d)));
    const snaps = await Promise.all(promises);
    const data = {};
    snaps.forEach((snap, i) => {
      data[dateStrings[i]] = snap.exists() ? snap.data() : null;
    });
    return { success: true, data };
  } catch (err) {
    console.error('getLogs failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Saves a new log entry for an exercise on a given date.
 * If a log document for the date does not exist it is created.
 * If it exists the entry is appended to the entries array.
 *
 * entry object shape:
 * {
 *   exerciseId:      number,
 *   progressionLevel: number,
 *   timeOfDay:       string,   // e.g. 'Morning'
 *   count:           number,
 *   repeats:         number,
 *   loggedAt:        string    // ISO timestamp
 * }
 *
 * dateStr format: 'YYYY-MM-DD'
 * dayOfWeek: integer 0-6 (0=Sunday)
 */
async function saveLogEntry(uid, dateStr, dayOfWeek, entry) {
  try {
    const ref = logRef(uid, dateStr);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // Document exists — append entry to entries array
      await updateDoc(ref, {
        entries: arrayUnion(entry),
        updatedAt: serverTimestamp()
      });
    } else {
      // Document does not exist — create it with the first entry
      await setDoc(ref, {
        date: dateStr,
        dayOfWeek,
        entries: [entry],
        updatedAt: serverTimestamp()
      });
    }
    return { success: true };
  } catch (err) {
    console.error('saveLogEntry failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates an existing log entry for an exercise on a given date.
 * Removes the old entry and replaces it with the updated entry.
 * Matches on exerciseId — assumes one entry per exercise per day.
 *
 * oldEntry: the original entry object (must match exactly for arrayRemove)
 * newEntry: the replacement entry object
 */
async function updateLogEntry(uid, dateStr, oldEntry, newEntry) {
  try {
    const ref = logRef(uid, dateStr);
    await updateDoc(ref, {
      entries: arrayRemove(oldEntry)
    });
    await updateDoc(ref, {
      entries: arrayUnion(newEntry),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (err) {
    console.error('updateLogEntry failed:', err);
    return { success: false, error: err.message };
  }
}

// ── DATE HELPER ───────────────────────────────────────────────────────────────

/**
 * Returns today's date as a 'YYYY-MM-DD' string using local time.
 * Important: do not use toISOString() — that returns UTC and can
 * give the wrong date for patients in non-UTC time zones.
 */
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns an array of the last N dates as 'YYYY-MM-DD' strings,
 * starting from today and going backwards.
 * Used by the history screen to build its date list.
 */
function lastNDates(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

export {
  getProfile,
  saveProfile,
  getProgressions,
  updateProgression,
  getLog,
  getLogs,
  saveLogEntry,
  updateLogEntry,
  todayStr,
  lastNDates
};