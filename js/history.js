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
 * Finds the log entry for a specific exercise on a specific date.
 * Returns null if no log or no matching entry.
 *
 * @param {object|null} logDoc  — LogDoc from Firestore (has .entries array)
 * @param {number}      exerciseId
 * @returns {object|null}       — LogEntry or null
 */
function _findEntry(logDoc, exerciseId) {
  if (!logDoc || !Array.isArray(logDoc.entries)) return null;
  // Last entry wins — consistent with updateLogEntry behaviour
  const matches = logDoc.entries.filter(e => e.exerciseId === exerciseId);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

// ── Cell builders ──────────────────────────────────────────────────────────────

/**
 * Builds the content for an exercise data cell.
 * Returns an HTML string to set as innerHTML of td.cell-ex.
 *
 * @param {boolean}     applicable  — is this exercise scheduled for this date?
 * @param {object|null} entry       — LogEntry or null
 * @returns {string}                — HTML string
 */
function _buildCellContent(applicable, entry) {
  if (!applicable) {
    // Not applicable that day — dimmed dot
    return `<span class="cell-na"><span class="cell-na-inner">·</span></span>`;
  }

  if (!entry) {
    // Applicable but not logged — dash
    return `<span class="cell-empty">—</span>`;
  }

  if (entry.count === 0) {
    // Logged as skipped
    return `<span class="cell-skipped">skip</span>`;
  }

  // Logged with data — three-line display
  const unit      = entry.progressionLevel !== undefined
    ? _typeUnitForEntry(entry)
    : 'r';
  const countStr   = `${entry.count}${unit}`;
  const repeatsStr = `×${entry.repeats}`;
  const levelStr   = `L${entry.progressionLevel ?? 0}`;

  return `<span class="cell-logged">
    <span class="cell-prog">${levelStr}</span>
    <span class="cell-count">${countStr}</span>
    <span class="cell-repeats">${repeatsStr}</span>
  </span>`;
}

/**
 * Determines the unit suffix for a logged entry's count display.
 * We stored progressionLevel in the entry — use it to look up the exercise type.
 * Falls back to 'r' if lookup fails.
 *
 * @param {object} entry — LogEntry { exerciseId, progressionLevel, ... }
 * @returns {string}     — 'r' for Rep, 's' for Time
 */
function _typeUnitForEntry(entry) {
  const exercise = EXERCISES.find(e => e.id === entry.exerciseId);
  if (!exercise) return 'r';
  const prog = exercise.progressions[entry.progressionLevel ?? 0];
  return prog?.type === 'Time' ? 's' : 'r';
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
  // Determine which exercises appear in at least one of the 30 dates
  // so we don't show columns for exercises that never apply in this window.
  // An exercise is included if isApplicableOn() is true for ANY of the dates.
  const visibleExercises = EXERCISES.filter(exercise =>
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
    th.title       = exercise.displayName;   // full name on hover
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
      const entry      = _findEntry(logDoc, exercise.id);

      td.innerHTML = _buildCellContent(applicable, entry);
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
   */
  invalidateCache() {
    _cachedLogs    = null;
    _cachedDateStr = null;
  },
};