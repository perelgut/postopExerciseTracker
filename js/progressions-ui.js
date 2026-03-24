// progressions-ui.js — Progressions screen: shows all 12 exercises with their
// current level and Advance / Revert controls.
//
// T3.9: All exercises are shown regardless of the day of the week — this screen
// is for managing progression levels, not today's schedule.
//
// Listens for the 'app:ready' CustomEvent dispatched by app.js.
// Responds to nav refresh via window._progressionsModule.refresh().
//
// DOM target (verified against index.html T3.1):
//   #progression-list   — injection container, role="list", class="exercise-list"
//
// Card element IDs (keyed by exerciseId):
//   #prog-card-{id}      — outer article element
//   #prog-chip-{id}      — level chip (updated on advance/revert)
//   #prog-desc-{id}      — description paragraph (updated on advance/revert)
//   #prog-advance-{id}   — Advance button
//   #prog-revert-{id}    — Revert button
//
// CSS classes used (verified against styles.css T3.1 + additions in this task):
//   .progression-card, .prog-card-header, .prog-card-name
//   .prog-level-chip, .prog-level-chip--maxed
//   .prog-description
//   .prog-card-actions   ← new (added to styles.css in this task)
//   .btn-advance
//   .btn-revert          ← new (added to styles.css in this task)
//   .freq-badge, .freq-badge--daily, .freq-badge--alt1, .freq-badge--alt2
//   .empty-state
//
// Imports:
//   getExerciseProgressionSummary(exerciseId) → ProgressionSummary | null
//   setLevel(exerciseId, newLevel)            → Promise<{ success, error? }>
//   EXERCISES                                 — for iterating all exercise ids
//
// Reads from window._app:
//   .progressions  — for getExerciseProgressionSummary() via progression.js
//   .uid           — for setLevel() → Firestore write
//
// Exposes:
//   window._progressionsModule = { refresh() }
//   Called by app.js nav wiring when user taps the Progressions nav button.

import { getExerciseProgressionSummary, setLevel } from './progression.js';
import { showToast }                               from './ui.js';
import { EXERCISES }                               from './exercises.js';

// ── Submitting guard — prevents double-tap during Firestore write ──────────────
// Map of exerciseId → true while a write is in progress.
const _submitting = new Map();

// ── Frequency badge helper (same logic as logger.js) ──────────────────────────

function _freqClass(frequency) {
  switch (frequency) {
    case 'Daily': return 'freq-badge--daily';
    case 'Alt1':  return 'freq-badge--alt1';
    case 'Alt2':  return 'freq-badge--alt2';
    case 'shelved':  return 'freq-badge--shelved';
    default:      return 'freq-badge--daily';
  }
}

// ── Level chip text helper ─────────────────────────────────────────────────────

/**
 * Builds the text shown in the level chip on each card.
 * @param {number} currentLevel
 * @param {number} maxProgression
 * @returns {string}
 */
function _chipText(currentLevel, maxProgression) {
  if (maxProgression === 0) return 'Single level';
  return `Level ${currentLevel} of ${maxProgression}`;
}

// ── Card builder ───────────────────────────────────────────────────────────────

/**
 * Builds a single progression card article for the given exercise.
 * Uses getExerciseProgressionSummary() to get all needed data in one call.
 *
 * @param {number} exerciseId
 * @returns {HTMLElement|null} — null if summary unavailable
 */
function _buildCard(exerciseId) {
  const summary = getExerciseProgressionSummary(exerciseId);
  if (!summary) {
    console.warn(`progressions-ui.js _buildCard: no summary for exerciseId ${exerciseId}`);
    return null;
  }

  const {
    id, displayName, frequency,
    currentLevel, maxProgression,
    canAdvance: adv, canRevert: rev,
    description,
  } = summary;

  // ── Outer card ─────────────────────────────────────────────────────────────
  const card = document.createElement('article');
  card.className = 'progression-card';
  card.id        = `prog-card-${id}`;
  card.setAttribute('role', 'listitem');

  // ── Card header: name + frequency badge + level chip ───────────────────────
  const header = document.createElement('div');
  header.className = 'prog-card-header';

  // Left side: name + frequency badge
  const nameGroup = document.createElement('div');
  nameGroup.className = 'prog-name-group';

  const nameEl = document.createElement('div');
  nameEl.className   = 'prog-card-name';
  nameEl.textContent = displayName;

  const freqBadge = document.createElement('span');
  freqBadge.className   = `freq-badge ${_freqClass(frequency)}`;
  freqBadge.textContent = frequency;

  nameGroup.appendChild(nameEl);
  nameGroup.appendChild(freqBadge);

  // Right side: level chip
  const chip = document.createElement('span');
  chip.className   = 'prog-level-chip' + (maxProgression === 0 || !adv
    ? ' prog-level-chip--maxed' : '');
  chip.id          = `prog-chip-${id}`;
  chip.textContent = _chipText(currentLevel, maxProgression);

  header.appendChild(nameGroup);
  header.appendChild(chip);
  card.appendChild(header);

  // ── Description ────────────────────────────────────────────────────────────
  const desc = document.createElement('p');
  desc.className   = 'prog-description';
  desc.id          = `prog-desc-${id}`;
  desc.textContent = description;
  card.appendChild(desc);

  // ── Action buttons ─────────────────────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'prog-card-actions';

  // Revert button
  const revertBtn = document.createElement('button');
  revertBtn.type      = 'button';
  revertBtn.className = 'btn-revert';
  revertBtn.id        = `prog-revert-${id}`;
  revertBtn.textContent = '↓ Revert';
  revertBtn.disabled  = !rev;
  revertBtn.setAttribute('aria-label', `Revert ${displayName} to previous level`);
  revertBtn.addEventListener('click', () => _handleLevelChange(id, currentLevel - 1));

  // Advance button
  const advanceBtn = document.createElement('button');
  advanceBtn.type      = 'button';
  advanceBtn.className = 'btn-advance';
  advanceBtn.id        = `prog-advance-${id}`;
  advanceBtn.textContent = maxProgression === 0 ? 'Max level' : '↑ Advance';
  advanceBtn.disabled  = !adv;
  advanceBtn.setAttribute('aria-label', `Advance ${displayName} to next level`);
  advanceBtn.addEventListener('click', () => _handleLevelChange(id, currentLevel + 1));

  actions.appendChild(revertBtn);
  actions.appendChild(advanceBtn);
  card.appendChild(actions);

  return card;
}

// ── Level change handler ───────────────────────────────────────────────────────

/**
 * Handles an Advance or Revert button click.
 * Calls setLevel(), then updates the card UI on success.
 *
 * @param {number} exerciseId
 * @param {number} newLevel  — currentLevel ± 1
 */
async function _handleLevelChange(exerciseId, newLevel) {
  if (_submitting.get(exerciseId)) return;

  const advanceBtn = document.getElementById(`prog-advance-${exerciseId}`);
  const revertBtn  = document.getElementById(`prog-revert-${exerciseId}`);

  // Disable both buttons while saving
  _submitting.set(exerciseId, true);
  if (advanceBtn) { advanceBtn.disabled = true; advanceBtn.textContent = 'Saving…'; }
  if (revertBtn)  { revertBtn.disabled  = true; }

  const result = await setLevel(exerciseId, newLevel);

  _submitting.delete(exerciseId);

  if (!result.success) {
    // Restore button state
    _refreshCard(exerciseId);
    showToast('Could not save — please try again.', 'error');
    console.error(`progressions-ui.js: setLevel failed for exercise ${exerciseId}:`,
                  result.error);
    return;
  }

  // Success — refresh the card UI to reflect new level
  _refreshCard(exerciseId);

  const summary = getExerciseProgressionSummary(exerciseId);
  const direction = newLevel > (summary?.currentLevel ?? newLevel)
    ? 'advanced' : 'reverted';
  // Note: after setLevel() updates window._app.progressions, summary reflects the NEW level.
  // The direction label is cosmetic — we just show a generic success toast.
  showToast('Progression updated!', 'success');
  console.log(`progressions-ui.js: exercise ${exerciseId} → level ${newLevel}`);
}

// ── Card in-place refresh ──────────────────────────────────────────────────────

/**
 * Updates the chip text, description, and button states for an existing card
 * in-place — without rebuilding the entire list.
 * Called after a successful Advance or Revert.
 *
 * @param {number} exerciseId
 */
function _refreshCard(exerciseId) {
  const summary = getExerciseProgressionSummary(exerciseId);
  if (!summary) return;

  const { currentLevel, maxProgression, canAdvance: adv, canRevert: rev,
          description, displayName } = summary;

  const chip       = document.getElementById(`prog-chip-${exerciseId}`);
  const desc       = document.getElementById(`prog-desc-${exerciseId}`);
  const advanceBtn = document.getElementById(`prog-advance-${exerciseId}`);
  const revertBtn  = document.getElementById(`prog-revert-${exerciseId}`);

  if (chip) {
    chip.textContent = _chipText(currentLevel, maxProgression);
    chip.className   = 'prog-level-chip' +
      (maxProgression === 0 || !adv ? ' prog-level-chip--maxed' : '');
  }

  if (desc) {
    desc.textContent = description;
  }

  if (advanceBtn) {
    advanceBtn.disabled    = !adv;
    advanceBtn.textContent = maxProgression === 0 ? 'Max level' : '↑ Advance';
    advanceBtn.setAttribute('aria-label', `Advance ${displayName} to next level`);
    // Re-attach click with updated level value
    advanceBtn.onclick = () => _handleLevelChange(exerciseId, currentLevel + 1);
  }

  if (revertBtn) {
    revertBtn.disabled = !rev;
    revertBtn.onclick  = () => _handleLevelChange(exerciseId, currentLevel - 1);
  }
}

// ── List renderer ──────────────────────────────────────────────────────────────

/**
 * Renders all 12 exercise progression cards into #progression-list.
 * All exercises are shown regardless of today's schedule.
 * Safe to call on refresh — clears existing content first.
 */
function _renderList() {
  const list = document.getElementById('progression-list');
  if (!list) {
    console.error('progressions-ui.js _renderList: #progression-list not found');
    return;
  }

  list.innerHTML = '';

  // Render in EXERCISES array order.
  // shelved exercises are retired — they no longer appear on this screen.
  // They remain visible in the history table for historical continuity.
  let rendered = 0;
  EXERCISES.forEach(exercise => {
    if (exercise.frequency === 'shelved') return;  // skip retired exercises
    const card = _buildCard(exercise.id);
    if (card) {
      list.appendChild(card);
      rendered++;
    }
  });

  if (rendered === 0) {
    const empty = document.createElement('p');
    empty.className   = 'empty-state';
    empty.textContent = 'No exercises available.';
    list.appendChild(empty);
  }

  console.log(`progressions-ui.js: rendered ${rendered} progression cards`);
}

// ── app:ready listener ─────────────────────────────────────────────────────────

window.addEventListener('app:ready', () => {
  _renderList();
});

// ── Module interface ───────────────────────────────────────────────────────────

window._progressionsModule = {
  /**
   * Re-renders all cards from current window._app state.
   * Called by app.js when user taps the Progressions nav button.
   */
  refresh() {
    _renderList();
  }
};