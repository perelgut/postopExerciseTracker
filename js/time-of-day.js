// time-of-day.js — Time-of-day bucket utility for PostOp Exercise Tracker.
//
// PRIMARY ROLE (T3.6 revised):
//   Exports getTimeBucket(hour) so logger.js can auto-populate the per-card
//   time-of-day selects when building exercise cards.
//
// SECONDARY ROLE:
//   Also updates the global #time-of-day select in the header (if present)
//   so it reflects the current time bucket as a display indicator.
//
// Time bucket mapping (values must match <option value="..."> in index.html):
//   'Early Morning'    — 06:00–08:59  (hours 6, 7, 8)
//   'Morning'          — 09:00–11:59  (hours 9, 10, 11)
//   'Lunch'            — 12:00–12:59  (hour 12)
//   'Early Afternoon'  — 13:00–14:59  (hours 13, 14)
//   'Afternoon'        — 15:00–16:59  (hours 15, 16)
//   'Early Evening'    — 17:00–18:59  (hours 17, 18)
//   'Evening'          — 19:00–20:59  (hours 19, 20)
//   'Late'             — 21:00–05:59  (hours 21–23, 0–5)
//
// Exposes:
//   window._timeOfDayModule = { refresh(), getBucket(hour) }
//
// Called by: app:ready event + nav refresh (app.js)
// Used by:   logger.js — imports getTimeBucket for per-card selects

// ── Time bucket mapping ────────────────────────────────────────────────────────

/**
 * Maps a local hour (0–23) to the matching time-of-day bucket string.
 * Bucket values must exactly match the <option value="..."> attributes
 * in index.html #time-of-day.
 *
 * @param {number} hour — integer 0–23 from new Date().getHours()
 * @returns {string}    — exact option value string
 */
export function getTimeBucket(hour) {
  if (hour >= 6  && hour <= 8)  return 'Early Morning';
  if (hour >= 9  && hour <= 11) return 'Morning';
  if (hour === 12)              return 'Lunch';
  if (hour >= 13 && hour <= 14) return 'Early Afternoon';
  if (hour >= 15 && hour <= 16) return 'Afternoon';
  if (hour >= 17 && hour <= 18) return 'Early Evening';
  if (hour >= 19 && hour <= 20) return 'Evening';
  return 'Late'; // 21–23 and 0–5
}

// ── Global header select update ────────────────────────────────────────────────

/**
 * Updates the global #time-of-day select in the header to the current bucket.
 * This is a display indicator only — the authoritative time-of-day value for
 * each log entry comes from the per-card select inside the exercise card.
 *
 * Does not override if the patient has manually changed the global select.
 * Tracks last auto-set value via select.dataset.autoSet.
 */
function _updateGlobalSelect() {
  const select = document.getElementById('time-of-day');
  if (!select) return; // Element is optional; no warning needed

  const hour   = new Date().getHours();
  const bucket = getTimeBucket(hour);

  const lastAutoSet = select.dataset.autoSet;
  if (!lastAutoSet || select.value === lastAutoSet) {
    select.value           = bucket;
    select.dataset.autoSet = bucket;
    console.log(`time-of-day.js: global select set to "${bucket}" (hour ${hour})`);
  }
}

// ── Event listener ─────────────────────────────────────────────────────────────

window.addEventListener('app:ready', () => {
  _updateGlobalSelect();
});

// ── Module interface ───────────────────────────────────────────────────────────

window._timeOfDayModule = {
  /**
   * Re-runs global select update. Called when patient navigates back to Today.
   */
  refresh() {
    _updateGlobalSelect();
  },

  /**
   * Returns the bucket string for a given hour. Used by logger.js.
   * Also exported as a named export above for ES module consumers.
   * @param {number} hour — 0–23
   * @returns {string}
   */
  getBucket: getTimeBucket,
};