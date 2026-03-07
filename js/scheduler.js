// Scheduling logic — determines which exercises are applicable for a given day of the week.

// JavaScript getDay() values: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday,
//                             4=Thursday, 5=Friday, 6=Saturday
const ALT1_DAYS = [1, 3, 5]; // Monday, Wednesday, Friday
const ALT2_DAYS = [2, 4, 6]; // Tuesday, Thursday, Saturday
const SUN_DAY   = 0;         // Sunday — Daily only

/**
 * Returns the exercises applicable for the given date.
 *
 * @param {Date}   date      - JavaScript Date object for the day to check
 * @param {Array}  exercises - The full EXERCISES array from exercises.js
 * @returns {Array} Filtered array of exercise objects applicable that day
 */
function getApplicableExercises(date, exercises) {
  const dow = date.getDay(); // 0–6

  if (ALT1_DAYS.includes(dow)) {
    // Monday, Wednesday, Friday — Daily + Alt1
    return exercises.filter(e => e.frequency === 'Daily' || e.frequency === 'Alt1');
  }

  if (ALT2_DAYS.includes(dow)) {
    // Tuesday, Thursday, Saturday — Daily + Alt2
    return exercises.filter(e => e.frequency === 'Daily' || e.frequency === 'Alt2');
  }

  // Sunday — Daily only
  return exercises.filter(e => e.frequency === 'Daily');
}

/**
 * Returns true if an exercise is applicable on the given date.
 * Used by the history table to determine whether to show a cell as
 * applicable or dimmed.
 *
 * @param {Date}   date     - JavaScript Date object
 * @param {Object} exercise - A single exercise object from EXERCISES
 * @returns {boolean}
 */
function isApplicableOn(date, exercise) {
  const dow = date.getDay();

  if (exercise.frequency === 'Daily') return true;
  if (exercise.frequency === 'Alt1')  return ALT1_DAYS.includes(dow);
  if (exercise.frequency === 'Alt2')  return ALT2_DAYS.includes(dow);

  return false;
}

/**
 * Returns a human-readable label for the day type.
 * Used for display purposes on the logging screen.
 *
 * @param {Date} date - JavaScript Date object
 * @returns {string}  e.g. 'Monday — Daily + Alt1 exercises'
 */
function getDayLabel(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                'Thursday', 'Friday', 'Saturday'];
  const dow  = date.getDay();
  const name = days[dow];

  if (ALT1_DAYS.includes(dow)) return `${name} — Daily + Alt1 exercises`;
  if (ALT2_DAYS.includes(dow)) return `${name} — Daily + Alt2 exercises`;
  return `${name} — Daily exercises only`;
}

/**
 * Returns the recovery day number (1-based) from the surgery date.
 * Day 1 is the surgery date itself.
 *
 * Uses local midnight for both dates to avoid time-zone drift —
 * the same approach as todayStr() in firestore.js.
 *
 * @param {string} day1Str - ISO date string 'YYYY-MM-DD' stored in profile.day1
 * @returns {number} Recovery day number, minimum 1
 */
function getDayNumber(day1Str) {
  const day1  = new Date(day1Str + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - day1) / 86400000) + 1;
  return Math.max(1, diff); // never return 0 or negative
}

export { getApplicableExercises, isApplicableOn, getDayLabel, getDayNumber, ALT1_DAYS, ALT2_DAYS };