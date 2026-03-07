# PostOp Exercise Tracker — Module API Reference
<!-- FORMAT NOTE: This document is optimized for LLM consumption, not human reading.
     Structure: one module per section. Each section contains:
       - FILE PATH (repo-relative)
       - SOURCE STATUS: VERIFIED | STUB | UNKNOWN
       - VERIFIED FROM: what was actually pasted and confirmed
       - IMPORTS: exact import statements this module uses
       - EXPORTS: exact exported names with full signatures and return shapes
       - DATA SHAPES: all object structures used
       - CONSTANTS: named constants exported or used internally
       - SIDE EFFECTS: anything the module does on load
       - KNOWN GAPS: incomplete or missing functionality
       - SAFE TO CALL FROM: which other modules may import this
       DO NOT INFER. If a fact is not in this document, ask the human.       -->

---

## GROUND RULES FOR USING THIS DOCUMENT

```
RULE 1: Only call functions listed under EXPORTS for each module.
RULE 2: Only use field names listed under DATA SHAPES.
RULE 3: All firestore.js functions return { success: boolean, data? | error? }.
        Always check .success before using .data.
RULE 4: Never invent function names. If a function is not listed here, it does not exist.
RULE 5: DOM selectors in ui.js are the only correct selectors. Do not restate them.
RULE 6: If this document is older than the current conversation, ask human to paste
        updated source before writing any code that depends on that module.
```

---

## MODULE: firebase-config.js

```
FILE:           js/firebase-config.js
SOURCE STATUS:  VERIFIED (confirmed referenced correctly by auth.js and firestore.js)
VERIFIED FROM:  Import statements in auth.js and firestore.js — not directly pasted
```

### EXPORTS
```
auth   — Firebase Auth instance
db     — Firebase Firestore instance
```

### IMPORT PATTERN (used by auth.js and firestore.js)
```javascript
import { auth } from './firebase-config.js';
import { db }   from './firebase-config.js';
```

### FIREBASE SDK VERSION
```
https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js
```

---

## MODULE: auth.js

```
FILE:           js/auth.js
SOURCE STATUS:  VERIFIED (full source pasted and confirmed)
VERIFIED FROM:  Human paste in current conversation
```

### IMPORTS
```javascript
import { auth } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
```

### EXPORTS

#### initAuth()
```
SIGNATURE:  initAuth() → Promise<string>
RETURNS:    Resolves with UID string when Firebase anonymous auth is ready
            Rejects with Error if auth fails AND no localStorage fallback exists
SIDE EFFECT: Stores UID in localStorage under key 'postop_uid'
FALLBACK:   If signInAnonymously fails, reads UID from localStorage('postop_uid')
            If localStorage also empty → rejects
CALL ONCE:  Call only during app startup (app.js Step 3)
```

#### getCurrentUID()
```
SIGNATURE:  getCurrentUID() → string | null
RETURNS:    Current UID from module-level var, or localStorage fallback, or null
NOTE:       Returns null if initAuth() has not yet resolved
```

### MODULE-LEVEL STATE
```
currentUID  — string | null, set when initAuth() resolves
UID_KEY     — 'postop_uid' (localStorage key, internal constant)
```

---

## MODULE: firestore.js

```
FILE:           js/firestore.js
SOURCE STATUS:  VERIFIED (full source pasted and confirmed)
VERIFIED FROM:  Human paste in current conversation
```

### IMPORTS
```javascript
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove,
         collection, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

### CRITICAL: ALL FUNCTIONS RETURN A RESULT WRAPPER
```
SUCCESS:  { success: true,  data: <value> }
FAILURE:  { success: false, error: <string message> }
ALWAYS check result.success before using result.data.
NEVER assume result.data is populated without checking success first.
```

### FIRESTORE PATH STRUCTURE (internal, for reference)
```
patients/{uid}/profile/data          — profile document
patients/{uid}/progressions/data     — progressions document
patients/{uid}/logs/{dateStr}        — one log document per date (YYYY-MM-DD)
```

### EXPORTS

#### getProfile(uid)
```
SIGNATURE:  getProfile(uid: string) → Promise<{ success: boolean, data: ProfileData | null }>
RETURNS:    data = ProfileData object if profile exists
            data = null if first visit (no profile yet)
            success = false on Firestore error
```

#### saveProfile(uid, profileData)
```
SIGNATURE:  saveProfile(uid: string, profileData: ProfileData) → Promise<{ success: boolean }>
BEHAVIOR:   setDoc with merge:true — creates or updates
            Automatically adds updatedAt: serverTimestamp() field
CALL WITH:  { uid, day1, createdAt } — see ProfileData shape below
```

#### getProgressions(uid)
```
SIGNATURE:  getProgressions(uid: string) → Promise<{ success: boolean, data: ProgressionsMap }>
RETURNS:    data = { [exerciseId]: level, updatedAt } if document exists
            data = {} (empty object) if no progressions saved yet
NOTE:       exerciseId keys are numbers (matching EXERCISES[].id)
```

#### updateProgression(uid, exerciseId, level)
```
SIGNATURE:  updateProgression(uid: string, exerciseId: number, level: number)
            → Promise<{ success: boolean }>
BEHAVIOR:   setDoc with merge:true — creates or updates single exerciseId key
            Automatically adds updatedAt: serverTimestamp() field
```

#### getLog(uid, dateStr)
```
SIGNATURE:  getLog(uid: string, dateStr: string) → Promise<{ success: boolean, data: LogDoc | null }>
PARAM:      dateStr — 'YYYY-MM-DD' format (use todayStr() to generate)
RETURNS:    data = LogDoc if a log exists for that date
            data = null if no log exists for that date (not an error)
```

#### getLogs(uid, dateStrings)
```
SIGNATURE:  getLogs(uid: string, dateStrings: string[])
            → Promise<{ success: boolean, data: { [dateStr]: LogDoc | null } }>
PARAM:      dateStrings — array of 'YYYY-MM-DD' strings
RETURNS:    data = object keyed by dateStr; dates with no log have null value
USE FOR:    History screen — fetches multiple dates in one call
```

#### saveLogEntry(uid, dateStr, dayOfWeek, entry)
```
SIGNATURE:  saveLogEntry(uid: string, dateStr: string, dayOfWeek: number, entry: LogEntry)
            → Promise<{ success: boolean }>
PARAMS:     dateStr   — 'YYYY-MM-DD'
            dayOfWeek — integer 0-6 (0=Sunday), from new Date().getDay()
            entry     — LogEntry object (see shape below)
BEHAVIOR:   If log document exists: arrayUnion(entry) appended to entries[]
            If log document absent: creates new document with entries: [entry]
WARNING:    4 PARAMETERS — do not call with 3
```

#### updateLogEntry(uid, dateStr, oldEntry, newEntry)
```
SIGNATURE:  updateLogEntry(uid: string, dateStr: string, oldEntry: LogEntry, newEntry: LogEntry)
            → Promise<{ success: boolean }>
BEHAVIOR:   Two sequential updateDoc calls:
              1. arrayRemove(oldEntry)   — must match exactly
              2. arrayUnion(newEntry)
WARNING:    oldEntry must be the EXACT object as stored — field-for-field match required
            for Firestore arrayRemove to work. Store the original entry object in
            window._app.todayLog[exerciseId] so it can be passed back here.
```

#### todayStr()
```
SIGNATURE:  todayStr() → string
RETURNS:    Today's date as 'YYYY-MM-DD' using LOCAL time (not UTC)
            Example: '2026-03-06'
USE:        Always use this function — never toISOString() which returns UTC
```

#### lastNDates(n)
```
SIGNATURE:  lastNDates(n: number) → string[]
RETURNS:    Array of n date strings 'YYYY-MM-DD', today first, going backwards
            Example: ['2026-03-06', '2026-03-05', '2026-03-04', ...]
USE FOR:    History screen date list generation
```

### DATA SHAPES

#### ProfileData
```javascript
{
  uid:       string,    // anonymous Firebase UID
  day1:      string,    // 'YYYY-MM-DD' — surgery/program start date
                        // WARNING: field is 'day1' NOT 'surgeryDate'
  createdAt: string,    // ISO timestamp string
  updatedAt: any,       // serverTimestamp() — added automatically by saveProfile
}
```

#### ProgressionsMap
```javascript
{
  [exerciseId: number]: number,   // exerciseId → current level (0-based)
  updatedAt: any,                 // serverTimestamp() field also present
}
// Example: { 0: 0, 7: 2, 9: 1, updatedAt: Timestamp }
// NOTE: updatedAt key will appear — filter it out when iterating exercise IDs
```

#### LogDoc
```javascript
{
  date:      string,      // 'YYYY-MM-DD'
  dayOfWeek: number,      // 0-6 (0=Sunday)
  entries:   LogEntry[],  // array of log entries — one per exercise per day
  updatedAt: any,         // serverTimestamp()
}
```

#### LogEntry
```javascript
{
  exerciseId:       number,   // matches EXERCISES[].id
  progressionLevel: number,   // level at time of logging
  timeOfDay:        string,   // e.g. 'Morning', 'Afternoon' — from #time-of-day select
  count:            number,   // reps or seconds
  repeats:          number,   // number of sets
  loggedAt:         string,   // ISO timestamp string e.g. new Date().toISOString()
}
```

#### TodayLogIndex (built by app.js, NOT stored in Firestore)
```javascript
// app.js converts LogDoc.entries[] into a keyed map for O(1) lookup:
{
  [exerciseId: number]: LogEntry
}
// Built by buildTodayLogIndex(logDoc) in app.js
// Stored at window._app.todayLog
// Last entry wins if duplicates exist (consistent with updateLogEntry behavior)
```

---

## MODULE: exercises.js

```
FILE:           js/exercises.js
SOURCE STATUS:  VERIFIED (full source pasted and confirmed, line 312 confirmed)
VERIFIED FROM:  Human paste in current conversation
LAST LINE:      export { EXERCISES };  — added at line 312
```

### EXPORTS
```
EXERCISES  — array of 12 ExerciseObject items
```

### EXERCISE IDs (complete list — do not guess)
```
0   Walk                      frequency: Daily    maxProgression: 0
7   Bridge                    frequency: Alt1     maxProgression: 3
8   Clam Shell                frequency: Alt1     maxProgression: 1
9   Hip Flexor Strengthening  frequency: Daily    maxProgression: 2
10  Standing Hip Abduction    frequency: Alt2     maxProgression: 1
11  Squat                     frequency: Alt2     maxProgression: 1
12  Crab Walk                 frequency: Alt2     maxProgression: 1
13  Standing Leg Abductor     frequency: Alt2     maxProgression: 3
14  Marching in Place         frequency: Daily    maxProgression: 3
15  Hip Bending Stretch       frequency: Daily    maxProgression: 1
16  Hip Flexor Stretch        frequency: Daily    maxProgression: 0
17  Seated Hamstring Stretch  frequency: Daily    maxProgression: 0
```

### DATA SHAPES

#### ExerciseObject
```javascript
{
  id:             number,          // unique — values: 0, 7-17 (NOT contiguous 0-11)
  name:           string,          // e.g. 'Bridge'
  displayName:    string,          // e.g. 'Ex 7: Bridge'
  frequency:      string,          // 'Daily' | 'Alt1' | 'Alt2'
  maxProgression: number,          // max valid level index (0-based)
  progressions:   ProgressionLevel[]
}
```

#### ProgressionLevel
```javascript
{
  level:          number,   // 0-based index, 0 = entry level
  description:    string,   // full exercise instruction text
  type:           string,   // 'Rep' | 'Time'
                            // Rep  = count is repetitions
                            // Time = count is seconds
  defaultCount:   number,   // default reps or seconds
  defaultRepeats: number,   // default number of sets
}
```

### FREQUENCY SCHEDULE
```
Daily  — shown every day (Sunday through Saturday)
Alt1   — shown Monday, Wednesday, Friday only
Alt2   — shown Tuesday, Thursday, Saturday only
Sunday — Daily exercises only (no Alt1, no Alt2)
```

### LOOKUP PATTERN
```javascript
// Get progression for a specific exercise at its current level:
const ex    = EXERCISES.find(e => e.id === exerciseId);
const level = window._app.progressions[exerciseId] ?? 0;
const prog  = ex.progressions[level];
// prog.type, prog.defaultCount, prog.defaultRepeats, prog.description
```

---

## MODULE: scheduler.js

```
FILE:           js/scheduler.js
SOURCE STATUS:  VERIFIED (full source pasted and confirmed)
                MODIFIED:  getDayNumber() added by T3.3 task (Option B decision)
VERIFIED FROM:  Human paste in current conversation + Option B decision recorded here
```

### EXPORTS
```
getApplicableExercises  — function
isApplicableOn          — function
getDayLabel             — function
getDayNumber            — function  ← ADDED in T3.3 (not in original pasted source)
ALT1_DAYS               — constant array
ALT2_DAYS               — constant array
```

### EXPORTS (detail)

#### getApplicableExercises(date, exercises)
```
SIGNATURE:  getApplicableExercises(date: Date, exercises: ExerciseObject[])
            → ExerciseObject[]
PARAMS:     date      — JavaScript Date object (use new Date() for today)
            exercises — the full EXERCISES array from exercises.js
RETURNS:    Filtered subset of exercises applicable on that day of week
CALL WITH:  getApplicableExercises(new Date(), EXERCISES)
```

#### isApplicableOn(date, exercise)
```
SIGNATURE:  isApplicableOn(date: Date, exercise: ExerciseObject) → boolean
USE FOR:    History table — determines whether a cell is applicable or dimmed
```

#### getDayLabel(date)
```
SIGNATURE:  getDayLabel(date: Date) → string
RETURNS:    Human-readable string, e.g. 'Monday — Daily + Alt1 exercises'
USE FOR:    Display on log screen header or day type indicator
```

#### getDayNumber(day1Str)
```
SIGNATURE:  getDayNumber(day1Str: string) → number
PARAM:      day1Str — 'YYYY-MM-DD' string from profile.day1
RETURNS:    Recovery day number, 1-based (Day 1 = surgery date)
            Minimum return value: 1 (Math.max(1, diff) — never 0 or negative)
ALGORITHM:  Local midnight comparison — avoids timezone drift
            diff = floor((todayMidnight - day1Midnight) / 86400000) + 1
```

### CONSTANTS
```javascript
ALT1_DAYS = [1, 3, 5]   // Monday, Wednesday, Friday  (getDay() values)
ALT2_DAYS = [2, 4, 6]   // Tuesday, Thursday, Saturday
// SUN_DAY = 0 is internal only, not exported
```

---

## MODULE: progression.js

```
FILE:           js/progression.js
SOURCE STATUS:  DELIVERED T2.6 — written in this conversation against verified sources
VERIFIED FROM:  exercises.js, firestore.js, app.js window._app contract — all confirmed
TASK:           T2.6 — COMPLETE
```

### DESIGN: Conservative update (Option B — human decision)
```
Firestore write attempted FIRST.
window._app.progressions updated ONLY after Firestore confirms success.
On failure: memory unchanged, { success: false, error } returned to caller.
No rollback needed — memory never modified before confirmation.
```

### IMPORTS
```javascript
import { updateProgression } from './firestore.js';
import { EXERCISES }         from './exercises.js';
```

### READS FROM window._app (must be populated by app.js before any call)
```
window._app.uid          — string  — Firebase UID for Firestore writes
window._app.progressions — object  — ProgressionsMap { [exerciseId]: level }
```

### WRITES TO window._app
```
window._app.progressions[exerciseId] = newLevel
  — ONLY written after updateProgression() returns { success: true }
```

### EXPORTS

#### getLevel(exerciseId)
```
SIGNATURE:  getLevel(exerciseId: number) → number
RETURNS:    Current level (0-based). Returns 0 if no progression saved.
NOTE:       Reads from window._app.progressions — synchronous, no Firestore call.
```

#### setLevel(exerciseId, newLevel)
```
SIGNATURE:  setLevel(exerciseId: number, newLevel: number)
            → Promise<{ success: boolean, error?: string }>
VALIDATES:  exerciseId exists in EXERCISES
            newLevel is integer >= 0
            newLevel <= exercise.maxProgression
            window._app.uid is set
ON SUCCESS: Calls updateProgression(uid, exerciseId, newLevel)
            Then sets window._app.progressions[exerciseId] = newLevel
ON FAILURE: Returns { success: false, error: string }, memory unchanged
```

#### isAtMaxLevel(exerciseId)
```
SIGNATURE:  isAtMaxLevel(exerciseId: number) → boolean
RETURNS:    true if currentLevel >= exercise.maxProgression
            true if exerciseId not found (treat unknown as non-advanceable)
USE FOR:    Disabling/hiding Advance button on progressions screen
```

#### canAdvance(exerciseId)
```
SIGNATURE:  canAdvance(exerciseId: number) → boolean
RETURNS:    !isAtMaxLevel(exerciseId)
NOTE:       Semantic alias — use whichever reads more clearly in context
```

#### canRevert(exerciseId)
```
SIGNATURE:  canRevert(exerciseId: number) → boolean
RETURNS:    true if currentLevel > 0
USE FOR:    Disabling/hiding Revert button on progressions screen
```

#### getProgressionData(exerciseId)
```
SIGNATURE:  getProgressionData(exerciseId: number) → ProgressionLevel | null
RETURNS:    The EXERCISES[].progressions[currentLevel] object for the exercise
            null if exerciseId not found or level out of range
SHAPE:      { level, description, type, defaultCount, defaultRepeats }
            (verified from exercises.js — see ProgressionLevel shape above)
```

#### getExerciseProgressionSummary(exerciseId)
```
SIGNATURE:  getExerciseProgressionSummary(exerciseId: number) → ProgressionSummary | null
RETURNS:    null if exerciseId not found
SHAPE:
{
  id:             number,   // exercise id
  displayName:    string,   // e.g. 'Ex 7: Bridge'
  frequency:      string,   // 'Daily' | 'Alt1' | 'Alt2'
  currentLevel:   number,
  maxProgression: number,
  canAdvance:     boolean,
  canRevert:      boolean,
  description:    string,
  type:           string,   // 'Rep' | 'Time'
  defaultCount:   number,
  defaultRepeats: number,
}
USE FOR:    Progressions screen card rendering — single call returns everything needed
```

---

## MODULE: ui.js (T3.2)

```
FILE:           js/ui.js
SOURCE STATUS:  DELIVERED T3.2 — written in this conversation against verified DOM
VERIFIED FROM:  index.html pasted in current conversation
```

### DOM ELEMENTS — VERIFIED AGAINST index.html
```
ELEMENT              SELECTOR                    NOTES
─────────────────────────────────────────────────────────────────────
Loading screen       #screen-loading             No display:none — visible by default
Log screen           #screen-log                 Has style="display:none" in HTML
History screen       #screen-history             Has style="display:none" in HTML
Progressions screen  #screen-progressions        Has style="display:none" in HTML
Loading label        .loading-label              CLASS not id — use querySelector
Offline banner       #offline-banner             Has style="display:none" by default
Day badge            #hdr-day-label              Inside screen-log header only
Date label           #hdr-date                   Inside screen-log header only
                                                 (other headers have no id on date span)
Completion badge     #hdr-completion             Inside screen-log header
Exercise list        #exercise-list              Injection target for logger.js
Toast                #toast                      role="status" aria-live="polite"
Nav buttons          .nav-btn (class)            NO id attributes on nav buttons
                     data-screen attribute       Values: screen-log | screen-history
                                                         | screen-progressions
Nav active class     .nav-btn--active            Toggle this class on active button
History table wrap   #history-table-wrap         Injection target for history.js
Progression list     #progression-list           Injection target for progressions-ui.js
Time of day select   #time-of-day                In screen-log, above exercise list
```

### EXPORTS

#### showScreen(screenId)
```
SIGNATURE:  showScreen(screenId: string) → void
PARAM:      screenId — must be one of:
              'screen-loading'
              'screen-log'
              'screen-history'
              'screen-progressions'
BEHAVIOR:   Hides ALL screens (inline display:none)
            Shows target (removes inline display, lets CSS rule apply)
            Syncs .nav-btn--active class and aria-current on .nav-btn elements
NOTE:       'screen-loading' has no nav button — all nav buttons lose active state
```

#### setLoadingLabel(text)
```
SIGNATURE:  setLoadingLabel(text: string) → void
BEHAVIOR:   Sets textContent of .loading-label element
            Silent no-op if element not found
```

#### updateOfflineBanner()
```
SIGNATURE:  updateOfflineBanner() → void
BEHAVIOR:   Shows/hides #offline-banner based on navigator.onLine
            Sets aria-hidden accordingly
CALL ON:    App startup + window 'online' event + window 'offline' event
```

#### showToast(message, type, duration)
```
SIGNATURE:  showToast(message: string, type?: string, duration?: number) → void
DEFAULTS:   type     = 'success'
            duration = 3000 (ms)
TYPES:      'success' | 'error' | 'warn'
CSS:        Applies class toast--{type} and toast--visible to #toast element
DURATION 0: Toast persists until next showToast call (use for fatal errors)
RAPID CALLS: Cancels previous auto-hide timer — safe to call in quick succession
```

#### updateHeader(dayNumber, totalScheduled, totalLogged)
```
SIGNATURE:  updateHeader(dayNumber: number, totalScheduled: number, totalLogged: number)
            → void
BEHAVIOR:   #hdr-day-label  ← 'Day {dayNumber}'
            #hdr-date       ← formatted date string (en-CA locale, local time)
            #hdr-completion ← toggles .completion-badge--done / .completion-badge--pending
                              sets aria-label and title
CALL ON:    App startup (Step 8) and after every log/update action in logger.js
```

---

## MODULE: app.js (T3.3)

```
FILE:           js/app.js
SOURCE STATUS:  DELIVERED T3.3 — written in this conversation against all verified sources
ENTRY POINT:    Yes — loaded by index.html as <script type="module" src="js/app.js">
```

### IMPORTS
```javascript
import { showScreen, setLoadingLabel, updateOfflineBanner,
         showToast, updateHeader }                         from './ui.js';
import { initAuth }                                        from './auth.js';
import { getProfile, saveProfile, getProgressions,
         getLog, todayStr }                                from './firestore.js';
import { EXERCISES }                                       from './exercises.js';
import { getApplicableExercises, getDayLabel,
         getDayNumber }                                    from './scheduler.js';
```

### GLOBAL STATE: window._app
```javascript
window._app = {
  uid:            string | null,    // set in Step 3
  profile:        object | null,    // raw ProfileData from Firestore
  day1:           string | null,    // 'YYYY-MM-DD' from profile.day1
  dayNumber:      number,           // 1-based recovery day
  progressions:   object,           // ProgressionsMap from getProgressions()
  todayLog:       object,           // TodayLogIndex { [exerciseId]: LogEntry }
  todayExercises: ExerciseObject[], // from getApplicableExercises()
  currentScreen:  string,           // current screen-* id string

  updateTodayLog(exerciseId, entry): void
    // Called by logger.js after saving/updating a log entry.
    // Updates todayLog[exerciseId] and calls updateHeader() to refresh badge.
}
```

### STARTUP SEQUENCE (9 steps)
```
Step 1  HTML default — screen-loading visible, no JS needed
Step 2  updateOfflineBanner() + register online/offline listeners
Step 3  initAuth() → uid stored in window._app.uid
Step 4  getProfile(uid) → create default profile if null (day1 = todayStr())
Step 5  getDayNumber(profile.day1) → window._app.dayNumber
Step 6  Promise.all([getProgressions(uid), getLog(uid, todayStr())])
        → build window._app.progressions and window._app.todayLog
Step 7  getApplicableExercises(new Date(), EXERCISES) → window._app.todayExercises
Step 8  updateHeader(dayNumber, todayExercises.length, loggedCount)
Step 9  wireNavigation() → showScreen('screen-log') → dispatch 'app:ready'
```

### app:ready EVENT
```javascript
// Dispatched on window after Step 9 completes
window.dispatchEvent(new CustomEvent('app:ready', {
  detail: {
    uid:           string,
    profile:       ProfileData,
    dayNumber:     number,
    todayExercises: ExerciseObject[],
    progressions:  ProgressionsMap,
    todayLog:      TodayLogIndex,
  }
}));
// logger.js listens for this event to render exercise cards.
// This decouples module load order — logger.js does not need to import app.js.
```

### ERROR HANDLING
```
Any thrown error in init() → loading screen stays visible
setLoadingLabel('Could not connect…') is called
showToast('Connection failed…', 'error', 0) persists
No navigation away from loading screen — unusable state without auth + profile
```

### NAVIGATION WIRING
```
Nav buttons selected by: document.querySelectorAll('.nav-btn')
Screen id read from:      btn.dataset.screen
On click:                 showScreen(screenId)
                          window._app.currentScreen = screenId
                          Calls refresh() on screen module if loaded:
                            window._historyModule?.refresh()
                            window._progressionsModule?.refresh()
                            window._loggerModule?.refresh()
```

---

## MODULE: logger.js (T3.4)

```
FILE:           js/logger.js
SOURCE STATUS:  DELIVERED T3.4 — written in this conversation against verified sources
VERIFIED FROM:  index.html, styles.css, firestore.js, progression.js, app.js — all confirmed
```

### IMPORTS
```javascript
import { saveLogEntry, updateLogEntry, todayStr } from './firestore.js';
import { showToast }                               from './ui.js';
import { getProgressionData }                      from './progression.js';
```

### TRIGGER
```
Listens for: window 'app:ready' CustomEvent
event.detail shape: { uid, profile, dayNumber, todayExercises, progressions, todayLog }
Renders cards immediately on receipt of this event.
```

### DOM TARGETS (verified against index.html)
```
#exercise-list   — card injection container, role="list"
#time-of-day     — time-of-day select, read on every Log/Update click
```

### CARD ELEMENT IDs (dynamically generated, keyed by exerciseId)
```
#card-{id}              — outer article element
#card-body-{id}         — collapsible body section
#card-check-{id}        — checkmark span (hidden until logged)
#prog-badge-{id}        — progression level badge (hidden when logged)
#logged-summary-{id}    — logged summary badge (shown when logged)
#card-desc-{id}         — description paragraph
#log-form-{id}          — log form div
#count-{id}             — count number input
#repeats-{id}           — repeats number input
#log-error-{id}         — inline error paragraph (hidden until validation fails)
#log-btn-{id}           — Log / Update button
```

### CSS CLASSES USED (verified against styles.css)
```
CARD OUTER:
  .exercise-card              — outer wrapper (article element)
  .exercise-card--logged      — modifier: green border/bg when logged
  .exercise-card--open        — modifier: expands .card-body via CSS

CARD HEADER (always visible):
  .card-header                — tappable row, role="button"
  .card-chevron               — rotates 180deg when --open (pure CSS, no JS needed)
  .card-title-group           — flex:1 name + badges container
  .card-exercise-name         — exercise display name
  .card-badges                — flex row for badges
  .freq-badge                 — base frequency badge class
  .freq-badge--daily          — Daily (blue)
  .freq-badge--alt1           — Alt1 (purple)
  .freq-badge--alt2           — Alt2 (amber-brown)
  .prog-badge                 — grey level badge (hidden when logged)
  .logged-summary             — green summary badge (shown when logged)
  .card-check                 — green circle with SVG checkmark (hidden until logged)

CARD BODY (collapsible):
  .card-body                  — hidden by default via CSS
                                CSS rule: .exercise-card--open .card-body { display:block }
                                IMPORTANT: logger.js ONLY toggles .exercise-card--open
                                           Never set .card-body display directly
  .card-description           — description text with left teal border

LOG FORM:
  .log-form                   — flex column container
  .log-inputs                 — 2-column CSS grid
  .input-group                — label + input + unit hint wrapper
  .input-label                — small uppercase label
  .input-field                — styled number input (min-height: 44px, centered text)
  .input-unit                 — small unit hint below input (e.g. "reps", "seconds")
  .btn-log                    — primary log button (dark teal)
  .btn-log--update            — modifier: green teal for update mode

UTILITY:
  .empty-state                — centred muted paragraph (no exercises / inline errors)
```

### READS FROM window._app
```
window._app.uid              — for Firestore calls
window._app.todayLog         — TodayLogIndex, checked to determine log vs update
window._app.progressions     — for current level (passed to getProgressionData)
window._app.todayExercises   — used by refresh()
```

### WRITES TO window._app
```
Does NOT write directly.
Calls window._app.updateTodayLog(exerciseId, entry) after every successful write.
app.js owns all state mutation.
```

### MODULE INTERFACE
```javascript
window._loggerModule = {
  refresh()   // Re-renders all cards from current window._app state.
              // Called by app.js nav wiring when user taps Today nav button.
}
```

### LOG / UPDATE FLOW
```
1. User taps Log / Update button on a card
2. _submitting Map checked — if true, return immediately (double-tap guard)
3. count + repeats inputs read and parseInt'd — validated as integers >= 1
4. timeOfDay read from #time-of-day select
5. LogEntry built: { exerciseId, progressionLevel, timeOfDay, count, repeats, loggedAt }
6. Button disabled, text = 'Saving...' while write in progress
7. If window._app.todayLog[id] exists:
     updateLogEntry(uid, todayStr(), oldEntry, newEntry)   — arrayRemove + arrayUnion
   Else:
     saveLogEntry(uid, todayStr(), dayOfWeek, newEntry)    — 4 params
8. On Firestore failure: button re-enabled, showToast error, return
9. On success:
     window._app.updateTodayLog(id, newEntry)   — updates memory + refreshes header badge
     Card UI → logged state: --logged class, summary badge, checkmark shown, button = Update
     showToast success message
```

### DOUBLE-TAP PROTECTION
```
_submitting: Map<exerciseId, boolean>
Set true:  before Firestore write begins
Cleared:   on both success AND failure paths
Button:    disabled + text 'Saving...' during write, re-enabled on failure
```


---

## INDEX.html — KEY STRUCTURAL FACTS

```
FILE:           index.html
SOURCE STATUS:  VERIFIED (full source pasted and confirmed, T3.1)
```

### SCREEN DEFAULT VISIBILITY
```
screen-loading      VISIBLE   — no display:none, class="screen screen-loading-state"
screen-log          HIDDEN    — style="display:none"
screen-history      HIDDEN    — style="display:none"
screen-progressions HIDDEN    — style="display:none"
```

### TIME-OF-DAY SELECT VALUES (exact option values)
```
'Early Morning'     (6–9am)
'Morning'           (9am–12pm)
'Lunch'             (12–1pm)
'Early Afternoon'   (1–3pm)
'Afternoon'         (3–5pm)
'Early Evening'     (5–7pm)
'Evening'           (7–9pm)
'Late'              (after 9pm)
```

### SCRIPT LOADING
```html
<script type="module" src="js/app.js"></script>
<script type="module" src="js/logger.js"></script>    <!-- T3.4: added -->
<!-- history.js and progressions-ui.js must also be added as script tags when delivered. -->
<!-- Confirm with human before assuming any script tag has been added. -->
```

---

## PHASE STATUS SUMMARY

```
PHASE 1 — Project Planning
  T1.x  All complete ✓

PHASE 2 — Core Modules
  T2.1  firebase-config.js    COMPLETE ✓
  T2.2  auth.js               COMPLETE ✓
  T2.3  firestore.js          COMPLETE ✓
  T2.4  exercises.js          COMPLETE ✓  (export line added at line 312)
  T2.5  scheduler.js          COMPLETE ✓  (getDayNumber added for T3.3)
  T2.6  progression.js        COMPLETE ✓   (delivered this conversation)

PHASE 3 — UI Shell
  T3.1  index.html + styles.css    COMPLETE ✓  (committed to repo)
  T3.2  ui.js                      COMPLETE ✓  (delivered this conversation)
  T3.3  app.js                     COMPLETE ✓  (delivered this conversation)
  T3.4  logger.js                  COMPLETE ✓   (delivered this conversation)
  T3.5  history.js                 NOT STARTED
  T3.6  progressions-ui.js         NOT STARTED
  T3.7+                            NOT STARTED
```

---

## OPEN ITEMS

```
FS-OI-2   Repo visibility (public or private)              PENDING
FS-OI-3   Exact repo name capitalization                   PENDING
FS-OI-4   Time-of-day auto-suggestion behavior (T3.6)      PENDING
```

---
*Document last updated: 2026-03-06. Covers T2.1–T2.6, T3.1–T3.4. Update when any module source changes.*
*When in doubt: ask the human to paste the current file. Do not infer.*