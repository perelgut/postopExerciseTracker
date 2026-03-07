// time-of-day.js — Auto-selects the time-of-day bucket from the device clock.
//
// T3.6: The #time-of-day select already exists in index.html (from T3.1).
// This module pre-selects the correct option when the app loads,
// based on the current local hour from the device clock.
//
// The select is NOT locked — the patient can always change it manually.
// Auto-selection fires once on app:ready and again on each refresh()
// call so if the patient navigates away and back, the bucket is current.
//
// Time bucket mapping (verified against index.html option values and labels):
//   'Early Morning'    — 06:00–08:59  (hours 6, 7, 8)
//   'Morning'          — 09:00–11:59  (hours 9, 10, 11)
//   'Lunch'            — 12:00–12:59  (hour  12)
//   'Early Afternoon'  — 13:00–14:59  (hours 13, 14)
//   'Afternoon'        — 15:00–16:59  (hours 15, 16)
//   'Early Evening'    — 17:00–18:59  (hours 17, 18)
//   'Evening'          — 19:00–20:59  (hours 19, 20)
//   'Late'             — 21:00–05:59  (hours 21–23, 0–5)
//
// DOM target (verified against index.html T3.1):
//   #time-of-day — <select> element
//
// Exposes: window._timeOfDayModule = { refresh }
// Called by: app:ready event + nav refresh

// ── Time bucket mapping ────────────────────────────────────────────────────────

/**
 * Maps the current local hour (0–23) to the matching select option value.
 * Option values must match the index.html <option value="..."> attributes exactly.
 *
 * @param {number} hour — integer 0–23 from new Date().getHours()
 * @returns {string}    — exact option value string
 */
function getTimeBucket(hour) {
  if (hour >= 6  && hour <= 8)  return 'Early Morning';
  if (hour >= 9  && hour <= 11) return 'Morning';
  if (hour === 12)              return 'Lunch';
  if (hour >= 13 && hour <= 14) return 'Early Afternoon';
  if (hour >= 15 && hour <= 16) return 'Afternoon';
  if (hour >= 17 && hour <= 18) return 'Early Evening';
  if (hour >= 19 && hour <= 20) return 'Evening';
  return 'Late'; // 21–23 and 0–5
}

// ── Auto-select ────────────────────────────────────────────────────────────────

/**
 * Reads the device clock and sets the #time-of-day select to the matching bucket.
 * Does not override if the patient has already changed the value manually —
 * we check whether the current value is still the default or a prior auto-set
 * by storing the last auto-set value and only updating if unchanged.
 */
function autoSelectTimeOfDay() {
  const select = document.getElementById('time-of-day');
  if (!select) {
    console.warn('time-of-day.js: #time-of-day select not found');
    return;
  }

  const hour   = new Date().getHours();
  const bucket = getTimeBucket(hour);

  // Only auto-select if the current value matches the last auto-set value
  // (or if this is the first time — when last auto-set is not stored yet).
  // This respects manual patient changes within the same session.
  const lastAutoSet = select.dataset.autoSet;

  if (!lastAutoSet || select.value === lastAutoSet) {
    select.value        = bucket;
    select.dataset.autoSet = bucket;
    console.log(`time-of-day.js: auto-selected "${bucket}" (hour ${hour})`);
  } else {
    console.log(`time-of-day.js: patient changed to "${select.value}" — not overriding`);
  }
}

// ── Event listener ─────────────────────────────────────────────────────────────

window.addEventListener('app:ready', () => {
  autoSelectTimeOfDay();
});

// ── Module interface ───────────────────────────────────────────────────────────

window._timeOfDayModule = {
  /**
   * Re-runs auto-selection. Called when patient navigates back to Today screen.
   * Respects manual patient override within the same session.
   */
  refresh() {
    autoSelectTimeOfDay();
  },

  /**
   * Returns the bucket string for a given hour.
   * Exported for testing purposes.
   * @param {number} hour — 0–23
   * @returns {string}
   */
  getBucket: getTimeBucket,
};