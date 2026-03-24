// logger.js — Exercise card rendering and log/add actions for Today screen.
//
// Listens for the 'app:ready' CustomEvent dispatched by app.js after successful
// startup. Renders one card per applicable exercise into #exercise-list.
// Handles Log (first session) and Add Session (subsequent sessions) actions
// including Firestore persistence.
//
// SESSION MODEL (revised):
//   Each exercise may have multiple LogEntry objects per day, one per session.
//   window._app.todayLog[id] is now LogEntry[] (array), not a single entry.
//   Log button: visible always, disabled after first session (C1 — no update).
//   Add Session button: hidden until first session, always enabled thereafter.
//   updateLogEntry() is no longer called — only saveLogEntry() is used.
//
// TIME-OF-DAY (revised T3.6):
//   Each exercise card has its own time-of-day <select>, pre-populated from
//   getTimeBucket() using the device clock at card build time. The patient can
//   override this per-card without affecting other cards.
//
// EXERCISE TYPES:
//   'Rep'     — count is reps,    unit label 'reps'
//   'Time'    — count is seconds, unit label 's'
//   'Minutes' — count is minutes, unit label 'min'  (Walk exercise only)
//
// DOM targets (verified against index.html):
//   #exercise-list   — card injection container (role="list")
//   #time-of-day     — global header select (display only — not read for saves)
//
// Dynamic element IDs (per card, where {id} = exercise.id):
//   #card-{id}            — article element (the card)
//   #card-body-{id}       — collapsible body div
//   #card-check-{id}      — checkmark span
//   #prog-badge-{id}      — progression level badge
//   #logged-summary-{id}  — logged state badge
//   #card-desc-{id}       — description paragraph
//   #log-form-{id}        — log form container
//   #count-{id}           — count number input
//   #repeats-{id}         — sets number input
//   #tod-select-{id}      — per-card time-of-day select
//   #log-error-{id}       — inline error paragraph
//   #log-btn-{id}         — Log button (disabled after first session)
//   #add-btn-{id}         — Add Session button (hidden until first session)
//
// CSS classes used (verified against styles.css):
//   .exercise-card, .exercise-card--logged, .exercise-card--open
//   .card-header, .card-chevron, .card-title-group, .card-exercise-name
//   .card-badges, .freq-badge, .freq-badge--daily/alt1/alt2, .prog-badge
//   .logged-summary, .card-check, .card-body, .card-description
//   .log-form, .log-inputs, .input-group, .input-label, .input-field
//   .input-unit, .btn-log, .btn-add, .empty-state
//   .tod-group (wraps the per-card time-of-day selector row)
//
// Firestore functions used (verified against firestore.js):
//   saveLogEntry(uid, dateStr, dayOfWeek, entry)   — 4 params, always
//   updateLogEntry() is NO LONGER CALLED (C1 decision)
//   todayStr()
//
// Reads from window._app (set by app.js):
//   .uid, .todayLog (LogEntry[]), .progressions, .todayExercises
//
// Calls window._app.updateTodayLog(exerciseId, entry) after each save.
//
// Imports from time-of-day.js:
//   getTimeBucket(hour) — to auto-populate per-card selects
//
// Exposes window._loggerModule = { refresh } for nav wiring in app.js.

import { saveLogEntry, todayStr }   from './firestore.js';
import { showToast }                               from './ui.js';
import { getProgressionData }                      from './progression.js';
import { getTimeBucket }                           from './time-of-day.js';

// ── Module state ───────────────────────────────────────────────────────────────

// Tracks which cards are in submitting state to prevent double-taps.
// Map of exerciseId → true while a Firestore write is in progress.
const _submitting = new Map();

// ── Time-of-day option values (must match index.html option values exactly) ────

const TIME_OF_DAY_OPTIONS = [
  'Early Morning',
  'Morning',
  'Lunch',
  'Early Afternoon',
  'Afternoon',
  'Early Evening',
  'Evening',
  'Late',
];

// ── SVG icons (inline — no external requests) ─────────────────────────────────

const SVG_CHEVRON = `
  <svg class="card-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const SVG_CHECK = `
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"
       width="16" height="16">
    <path d="M5 12l4 4 10-10" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

// ── Type helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the label, unit string, and summary suffix for an exercise type.
 * @param {string} type — 'Rep' | 'Time' | 'Minutes'
 * @returns {{ label: string, unit: string, summaryUnit: string }}
 */
function _typeInfo(type) {
  switch (type) {
    case 'Time':    return { label: 'Seconds', unit: 'seconds', summaryUnit: 's'   };
    case 'Minutes': return { label: 'Minutes', unit: 'min',     summaryUnit: 'min' };
    default:        return { label: 'Reps',    unit: 'reps',    summaryUnit: 'r'   };
  }
}

// ── Frequency badge helper ─────────────────────────────────────────────────────

/**
 * Returns the CSS modifier class for a frequency value.
 * @param {string} frequency — 'Daily' | 'Alt1' | 'Alt2'
 * @returns {string}
 */
function _freqClass(frequency) {
  switch (frequency) {
    case 'Daily': return 'freq-badge--daily';
    case 'Alt1':  return 'freq-badge--alt1';
    case 'Alt2':  return 'freq-badge--alt2';
    case 'shelved':  return 'freq-badge--shelved';
    default:      return 'freq-badge--daily';
  }
}

// ── Per-card time-of-day select builder ────────────────────────────────────────

/**
 * Builds a time-of-day selector row for an exercise card.
 * Auto-populates to the current bucket; the patient can freely change it.
 * If entry is provided (editing a logged exercise), pre-selects the stored value.
 *
 * @param {number}      exerciseId — used for the select's id attribute
 * @param {string|null} storedValue — timeOfDay from an existing LogEntry, or null
 * @returns {HTMLElement} — div.tod-group containing label + select
 */
function _buildTodSelect(exerciseId, storedValue) {
  const hour          = new Date().getHours();
  const currentBucket = getTimeBucket(hour);
  const selectedValue = storedValue ?? currentBucket;

  const group = document.createElement('div');
  group.className = 'tod-group';

  const label = document.createElement('label');
  label.className   = 'input-label';
  label.htmlFor     = `tod-select-${exerciseId}`;
  label.textContent = 'Time of day';

  const select = document.createElement('select');
  select.className = 'input-field tod-select';
  select.id        = `tod-select-${exerciseId}`;
  select.name      = `tod-select-${exerciseId}`;
  select.setAttribute('aria-label', 'Time of day for this exercise');

  TIME_OF_DAY_OPTIONS.forEach(bucket => {
    const option = document.createElement('option');
    option.value       = bucket;
    option.textContent = bucket;
    if (bucket === selectedValue) option.selected = true;
    select.appendChild(option);
  });

  group.appendChild(label);
  group.appendChild(select);

  return group;
}

// ── Card HTML builder ──────────────────────────────────────────────────────────

/**
 * Builds and returns an exercise card DOM element.
 * Card state (logged vs unlogged) is set immediately based on todayLog.
 *
 * @param {object} exercise    — ExerciseObject from exercises.js
 * @param {object|null} entry  — existing LogEntry for today, or null
 * @returns {HTMLElement}
 */
function _buildCard(exercise, entries) {
  const { id, displayName, frequency } = exercise;

  // Get current progression data
  const prog  = getProgressionData(id);
  const level = window._app.progressions[id] ?? 0;

  // entries is LogEntry[] — array from todayLog[id], or empty array
  const isLogged = entries.length > 0;

  // ── Outer card ─────────────────────────────────────────────────────────────
  const card = document.createElement('article');
  card.className  = 'exercise-card' + (isLogged ? ' exercise-card--logged' : '');
  card.id         = `card-${id}`;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-expanded', 'false');

  // ── Card header ────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'card-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-controls', `card-body-${id}`);
  header.setAttribute('aria-label', `${displayName} — tap to expand`);

  // Title group: name + badges
  const titleGroup = document.createElement('div');
  titleGroup.className = 'card-title-group';

  const nameEl = document.createElement('div');
  nameEl.className   = 'card-exercise-name';
  nameEl.textContent = displayName;

  const badges = document.createElement('div');
  badges.className = 'card-badges';

  // Frequency badge
  const freqBadge = document.createElement('span');
  freqBadge.className   = `freq-badge ${_freqClass(frequency)}`;
  freqBadge.textContent = frequency;
  badges.appendChild(freqBadge);

  if (isLogged) {
    // Show logged summary instead of progression badge
    const summary = document.createElement('span');
    summary.className   = 'logged-summary';
    summary.id          = `logged-summary-${id}`;
    summary.textContent = _buildBadgeLabel(entries, prog);
    badges.appendChild(summary);
  } else {
    // Show progression level badge
    const progBadge = document.createElement('span');
    progBadge.className   = 'prog-badge';
    progBadge.id          = `prog-badge-${id}`;
    progBadge.textContent = exercise.maxProgression === 0
      ? 'Single level'
      : `Level ${level} of ${exercise.maxProgression}`;
    badges.appendChild(progBadge);
  }

  titleGroup.appendChild(nameEl);
  titleGroup.appendChild(badges);
  header.appendChild(titleGroup);

  // Checkmark (only when logged)
  if (isLogged) {
    const check = document.createElement('span');
    check.className  = 'card-check';
    check.id         = `card-check-${id}`;
    check.innerHTML  = SVG_CHECK;
    header.appendChild(check);
  } else {
    // Placeholder span keeps layout consistent; hidden until logged
    const checkPlaceholder = document.createElement('span');
    checkPlaceholder.id        = `card-check-${id}`;
    checkPlaceholder.className = 'card-check';
    checkPlaceholder.style.display = 'none';
    checkPlaceholder.innerHTML = SVG_CHECK;
    header.appendChild(checkPlaceholder);
  }

  // Chevron
  header.insertAdjacentHTML('beforeend', SVG_CHEVRON);

  card.appendChild(header);

  // ── Card body (collapsible) ────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'card-body';
  body.id        = `card-body-${id}`;

  // Description
  const desc = document.createElement('p');
  desc.className   = 'card-description';
  desc.id          = `card-desc-${id}`;
  desc.textContent = prog ? prog.description : '—';
  body.appendChild(desc);

  // Log form
  const form = _buildLogForm(exercise, entries, prog);
  body.appendChild(form);

  card.appendChild(body);

  // ── Header click / keyboard handlers ──────────────────────────────────────
  function toggleCard() {
    const open = card.classList.toggle('exercise-card--open');
    card.setAttribute('aria-expanded', String(open));
    header.setAttribute('aria-label',
      `${displayName} — ${open ? 'tap to collapse' : 'tap to expand'}`);
  }

  header.addEventListener('click', toggleCard);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCard();
    }
  });

  return card;
}

// ── Log form builder ───────────────────────────────────────────────────────────

/**
 * Builds the log form portion of a card body.
 * entries is LogEntry[] from todayLog — empty array if not yet logged.
 * Log button: always rendered, disabled once entries.length > 0 (C1).
 * Add Session button: rendered always, hidden until entries.length > 0.
 * Inputs pre-filled from progression defaults (not from stored entry).
 *
 * @param {object}   exercise — ExerciseObject
 * @param {object[]} entries  — LogEntry[] for today (may be empty)
 * @param {object|null} prog  — current ProgressionLevel or null
 * @returns {HTMLElement}
 */
function _buildLogForm(exercise, entries, prog) {
  const { id } = exercise;
  const isLogged = entries.length > 0;

  const typeInfo   = _typeInfo(prog?.type ?? 'Rep');
  const countVal   = prog?.defaultCount   ?? 10;
  const repeatsVal = prog?.defaultRepeats ?? 1;

  const form = document.createElement('div');
  form.className = 'log-form';
  form.id        = `log-form-${id}`;

  // ── Input grid (count + sets) ──────────────────────────────────────────────
  const inputGrid = document.createElement('div');
  inputGrid.className = 'log-inputs';

  inputGrid.appendChild(_buildInputGroup(
    `count-${id}`,
    typeInfo.label,
    countVal,
    typeInfo.unit
  ));

  inputGrid.appendChild(_buildInputGroup(
    `repeats-${id}`,
    'Sets',
    repeatsVal,
    'sets'
  ));

  form.appendChild(inputGrid);

  // ── Time-of-day selector ───────────────────────────────────────────────────
  // Always auto-populated from clock (no stored entry pre-fill — C1).
  const todGroup = _buildTodSelect(id, null);
  form.appendChild(todGroup);

  // ── Inline error message ───────────────────────────────────────────────────
  const errorEl = document.createElement('p');
  errorEl.id        = `log-error-${id}`;
  errorEl.className = 'empty-state';
  errorEl.style.cssText = 'display:none; color:var(--clr-error); padding:var(--sp-2) 0; font-size:0.8125rem;';
  form.appendChild(errorEl);

  // ── Log button (disabled once logged — C1) ─────────────────────────────────
  const logBtn = document.createElement('button');
  logBtn.className   = 'btn-log';
  logBtn.id          = `log-btn-${id}`;
  logBtn.type        = 'button';
  logBtn.textContent = 'Log Exercise';
  logBtn.disabled    = isLogged;
  logBtn.addEventListener('click', () => _handleLogClick(exercise, prog));
  form.appendChild(logBtn);

  // ── Add Session button (hidden until first session logged) ─────────────────
  const addBtn = document.createElement('button');
  addBtn.className          = 'btn-add';
  addBtn.id                 = `add-btn-${id}`;
  addBtn.type               = 'button';
  addBtn.textContent        = '+ Add Session';
  addBtn.style.display      = isLogged ? '' : 'none';
  addBtn.addEventListener('click', () => _handleAdd(exercise, prog));
  form.appendChild(addBtn);

  return form;
}

/**
 * Builds a single input group (label + number input + unit hint).
 *
 * @param {string} inputId
 * @param {string} labelText
 * @param {number} value
 * @param {string} unitText
 * @returns {HTMLElement}
 */
function _buildInputGroup(inputId, labelText, value, unitText) {
  const group = document.createElement('div');
  group.className = 'input-group';

  const label = document.createElement('label');
  label.className   = 'input-label';
  label.htmlFor     = inputId;
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type      = 'number';
  input.className = 'input-field';
  input.id        = inputId;
  input.name      = inputId;
  input.value     = value;
  input.min       = '1';
  input.max       = '999';
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('pattern',   '[0-9]*');

  const unit = document.createElement('div');
  unit.className   = 'input-unit';
  unit.textContent = unitText;

  group.appendChild(label);
  group.appendChild(input);
  group.appendChild(unit);

  return group;
}

// ── Log / Update action ────────────────────────────────────────────────────────

/**
 * Handles the Log button click for an exercise card.
 * Only called for the FIRST session (C1). Log button is disabled after first save.
 * Validates inputs, builds LogEntry, calls saveLogEntry(), updates UI.
 *
 * @param {object} exercise — ExerciseObject
 * @param {object} prog     — current ProgressionLevel
 */
async function _handleLogClick(exercise, prog) {
  const { id } = exercise;

  // Prevent double-tap
  if (_submitting.get(id)) return;

  // ── Read inputs ──────────────────────────────────────────────────────────
  const countInput   = document.getElementById(`count-${id}`);
  const repeatsInput = document.getElementById(`repeats-${id}`);
  const todSelect    = document.getElementById(`tod-select-${id}`);
  const errorEl      = document.getElementById(`log-error-${id}`);
  const btn          = document.getElementById(`log-btn-${id}`);

  const count   = parseInt(countInput?.value,   10);
  const repeats = parseInt(repeatsInput?.value, 10);

  const timeOfDay = todSelect?.value ?? getTimeBucket(new Date().getHours());

  // ── Validate ──────────────────────────────────────────────────────────────
  const typeInfo = _typeInfo(prog?.type ?? 'Rep');

  if (!Number.isInteger(count) || count < 1) {
    _showInlineError(id, `Please enter a valid ${typeInfo.unit} value.`);
    countInput?.focus();
    return;
  }

  if (!Number.isInteger(repeats) || repeats < 1) {
    _showInlineError(id, 'Please enter a valid sets value.');
    repeatsInput?.focus();
    return;
  }

  _clearInlineError(id);

  // ── Build log entry ───────────────────────────────────────────────────────
  const uid       = window._app.uid;
  const today     = todayStr();
  const now       = new Date();
  const dayOfWeek = now.getDay();
  const level     = window._app.progressions[id] ?? 0;

  const newEntry = {
    exerciseId:       id,
    progressionLevel: level,
    timeOfDay,
    count,
    repeats,
    loggedAt: now.toISOString(),
  };

  // ── Disable button during write ───────────────────────────────────────────
  _submitting.set(id, true);
  if (btn) {
    btn.disabled    = true;
    btn.textContent = 'Saving…';
  }

  // ── Firestore write — always saveLogEntry (never update) ──────────────────
  const result = await saveLogEntry(uid, today, dayOfWeek, newEntry);

  // ── Re-enable button on failure only — stays disabled on success (C1) ─────
  _submitting.delete(id);

  if (!result.success) {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = 'Log Exercise';
    }
    showToast('Could not save — please try again.', 'error');
    console.error('logger.js _handleLogClick: Firestore write failed:', result.error);
    return;
  }

  // ── Success — update memory via app.js contract ───────────────────────────
  window._app.updateTodayLog(id, newEntry);

  // ── Update card UI to logged state ────────────────────────────────────────
  _setCardLogged(id, newEntry, prog, exercise.maxProgression, level);

  showToast(`${exercise.name} logged!`, 'success');
  console.log(`logger.js: exercise ${id} logged`);

  // Invalidate history cache so the history screen reflects the new entry
  if (window._historyModule?.invalidateCache) window._historyModule.invalidateCache();
}

// ── Add Session action ─────────────────────────────────────────────────────────

/**
 * Handles the Add Session button click.
 * Appends a new LogEntry for this exercise — same Firestore path as saveLogEntry.
 * Called for every session after the first (C1: Log button is disabled after first).
 * Add button is re-enabled after failure so the patient can retry.
 *
 * @param {object} exercise — ExerciseObject
 * @param {object} prog     — current ProgressionLevel
 */
async function _handleAdd(exercise, prog) {
  const { id } = exercise;

  // Prevent double-tap
  if (_submitting.get(id)) return;

  // ── Read inputs ──────────────────────────────────────────────────────────
  const countInput   = document.getElementById(`count-${id}`);
  const repeatsInput = document.getElementById(`repeats-${id}`);
  const todSelect    = document.getElementById(`tod-select-${id}`);
  const addBtn       = document.getElementById(`add-btn-${id}`);

  const count   = parseInt(countInput?.value,   10);
  const repeats = parseInt(repeatsInput?.value, 10);
  const timeOfDay = todSelect?.value ?? getTimeBucket(new Date().getHours());

  // ── Validate ──────────────────────────────────────────────────────────────
  const typeInfo = _typeInfo(prog?.type ?? 'Rep');

  if (!Number.isInteger(count) || count < 1) {
    _showInlineError(id, `Please enter a valid ${typeInfo.unit} value.`);
    countInput?.focus();
    return;
  }

  if (!Number.isInteger(repeats) || repeats < 1) {
    _showInlineError(id, 'Please enter a valid sets value.');
    repeatsInput?.focus();
    return;
  }

  _clearInlineError(id);

  // ── Build entry ───────────────────────────────────────────────────────────
  const uid       = window._app.uid;
  const today     = todayStr();
  const now       = new Date();
  const dayOfWeek = now.getDay();
  const level     = window._app.progressions[id] ?? 0;

  const newEntry = {
    exerciseId:       id,
    progressionLevel: level,
    timeOfDay,
    count,
    repeats,
    loggedAt: now.toISOString(),
  };

  // ── Disable Add button during write ──────────────────────────────────────
  _submitting.set(id, true);
  if (addBtn) {
    addBtn.disabled    = true;
    addBtn.textContent = 'Saving…';
  }

  // ── Firestore write — always saveLogEntry (arrayUnion appends) ────────────
  const result = await saveLogEntry(uid, today, dayOfWeek, newEntry);

  _submitting.delete(id);

  if (!result.success) {
    if (addBtn) {
      addBtn.disabled    = false;
      addBtn.textContent = '+ Add Session';
    }
    showToast('Could not save — please try again.', 'error');
    console.error('logger.js _handleAdd: Firestore write failed:', result.error);
    return;
  }

  // ── Success — append to memory and update badge ───────────────────────────
  window._app.updateTodayLog(id, newEntry);

  // Re-enable Add button for next session
  if (addBtn) {
    addBtn.disabled    = false;
    addBtn.textContent = '+ Add Session';
  }

  // Update the summary badge with new session count
  const allEntries = window._app.todayLog[id] ?? [];
  const summaryEl  = document.getElementById(`logged-summary-${id}`);
  if (summaryEl && prog) {
    summaryEl.textContent = _buildBadgeLabel(allEntries, prog);
  }

  showToast(`${exercise.name} session added!`, 'success');
  console.log(`logger.js: exercise ${id} session added — total ${allEntries.length}`);

  // Invalidate history cache so the history screen reflects the new session
  if (window._historyModule?.invalidateCache) window._historyModule.invalidateCache();
}

// ── Card UI state transitions ──────────────────────────────────────────────────

/**
 * Transitions a card to logged state after a successful first save.
 * Updates badges, shows checkmark, disables Log button, reveals Add button.
 * Called only from _handleLogClick (first session).
 */
function _setCardLogged(exerciseId, entry, prog, maxProgression, level) {
  const card = document.getElementById(`card-${exerciseId}`);
  if (!card) return;

  // Apply logged CSS modifier and collapse
  card.classList.add('exercise-card--logged');
  card.classList.remove('exercise-card--open');
  card.setAttribute('aria-expanded', 'false');

  // Update logged summary badge
  const badges    = card.querySelector('.card-badges');
  const progBadge = document.getElementById(`prog-badge-${exerciseId}`);
  let   summaryEl = document.getElementById(`logged-summary-${exerciseId}`);

  if (progBadge) progBadge.style.display = 'none';

  if (!summaryEl) {
    summaryEl           = document.createElement('span');
    summaryEl.className = 'logged-summary';
    summaryEl.id        = `logged-summary-${exerciseId}`;
    if (badges) badges.appendChild(summaryEl);
  }

  // Build badge from entries array (just first session at this point)
  const allEntries = window._app.todayLog[exerciseId] ?? [];
  summaryEl.textContent  = _buildBadgeLabel(allEntries, prog);
  summaryEl.style.display = '';

  // Show checkmark
  const checkEl = document.getElementById(`card-check-${exerciseId}`);
  if (checkEl) checkEl.style.display = '';

  // Disable Log button (C1 — no update ever)
  const logBtn = document.getElementById(`log-btn-${exerciseId}`);
  if (logBtn) {
    logBtn.disabled    = true;
    logBtn.textContent = 'Log Exercise';
  }

  // Reveal Add Session button
  const addBtn = document.getElementById(`add-btn-${exerciseId}`);
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.disabled      = false;
  }
}

// ── Inline error helpers ───────────────────────────────────────────────────────

function _showInlineError(exerciseId, message) {
  const errorEl = document.getElementById(`log-error-${exerciseId}`);
  if (errorEl) {
    errorEl.textContent   = message;
    errorEl.style.display = '';
  }
}

function _clearInlineError(exerciseId) {
  const errorEl = document.getElementById(`log-error-${exerciseId}`);
  if (errorEl) {
    errorEl.textContent   = '';
    errorEl.style.display = 'none';
  }
}

// ── Badge label builder ────────────────────────────────────────────────────────

/**
 * Builds the logged-summary badge text from the full entries array.
 *
 * Minutes type (Walk):
 *   Shows session count and cumulative total minutes.
 *   Example: "2 sessions · 45min total"
 *
 * Rep / Time type:
 *   Shows progress toward defaultRepeats.
 *   Example: "1 of 3 sets"  (under target)
 *            "3+ sets"       (at or over target)
 *
 * @param {object[]} entries   — LogEntry[] for this exercise today
 * @param {object|null} prog   — ProgressionLevel (for type and defaultRepeats)
 * @returns {string}
 */
function _buildBadgeLabel(entries, prog) {
  if (!prog || entries.length === 0) return '—';

  if (prog.type === 'Minutes') {
    const totalMins = entries.reduce((s, e) => s + e.count, 0);
    const sessions  = entries.length;
    return `${sessions} session${sessions > 1 ? 's' : ''} · ${totalMins}min total`;
  }

  const n = entries.length;
  const m = prog.defaultRepeats ?? 1;
  return n >= m ? `${n}+ sets` : `${n} of ${m} sets`;
}

// ── Card list renderer ─────────────────────────────────────────────────────────

/**
 * Renders all exercise cards for today into #exercise-list.
 * Clears any existing content first (safe to call on refresh).
 *
 * @param {object[]} todayExercises — from event.detail.todayExercises
 * @param {object}   todayLog       — { [exerciseId]: LogEntry[] }
 */
function _renderCards(todayExercises, todayLog) {
  const list = document.getElementById('exercise-list');
  if (!list) {
    console.error('logger.js _renderCards: #exercise-list not found');
    return;
  }

  list.innerHTML = '';

  if (!todayExercises || todayExercises.length === 0) {
    const empty = document.createElement('p');
    empty.className   = 'empty-state';
    empty.textContent = 'No exercises scheduled for today.';
    list.appendChild(empty);
    return;
  }

  todayExercises.forEach(exercise => {
    // Pass entries array (may be empty) — never null
    const entries = todayLog[exercise.id] ?? [];
    const card    = _buildCard(exercise, entries);
    list.appendChild(card);
  });

  console.log(`logger.js: rendered ${todayExercises.length} cards`);
}

// ── app:ready listener ─────────────────────────────────────────────────────────

window.addEventListener('app:ready', event => {
  const { todayExercises, todayLog } = event.detail;
  _renderCards(todayExercises, todayLog);
});

// ── Module interface (for nav refresh wiring in app.js) ───────────────────────

window._loggerModule = {
  /**
   * Re-renders cards from current window._app state.
   * Called by app.js when user taps the Today nav button.
   * Per-card time-of-day selects are re-populated from the clock on rebuild.
   */
  refresh() {
    _renderCards(
      window._app.todayExercises,
      window._app.todayLog
    );
  }
};