// logger.js — Exercise card rendering and log/update actions for Today screen.
//
// Listens for the 'app:ready' CustomEvent dispatched by app.js after successful
// startup. Renders one card per applicable exercise into #exercise-list.
// Handles Log and Update button actions including Firestore persistence.
//
// TIME-OF-DAY (revised T3.6):
//   Each exercise card has its own time-of-day <select>, pre-populated from
//   getTimeBucket() using the device clock at card build time. The patient can
//   override this per-card without affecting other cards. This allows accurate
//   recording when logging exercises done at different times of day, or when
//   entering data after the fact.
//
// EXERCISE TYPES:
//   'Rep'     — count is reps,    unit label 'reps'
//   'Time'    — count is seconds, unit label 's'
//   'Minutes' — count is minutes, unit label 'min'  (Walk exercise only)
//
// DOM targets (verified against index.html T3.1):
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
//   #log-btn-{id}         — Log / Update button
//
// CSS classes used (verified against styles.css T3.1):
//   .exercise-card, .exercise-card--logged, .exercise-card--open
//   .card-header, .card-chevron, .card-title-group, .card-exercise-name
//   .card-badges, .freq-badge, .freq-badge--daily/alt1/alt2, .prog-badge
//   .logged-summary, .card-check, .card-body, .card-description
//   .log-form, .log-inputs, .input-group, .input-label, .input-field
//   .input-unit, .btn-log, .btn-log--update, .empty-state
//   .tod-group (new — wraps the per-card time-of-day selector row)
//
// Firestore functions used (verified against firestore.js):
//   saveLogEntry(uid, dateStr, dayOfWeek, entry)   — 4 params
//   updateLogEntry(uid, dateStr, oldEntry, newEntry)
//   todayStr()
//
// Reads from window._app (set by app.js):
//   .uid, .todayLog, .progressions, .todayExercises
//
// Calls window._app.updateTodayLog(exerciseId, entry) after each save.
//
// Imports from time-of-day.js:
//   getTimeBucket(hour) — to auto-populate per-card selects
//
// Exposes window._loggerModule = { refresh } for nav wiring in app.js.

import { saveLogEntry, updateLogEntry, todayStr } from './firestore.js';
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
function _buildCard(exercise, entry) {
  const { id, displayName, frequency } = exercise;

  // Get current progression data
  const prog  = getProgressionData(id);
  const level = window._app.progressions[id] ?? 0;

  // Determine initial state
  const isLogged = !!entry;

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
    summary.textContent = _buildSummaryText(entry, prog);
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
  const form = _buildLogForm(exercise, entry, prog);
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
 * If entry is provided, pre-fills inputs and sets Update mode.
 * Includes a per-card time-of-day select, auto-populated from device clock
 * or pre-filled from the stored entry when editing.
 *
 * @param {object}      exercise  — ExerciseObject
 * @param {object|null} entry     — existing LogEntry or null
 * @param {object|null} prog      — current ProgressionLevel or null
 * @returns {HTMLElement}
 */
function _buildLogForm(exercise, entry, prog) {
  const { id } = exercise;
  const isUpdate = !!entry;

  const typeInfo   = _typeInfo(prog?.type ?? 'Rep');
  const countVal   = entry ? entry.count   : (prog?.defaultCount   ?? 10);
  const repeatsVal = entry ? entry.repeats : (prog?.defaultRepeats ?? 1);

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
  // Stored value used when editing; null causes auto-population from clock.
  const storedTod = entry ? (entry.timeOfDay ?? null) : null;
  const todGroup  = _buildTodSelect(id, storedTod);
  form.appendChild(todGroup);

  // ── Inline error message ───────────────────────────────────────────────────
  const errorEl = document.createElement('p');
  errorEl.id        = `log-error-${id}`;
  errorEl.className = 'empty-state';
  errorEl.style.cssText = 'display:none; color:var(--clr-error); padding:var(--sp-2) 0; font-size:0.8125rem;';
  form.appendChild(errorEl);

  // ── Log / Update button ────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.className   = 'btn-log' + (isUpdate ? ' btn-log--update' : '');
  btn.id          = `log-btn-${id}`;
  btn.type        = 'button';
  btn.textContent = isUpdate ? 'Update' : 'Log Exercise';
  btn.addEventListener('click', () => _handleLogClick(exercise, prog));
  form.appendChild(btn);

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
 * Handles the Log / Update button click for an exercise card.
 * Validates inputs, reads per-card time-of-day select, builds LogEntry,
 * calls Firestore, updates UI.
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

  // Read time of day from the per-card select.
  // Falls back to auto-detected bucket if select is somehow missing.
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
    timeOfDay,          // from per-card select
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

  // ── Firestore write ───────────────────────────────────────────────────────
  const existingEntry = window._app.todayLog[id] ?? null;
  let result;

  if (existingEntry) {
    result = await updateLogEntry(uid, today, existingEntry, newEntry);
  } else {
    result = await saveLogEntry(uid, today, dayOfWeek, newEntry);
  }

  // ── Re-enable button regardless of outcome ────────────────────────────────
  _submitting.delete(id);

  if (!result.success) {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = existingEntry ? 'Update' : 'Log Exercise';
    }
    showToast('Could not save — please try again.', 'error');
    console.error('logger.js _handleLogClick: Firestore write failed:', result.error);
    return;
  }

  // ── Success — update memory via app.js contract ───────────────────────────
  window._app.updateTodayLog(id, newEntry);

  // ── Update card UI to logged state ────────────────────────────────────────
  _setCardLogged(id, newEntry, prog, exercise.maxProgression, level);

  const action = existingEntry ? 'updated' : 'logged';
  showToast(`${exercise.name} ${action}!`, 'success');
  console.log(`logger.js: exercise ${id} ${action}`);
}

// ── Card UI state transitions ──────────────────────────────────────────────────

/**
 * Transitions a card to logged state after a successful save.
 * Updates badges, shows checkmark, swaps button to Update mode,
 * and collapses the card.
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

  summaryEl.textContent  = _buildSummaryText(entry, prog);
  summaryEl.style.display = '';

  // Show checkmark
  const checkEl = document.getElementById(`card-check-${exerciseId}`);
  if (checkEl) checkEl.style.display = '';

  // Swap button to Update mode
  const btn = document.getElementById(`log-btn-${exerciseId}`);
  if (btn) {
    btn.disabled    = false;
    btn.textContent = 'Update';
    btn.classList.add('btn-log--update');
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

// ── Summary text builder ───────────────────────────────────────────────────────

/**
 * Builds the short logged-summary text shown in the card badge.
 * Examples:
 *   'Rep'     → "15r × 3 · Morning"
 *   'Time'    → "45s × 3 · Afternoon"
 *   'Minutes' → "35min × 1 · Early Morning"
 *
 * @param {object} entry — LogEntry
 * @param {object} prog  — ProgressionLevel (for type)
 * @returns {string}
 */
function _buildSummaryText(entry, prog) {
  const { summaryUnit } = _typeInfo(prog?.type ?? 'Rep');
  return `${entry.count}${summaryUnit} × ${entry.repeats} · ${entry.timeOfDay}`;
}

// ── Card list renderer ─────────────────────────────────────────────────────────

/**
 * Renders all exercise cards for today into #exercise-list.
 * Clears any existing content first (safe to call on refresh).
 *
 * @param {object[]} todayExercises — from event.detail.todayExercises
 * @param {object}   todayLog       — TodayLogIndex { [exerciseId]: LogEntry }
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
    const entry = todayLog[exercise.id] ?? null;
    const card  = _buildCard(exercise, entry);
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