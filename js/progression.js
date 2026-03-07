// progression.js — Progression level management.
//
// Reads current levels from window._app.progressions (loaded at startup by app.js).
// Persists changes to Firestore via updateProgression() from firestore.js.
// Updates window._app.progressions in memory ONLY after Firestore confirms success.
//
// Design decision: Conservative update (Option B).
//   - Firestore write is attempted first.
//   - window._app.progressions is updated only on confirmed success.
//   - On failure: state unchanged, caller receives { success: false, error }.
//   - No rollback needed because memory is never modified before confirmation.
//
// Depends on:
//   js/firestore.js  — updateProgression(uid, exerciseId, level)
//   js/exercises.js  — EXERCISES array (for maxProgression validation)
//   window._app      — .progressions (ProgressionsMap), .uid (string)
//                      Both must be populated by app.js before any call here.
//
// Does NOT call getProgressions() — app.js handles the initial load at startup.
//
// Exports:
//   getLevel(exerciseId)                    → number
//   setLevel(exerciseId, newLevel)          → Promise<{ success, error? }>
//   isAtMaxLevel(exerciseId)                → boolean
//   canAdvance(exerciseId)                  → boolean
//   canRevert(exerciseId)                   → boolean
//   getProgressionData(exerciseId)          → ProgressionLevel | null
//   getExerciseProgressionSummary(exerciseId) → ProgressionSummary | null

import { updateProgression }  from './firestore.js';
import { EXERCISES }          from './exercises.js';

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Looks up an exercise object by id from the EXERCISES array.
 * Returns null if not found — callers must guard against this.
 *
 * @param {number} exerciseId
 * @returns {object|null}
 */
function _findExercise(exerciseId) {
  return EXERCISES.find(e => e.id === exerciseId) ?? null;
}

/**
 * Returns the current level for an exercise from window._app.progressions.
 * Defaults to 0 if the exercise has never had a progression saved.
 *
 * NOTE: window._app.progressions may contain an 'updatedAt' key from Firestore.
 * That key is not a number and will never match a valid exerciseId, so it is
 * harmless — but callers should not iterate window._app.progressions directly.
 * Use getLevel() for individual lookups.
 *
 * @param {number} exerciseId
 * @returns {number}
 */
function _currentLevel(exerciseId) {
  const val = window._app?.progressions?.[exerciseId];
  // Ensure we always return a number — updatedAt Timestamp would be an object
  return (typeof val === 'number') ? val : 0;
}

// ── Exported functions ─────────────────────────────────────────────────────────

/**
 * Returns the current progression level for an exercise.
 * Returns 0 if no progression has been saved (entry level).
 *
 * @param {number} exerciseId
 * @returns {number}
 */
function getLevel(exerciseId) {
  return _currentLevel(exerciseId);
}

/**
 * Validates and persists a new progression level for an exercise.
 *
 * Validation rules:
 *   - exerciseId must exist in EXERCISES
 *   - newLevel must be >= 0
 *   - newLevel must be <= exercise.maxProgression
 *
 * On success: Firestore is updated first, then window._app.progressions is updated.
 * On failure: window._app.progressions is NOT modified. Error is returned to caller.
 *
 * @param {number} exerciseId
 * @param {number} newLevel
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function setLevel(exerciseId, newLevel) {
  // ── Validate exerciseId ────────────────────────────────────────────────────
  const exercise = _findExercise(exerciseId);
  if (!exercise) {
    const msg = `progression.js setLevel: exerciseId ${exerciseId} not found in EXERCISES`;
    console.error(msg);
    return { success: false, error: msg };
  }

  // ── Validate newLevel range ────────────────────────────────────────────────
  if (typeof newLevel !== 'number' || !Number.isInteger(newLevel)) {
    const msg = `progression.js setLevel: newLevel must be an integer, got ${newLevel}`;
    console.error(msg);
    return { success: false, error: msg };
  }

  if (newLevel < 0) {
    const msg = `progression.js setLevel: newLevel ${newLevel} is below minimum (0)`;
    console.error(msg);
    return { success: false, error: msg };
  }

  if (newLevel > exercise.maxProgression) {
    const msg = `progression.js setLevel: newLevel ${newLevel} exceeds maxProgression ` +
                `(${exercise.maxProgression}) for exercise ${exerciseId}`;
    console.error(msg);
    return { success: false, error: msg };
  }

  // ── Check uid is available ─────────────────────────────────────────────────
  const uid = window._app?.uid;
  if (!uid) {
    const msg = 'progression.js setLevel: window._app.uid is not set — app not ready';
    console.error(msg);
    return { success: false, error: msg };
  }

  // ── Persist to Firestore first (conservative Option B) ────────────────────
  const result = await updateProgression(uid, exerciseId, newLevel);

  if (!result.success) {
    // Firestore failed — do NOT update memory
    const msg = `progression.js setLevel: Firestore write failed — ${result.error}`;
    console.error(msg);
    return { success: false, error: result.error };
  }

  // ── Only update memory after confirmed Firestore success ──────────────────
  if (!window._app.progressions) {
    window._app.progressions = {};
  }
  window._app.progressions[exerciseId] = newLevel;

  console.log(`progression.js: exercise ${exerciseId} → level ${newLevel}`);
  return { success: true };
}

/**
 * Returns true if the exercise is already at its maximum progression level.
 * Used by the progressions screen to disable or hide the Advance button.
 *
 * @param {number} exerciseId
 * @returns {boolean}
 */
function isAtMaxLevel(exerciseId) {
  const exercise = _findExercise(exerciseId);
  if (!exercise) return true; // treat unknown exercise as non-advanceable
  return _currentLevel(exerciseId) >= exercise.maxProgression;
}

/**
 * Returns true if the exercise can be advanced to the next level.
 * Semantic alias for !isAtMaxLevel() — use whichever reads more clearly in context.
 *
 * @param {number} exerciseId
 * @returns {boolean}
 */
function canAdvance(exerciseId) {
  return !isAtMaxLevel(exerciseId);
}

/**
 * Returns true if the exercise can be reverted to a lower level.
 * An exercise at level 0 cannot be reverted further.
 *
 * @param {number} exerciseId
 * @returns {boolean}
 */
function canRevert(exerciseId) {
  return _currentLevel(exerciseId) > 0;
}

/**
 * Returns the full ProgressionLevel data object for an exercise at its current level.
 * This is the object from EXERCISES[].progressions[currentLevel].
 *
 * Returns null if exerciseId is not found or level is out of range.
 *
 * Shape of returned object (verified from exercises.js):
 * {
 *   level:          number,   // 0-based
 *   description:    string,   // instruction text
 *   type:           string,   // 'Rep' | 'Time'
 *   defaultCount:   number,   // default reps or seconds
 *   defaultRepeats: number,   // default number of sets
 * }
 *
 * @param {number} exerciseId
 * @returns {object|null}
 */
function getProgressionData(exerciseId) {
  const exercise = _findExercise(exerciseId);
  if (!exercise) return null;

  const level = _currentLevel(exerciseId);
  const prog  = exercise.progressions[level];

  if (!prog) {
    console.warn(`progression.js getProgressionData: no progression at level ${level} ` +
                 `for exercise ${exerciseId}`);
    return null;
  }

  return prog;
}

/**
 * Returns a summary object with everything the progressions screen needs
 * to render a single exercise card, avoiding repeated lookups in the UI layer.
 *
 * Returns null if exerciseId is not found.
 *
 * @param {number} exerciseId
 * @returns {ProgressionSummary|null}
 */
function getExerciseProgressionSummary(exerciseId) {
  const exercise = _findExercise(exerciseId);
  if (!exercise) return null;

  const currentLevel = _currentLevel(exerciseId);
  const progData     = exercise.progressions[currentLevel];

  if (!progData) return null;

  return {
    id:             exercise.id,
    displayName:    exercise.displayName,   // e.g. 'Ex 7: Bridge'
    frequency:      exercise.frequency,     // 'Daily' | 'Alt1' | 'Alt2'
    currentLevel,                           // number
    maxProgression: exercise.maxProgression, // number
    canAdvance:     currentLevel < exercise.maxProgression,
    canRevert:      currentLevel > 0,
    description:    progData.description,
    type:           progData.type,          // 'Rep' | 'Time'
    defaultCount:   progData.defaultCount,
    defaultRepeats: progData.defaultRepeats,
  };
}

// ── Exports ────────────────────────────────────────────────────────────────────

export {
  getLevel,
  setLevel,
  isAtMaxLevel,
  canAdvance,
  canRevert,
  getProgressionData,
  getExerciseProgressionSummary,
};