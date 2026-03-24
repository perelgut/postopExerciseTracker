// history.js — 30-day history table for the History screen.
//
// Renders a scrollable table into #history-table-wrap showing the last 30 days.
// Rows = dates (today first). Columns = exercises applicable on at least one of
// those days. Each cell shows logged data, an applicable-but-missed dash, or a
// dimmed dot for non-applicable days.
//
// Triggered by: window._historyModule.refresh() called from app.js nav wiring
//               when user taps the History nav button.
//
// DOM target (verified against index.html T3.1):
//   #history-table-wrap   — scroll container, already in HTML
//
// CSS classes used (verified against table.css and styles.css T3.1):
//   .history-table        — <table> element
//   thead th              — header cells
//   th.col-date           — sticky date column header
//   th.col-ex             — exercise column headers
//   tbody tr              — data rows
//   tr.row-today          — green tint on today
//   td.cell-date          — sticky left date cell
//   .date-line1           — bold date (e.g. "Fri 06")
//   .date-line2           — muted month/year (e.g. "Mar 2026")
//   td.cell-ex            — exercise data cell
//   .cell-logged          — logged entry container
//     .cell-prog          — blue level chip e.g. "L2"
//     .cell-count         — count e.g. "15r" or "45s"
//     .cell-repeats       — repeats e.g. "×3"
//   .cell-empty           — applicable but not logged
//   .cell-na              — not applicable that day
//   .cell-na-inner        — inner wrapper for .cell-na
//   .cell-skipped         — logged with count = 0
//   .empty-state          — centred message for error/loading states
//
// Firestore functions used (verified against firestore.js):
//   getLogs(uid, dateStrings[])   → { success, data: { dateStr: LogDoc|null } }
//   lastNDates(n)                 → string[] today-first
//   todayStr()                    → 'YYYY-MM-DD'
//
// scheduler.js:
//   isApplicableOn(date, exercise) → boolean
//
// Reads from window._app (set by app.js):
//   .uid, .progressions
//
// Exposes: window._historyModule = { refresh }

import { getLogs, lastNDates, todayStr } from './firestore.js';
import { isApplicableOn }                from './scheduler.js';
import { EXERCISES }                     from './exercises.js';

// ── Short column header names ──────────────────────────────────────────────────
// Derived from exercise names — kept short to fit 72px min-width columns.
// Ex 9 (Hip Flexor Strengthening) and Ex 16 (Hip Flexor Stretch) are
// deliberately disambiguated.

const SHORT_NAME = {
  0:  'Walk',
  7:  'Bridge',
  8:  'Clam Shell',
  9:  'Flexor Str.',    // Hip Flexor Strengthening
  10: 'Hip Abduct.',    // Standing Hip Abduction
  11: 'Squat',
  12: 'Crab Walk',
  13: 'Leg Abduct.',    // Standing Leg Abductor
  14: 'Marching',       // Marching in Place
  15: 'Hip Bend.',      // Hip Bending Stretch
  16: 'Flexor Stch.',   // Hip Flexor Stretch
  17: 'Hamstring',      // Seated Hamstring Stretch
};

// ── Module state ───────────────────────────────────────────────────────────────

// Cache fetched log data so we do not re-fetch on every nav tap.
// Invalidated if the user taps Refresh (future feature) or on date change.
let _cachedLogs    = null;   // { dateStr: LogDoc | null }
let _cachedDateStr = null;   // todayStr() at time of last fetch — detect day rollover

// ── Date formatting helpers ────────────────────────────────────────────────────

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses a 'YYYY-MM-DD' string to a local-time Date object.
 * Never use new Date(dateStr) directly — that interprets as UTC midnight.
 * @param {string} dateStr
 * @returns {Date}
 */
function _parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns the two-line date label content for a date cell.
 * line1: e.g. "Fri 06"
 * line2: e.g. "Mar 2026"
 * @param {string} dateStr — 'YYYY-MM-DD'
 * @returns {{ line1: string, line2: string }}
 */
function _formatDateCell(dateStr) {
  const date  = _parseLocalDate(dateStr);
  const day   = DAY_NAMES[date.getDay()];
  const dd    = String(date.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getMonth()];
  const year  = date.getFullYear();
  return {
    line1: `${day} ${dd}`,
    line2: `${month} ${year}`,
  };
}

// ── Log entry lookup ───────────────────────────────────────────────────────────

/**
 * Finds ALL log entries for a specific exercise on a specific date.
 * Returns empty array if no log or no matching entries.
 * Multiple entries exist when the patient logged sessions at different times.
 *
 * @param {object|null} logDoc     — LogDoc from Firestore (has .entries array)
 * @param {number}      exerciseId
 * @returns {object[]}             — LogEntry[] (may be empty)
 */
function _findEntries(logDoc, exerciseId) {
  if (!logDoc || !Array.isArray(logDoc.entries)) return [];
  return logDoc.entries.filter(e => e.exerciseId === exerciseId);
}

// ── Cell builders ──────────────────────────────────────────────────────────────

/**
 * Builds the content for an exercise data cell.
 * Returns an HTML string to set as innerHTML of td.cell-ex.
 *
 * Walk (type 'Minutes'): shows total minutes across all sessions.
 * All other exercises: shows total repeats (sum across sessions).
 * Multiple sessions are aggregated — the cell shows totals, not individual entries.
 *
 * @param {boolean}  applicable — is this exercise scheduled for this date?
 * @param {object[]} entries    — LogEntry[] for this exercise on this date (may be empty)
 * @param {object}   exercise   — ExerciseObject (for type lookup)
 * @returns {string}            — HTML string
 */
function _buildCellContent(applicable, entries, exercise) {
  if (!applicable) {
    return `<span class="cell-na"><span class="cell-na-inner">·</span></span>`;
  }

  if (entries.length === 0) {
    return `<span class="cell-empty">—</span>`;
  }

  // Use first entry for progression level (consistent across sessions for same day)
  const firstEntry = entries[0];

  if (firstEntry.count === 0) {
    return `<span class="cell-skipped">skip</span>`;
  }

  const prog      = exercise.progressions[firstEntry.progressionLevel ?? 0];
  const isMinutes = prog?.type === 'Minutes';
  const levelStr  = `L${firstEntry.progressionLevel ?? 0}`;

  if (isMinutes) {
    // Walk: show total minutes across all sessions
    const totalMins = entries.reduce((s, e) => s + e.count, 0);
    return `<span class="cell-logged">
      <span class="cell-prog">${levelStr}</span>
      <span class="cell-count">${totalMins}min</span>
      <span class="cell-repeats">×${entries.length}</span>
    </span>`;
  }

  // Rep / Time: show aggregated totals
  const unit        = prog?.type === 'Time' ? 's' : 'r';
  const totalCount  = entries.reduce((s, e) => s + e.count,   0);
  const totalReps   = entries.reduce((s, e) => s + e.repeats, 0);
  const countStr    = `${totalCount}${unit}`;
  const repeatsStr  = `×${totalReps}`;

  return `<span class="cell-logged">
    <span class="cell-prog">${levelStr}</span>
    <span class="cell-count">${countStr}</span>
    <span class="cell-repeats">${repeatsStr}</span>
  </span>`;
}

// ── Table builder ──────────────────────────────────────────────────────────────

/**
 * Builds and returns the complete history <table> element.
 *
 * @param {string[]}          dates     — array of 'YYYY-MM-DD', today first
 * @param {object}            logsMap   — { dateStr: LogDoc|null }
 * @param {string}            today     — todayStr() for row-today class
 * @returns {HTMLTableElement}
 */
function _buildTable(dates, logsMap, today) {
  // An exercise column is shown if:
  //   - It is applicable on at least one of the 30 dates (active exercises), OR
  //   - It has frequency 'shelved' (retired — always shown for historical continuity)
  const visibleExercises = EXERCISES.filter(exercise =>
    exercise.frequency === 'shelved' ||
    dates.some(dateStr => isApplicableOn(_parseLocalDate(dateStr), exercise))
  );

  const table = document.createElement('table');
  table.className = 'history-table';
  table.setAttribute('role', 'grid');
  table.setAttribute('aria-label', '30-day exercise history');

  // ── Header row ─────────────────────────────────────────────────────────────
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Date column header
  const dateTh = document.createElement('th');
  dateTh.className   = 'col-date';
  dateTh.scope       = 'col';
  dateTh.textContent = 'Date';
  headerRow.appendChild(dateTh);

  // Exercise column headers
  visibleExercises.forEach(exercise => {
    const th = document.createElement('th');
    th.className   = 'col-ex';
    th.scope       = 'col';
    th.textContent = SHORT_NAME[exercise.id] ?? exercise.name;
    th.title       = exercise.frequency === 'shelved'
      ? `${exercise.displayName} (retired)`
      : exercise.displayName;
    // Visually dim retired exercise headers
    if (exercise.frequency === 'shelved') {
      th.style.opacity = '0.45';
      th.style.fontStyle = 'italic';
    }
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── Body rows ──────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody');

  dates.forEach(dateStr => {
    const logDoc   = logsMap[dateStr] ?? null;
    const dateObj  = _parseLocalDate(dateStr);
    const isToday  = dateStr === today;

    const row = document.createElement('tr');
    if (isToday) row.classList.add('row-today');

    // Date cell (sticky left)
    const dateTd = document.createElement('td');
    dateTd.className = 'cell-date';
    dateTd.setAttribute('scope', 'row');

    const { line1, line2 } = _formatDateCell(dateStr);
    dateTd.innerHTML =
      `<div class="date-line1">${line1}</div>` +
      `<div class="date-line2">${line2}</div>`;

    row.appendChild(dateTd);

    // Exercise cells
    visibleExercises.forEach(exercise => {
      const td = document.createElement('td');
      td.className = 'cell-ex';

      const applicable = isApplicableOn(dateObj, exercise);
      const entries    = _findEntries(logDoc, exercise.id);

      td.innerHTML = _buildCellContent(applicable, entries, exercise);
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

// ── Render ─────────────────────────────────────────────────────────────────────

/**
 * Fetches log data (or uses cache) and renders the history table.
 * Called by window._historyModule.refresh() from app.js nav wiring.
 */
async function _render() {
  const wrap = document.getElementById('history-table-wrap');
  if (!wrap) {
    console.error('history.js _render: #history-table-wrap not found');
    return;
  }

  const uid   = window._app?.uid;
  const today = todayStr();

  if (!uid) {
    wrap.innerHTML = `<p class="empty-state">Not signed in.</p>`;
    return;
  }

  // Show loading state while fetching
  // Only show if we don't already have a table rendered (avoids flicker on re-nav)
  if (!_cachedLogs) {
    wrap.innerHTML = `<p class="empty-state">Loading history…</p>`;
  }

  // Invalidate cache if date has rolled over since last fetch
  if (_cachedDateStr && _cachedDateStr !== today) {
    _cachedLogs    = null;
    _cachedDateStr = null;
    console.log('history.js: date rolled over — cache invalidated');
  }

  // Fetch if no valid cache
  if (!_cachedLogs) {
    const dates  = lastNDates(30);
    const result = await getLogs(uid, dates);

    if (!result.success) {
      console.error('history.js _render: getLogs failed:', result.error);
      wrap.innerHTML =
        `<p class="empty-state">Could not load history. Please check your connection.</p>`;
      return;
    }

    _cachedLogs    = result.data;
    _cachedDateStr = today;
    console.log('history.js: fetched logs for 30 dates');
  }

  // Build and inject table
  const dates = lastNDates(30);
  const table = _buildTable(dates, _cachedLogs, today);

  wrap.innerHTML = '';
  wrap.appendChild(table);

  console.log('history.js: table rendered');
}

// ── Module interface ───────────────────────────────────────────────────────────

window._historyModule = {
  /**
   * Renders or re-renders the history table.
   * Uses cached data if available and date has not rolled over.
   * Called by app.js when user taps the History nav button.
   */
  refresh() {
    _render();
  },

  /**
   * Clears the cache and forces a fresh fetch on next refresh().
   * Call this after a log entry is saved (future enhancement — T3.4
   * currently does not invalidate history cache, which is acceptable
   * since history is fetched fresh on first nav tap each session).
   * Also called by logger.js after every Log or Add Session save.
   */
  invalidateCache() {
    _cachedLogs    = null;
    _cachedDateStr = null;
  },
};