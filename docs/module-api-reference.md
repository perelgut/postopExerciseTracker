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
SOURCE STATUS:  VERIFIED (full source pasted and confirmed)
VERIFIED FROM:  Human paste in current conversation
LAST CHANGED:   Google Sign-In — added GoogleAuthProvider import and provider export
```

### EXPORTS
```
auth      — Firebase Auth instance
db        — Firebase Firestore instance (initializeFirestore with persistentLocalCache)
provider  — GoogleAuthProvider instance (used by auth.js signInWithPopup)
```

### IMPORT PATTERNS
```javascript
import { auth, provider } from './firebase-config.js';   // auth.js
import { db }             from './firebase-config.js';   // firestore.js
```

### FIREBASE SDK VERSION
```
https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js
```

### OFFLINE PERSISTENCE
```
initializeFirestore(app, { localCache: persistentLocalCache() })
v10 replacement for deprecated enableIndexedDbPersistence().
NOTE: On first run after switching from anonymous auth, Firestore may log
"INTERNAL ASSERTION FAILED: Unexpected state" and fall back to memory cache.
Caused by stale anonymous IndexedDB cache. Clear browser IndexedDB to resolve.
Not a recurring issue on clean installs.
```

---

## MODULE: auth.js

```
FILE:           js/auth.js
SOURCE STATUS:  VERIFIED (full source delivered and confirmed working)
VERIFIED FROM:  Delivered this session, tested on Windows + iPhone — cross-device sync confirmed
LAST CHANGED:   Replaced anonymous auth with Google Sign-In (signInWithPopup)
```

### IMPORTS
```javascript
import { auth, provider }       from './firebase-config.js';
import { onAuthStateChanged,
         signInWithPopup }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
```

### EXPORTS

#### initAuth()
```
SIGNATURE:  initAuth() → Promise<string|null>
RETURNS:    string — existing Google UID if user is already signed in (persistent session)
            null   — if no current session (first visit or after sign-out)
BEHAVIOR:   Wraps onAuthStateChanged in a Promise, unsubscribes after first fire.
            app.js checks return value: if null → show sign-in screen and call waitForSignIn()
CALL ONCE:  Call only during app startup (app.js Step 3)
NOTE:       Does NOT throw — always resolves. Null means "not signed in", not an error.
```

#### signInWithGoogle()
```
SIGNATURE:  signInWithGoogle() → Promise<string>
RETURNS:    Signed-in user's UID string on success
THROWS:     Firebase error on failure (user cancelled popup, network error, etc.)
            app.js catches error, shows toast, re-enables sign-in button
BEHAVIOR:   Calls signInWithPopup(auth, provider)
            Sets _currentUID on success
CALL FROM:  app.js waitForSignIn() — only when initAuth() returned null
```

#### getCurrentUID()
```
SIGNATURE:  getCurrentUID() → string | null
RETURNS:    Current UID from module-level var, or null if not signed in
NOTE:       Synchronous — no Firestore or network call
```

### MODULE-LEVEL STATE
```
_currentUID  — string | null, set by initAuth() or signInWithGoogle()
```

### FIREBASE CONSOLE REQUIREMENT
```
Authentication → Sign-in method → Google → Enable
Set a project support email address.
Without this, signInWithPopup throws auth/operation-not-allowed.
```

### CROSS-ORIGIN-OPENER-POLICY NOTE
```
GitHub Pages sets COOP headers that trigger console warnings during popup flow:
"Cross-Origin-Opener-Policy policy would block the window.closed call"
These warnings are harmless — Firebase handles popup completion correctly regardless.
This is a known GitHub Pages + Firebase popup interaction. Not a bug.
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
  type:           string,   // 'Rep' | 'Time' | 'Minutes'
                            // Rep     = count is repetitions,  unit: 'reps'
                            // Time    = count is seconds,      unit: 's'
                            // Minutes = count is minutes,      unit: 'min'
                            // ⚠ Walk (id:0) uses 'Minutes'. All other exercises
                            //   use 'Rep' or 'Time'. Do NOT assume 'Time' means
                            //   seconds for all exercises.
  defaultCount:   number,   // default reps, seconds, or minutes
  defaultRepeats: number,   // default number of sets
}
```

#### Walk exercise specifics (id: 0)
```
type:          'Minutes'   ← CHANGED from 'Time' (Option A decision)
defaultCount:  20          ← CHANGED from 60 (goal is 60 min/day; start at 20)
defaultRepeats: 1
description:   'Walk anywhere for a continuous time. Start at 20 minutes
                and build to 60 minutes eventually.'
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
Sign-in screen       #screen-signin              Has style="display:none" in HTML
Log screen           #screen-log                 Has style="display:none" in HTML
History screen       #screen-history             Has style="display:none" in HTML
Progressions screen  #screen-progressions        Has style="display:none" in HTML
Sign-in button       #btn-google-signin          Inside #screen-signin
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
              'screen-signin'
              'screen-log'
              'screen-history'
              'screen-progressions'
BEHAVIOR:   Hides ALL screens (inline display:none)
            Shows target (removes inline display, lets CSS rule apply)
            Syncs .nav-btn--active class and aria-current on .nav-btn elements
NOTE:       'screen-loading' and 'screen-signin' have no nav buttons —
            all nav buttons lose active state when either is shown
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

## MODULE: app.js (T3.3, revised Google Sign-In)

```
FILE:           js/app.js
SOURCE STATUS:  DELIVERED — revised this session for Google Sign-In
ENTRY POINT:    Yes — loaded by index.html as <script type="module" src="js/app.js">
LAST CHANGED:   Step 3 revised: initAuth() returns null if no session →
                waitForSignIn() shows #screen-signin and awaits Google popup
```

### IMPORTS
```javascript
import { showScreen, setLoadingLabel, updateOfflineBanner,
         showToast, updateHeader }                         from './ui.js';
import { initAuth, signInWithGoogle }                      from './auth.js';
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

### STARTUP SEQUENCE (9 steps — revised for Google Sign-In)
```
Step 1  HTML default — screen-loading visible, no JS needed
Step 2  updateOfflineBanner() + register online/offline listeners
Step 3  initAuth() → string|null
          If null  → waitForSignIn(): show screen-signin, wire #btn-google-signin,
                     await signInWithGoogle() → uid
                     then show screen-loading again before continuing
          If string → existing Google session, proceed directly
        uid stored in window._app.uid
Step 4  getProfile(uid) → create default profile if null (day1 = todayStr())
Step 5  getDayNumber(profile.day1) → window._app.dayNumber
Step 6  Promise.all([getProgressions(uid), getLog(uid, todayStr())])
        → build window._app.progressions and window._app.todayLog
Step 7  getApplicableExercises(new Date(), EXERCISES) → window._app.todayExercises
Step 8  updateHeader(dayNumber, todayExercises.length, loggedCount)
Step 9  wireNavigation() → showScreen('screen-log') → dispatch 'app:ready'
```

### waitForSignIn() (internal function)
```
SIGNATURE:  waitForSignIn() → Promise<string>
BEHAVIOR:   Shows #screen-signin via showScreen()
            Wires click handler on #btn-google-signin
            On click: disables button, calls signInWithGoogle()
            On success: resolves with uid
            On error:   re-enables button, shows error toast, patient can retry
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
SOURCE STATUS:  DELIVERED T3.4, REVISED — per-card time-of-day + Minutes type
VERIFIED FROM:  index.html, styles.css, firestore.js, progression.js, app.js — all confirmed
CHANGES:        1. Each exercise card now has its own time-of-day <select> (#tod-select-{id})
                   Auto-populated from device clock via getTimeBucket(). Patient can override.
                   timeOfDay in LogEntry comes from this per-card select, NOT #time-of-day.
                2. 'Minutes' type branch added: label='Minutes', unit='min', summaryUnit='min'
                3. Imports getTimeBucket from time-of-day.js
```

### IMPORTS
```javascript
import { saveLogEntry, updateLogEntry, todayStr } from './firestore.js';
import { showToast }                               from './ui.js';
import { getProgressionData }                      from './progression.js';
import { getTimeBucket }                           from './time-of-day.js';
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
#time-of-day     — global header select — DISPLAY ONLY, never read during saves
                   Each card has its own #tod-select-{id} for the actual logged value.
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
#repeats-{id}           — sets number input
#tod-select-{id}        — per-card time-of-day <select> (NEW — auto-populated from clock)
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
  .log-inputs                 — 2-column CSS grid (count + sets inputs)
  .input-group                — label + input + unit hint wrapper
  .input-label                — small uppercase label
  .input-field                — styled number input (min-height: 44px, centered text)
  .input-unit                 — small unit hint below input (e.g. "reps", "min")
  .tod-group                  — wrapper div for per-card time-of-day label + select
  .tod-select                 — the per-card time-of-day <select> element
  .btn-log                    — primary log button (dark teal)
  .btn-log--update            — modifier: green teal for update mode

UTILITY:
  .empty-state                — centred muted paragraph (no exercises / inline errors)
```

### TYPE → UNIT MAPPING
```
'Rep'     → label: 'Reps',    unit: 'reps', summaryUnit: 'r'
'Time'    → label: 'Seconds', unit: 'seconds', summaryUnit: 's'
'Minutes' → label: 'Minutes', unit: 'min',     summaryUnit: 'min'
```

### SUMMARY TEXT FORMAT
```
'Rep'     → "15r × 3 · Morning"
'Time'    → "45s × 3 · Afternoon"
'Minutes' → "35min × 1 · Early Morning"
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
<script type="module" src="js/history.js"></script>         <!-- T3.5: add when delivered -->
<script type="module" src="js/time-of-day.js"></script>    <!-- T3.6: add when delivered -->
<!-- progressions-ui.js must also be added as script tag when delivered. -->
<!-- Confirm with human before assuming any script tag has been added. -->
```

---

## MODULE: history.js (T3.5)

```
FILE:           js/history.js
SOURCE STATUS:  DELIVERED T3.5 — written against verified sources
VERIFIED FROM:  table.css, styles.css, index.html, firestore.js, scheduler.js,
                exercises.js — all confirmed
```

### IMPORTS
```javascript
import { getLogs, lastNDates, todayStr } from './firestore.js';
import { isApplicableOn }                from './scheduler.js';
import { EXERCISES }                     from './exercises.js';
```

### TRIGGER
```
window._historyModule.refresh() — called by app.js nav wiring when History tab tapped
First call fetches from Firestore. Subsequent calls use cache unless date has rolled over.
```

### DOM TARGET
```
#history-table-wrap   — table injected here (scroll container already in index.html)
```

### SHORT COLUMN HEADER NAMES (verified against exercises.js names)
```javascript
const SHORT_NAME = {
  0:  'Walk',
  7:  'Bridge',
  8:  'Clam Shell',
  9:  'Flexor Str.',    // Hip Flexor Strengthening — disambiguated from id:16
  10: 'Hip Abduct.',
  11: 'Squat',
  12: 'Crab Walk',
  13: 'Leg Abduct.',
  14: 'Marching',
  15: 'Hip Bend.',
  16: 'Flexor Stch.',   // Hip Flexor Stretch — disambiguated from id:9
  17: 'Hamstring',
};
// Full displayName set as th.title for hover tooltip
```

### CSS CLASSES USED (verified against table.css)
```
.history-table          — <table> element
th.col-date             — sticky date column header
th.col-ex               — exercise column headers (min-width: 72px)
tr.row-today            — green tint on today's row
td.cell-date            — sticky left date column
.date-line1             — bold "Fri 06"
.date-line2             — muted "Mar 2026"
td.cell-ex              — exercise data cell

CELL CONTENT (mutually exclusive):
.cell-na / .cell-na-inner   — not applicable that day (dot)
.cell-empty                 — applicable but not logged (dash)
.cell-skipped               — logged with count=0
.cell-logged                — logged with data
  .cell-prog                — "L{level}" blue chip
  .cell-count               — "{count}r" or "{count}s"
  .cell-repeats             — "×{repeats}"

.empty-state                — loading/error message
```

### CACHING BEHAVIOUR
```
_cachedLogs:    { dateStr: LogDoc|null } — stored after first successful fetch
_cachedDateStr: todayStr() at fetch time — used to detect day rollover
Cache invalidated: when todayStr() !== _cachedDateStr (date rolled over)
Cache NOT invalidated: when user logs an exercise (history shows committed data)
Manual invalidation: window._historyModule.invalidateCache()
```

### MODULE INTERFACE
```javascript
window._historyModule = {
  refresh()          // renders or re-renders table (uses cache if valid)
  invalidateCache()  // clears cache, forces fresh fetch on next refresh()
}
```

### COLUMN VISIBILITY RULE
```
An exercise column is shown only if isApplicableOn() returns true for at least
ONE of the 30 dates in the window. In practice all 12 exercises are always shown
since the 30-day window always includes Mon, Wed, Fri, Tue, Thu, Sat, and Sun.
```

### DATE PARSING
```
ALWAYS use _parseLocalDate(dateStr) → new Date(y, m-1, d)
NEVER use new Date(dateStr) — that treats the string as UTC midnight, giving
wrong day-of-week in non-UTC timezones.
```


---

## MODULE: time-of-day.js (T3.6)

```
FILE:           js/time-of-day.js
SOURCE STATUS:  DELIVERED T3.6, REVISED — now exports getTimeBucket as named export
VERIFIED FROM:  index.html option values confirmed
TASK:           T3.6 — COMPLETE (revised this conversation)
CHANGES:        getTimeBucket() is now a named ES module export so logger.js can import it.
                Global #time-of-day select is updated as a DISPLAY INDICATOR only.
                Per-card time-of-day selects in logger.js are the authoritative source
                for the timeOfDay value stored in each LogEntry.
```

### PURPOSE
```
PRIMARY:   Exports getTimeBucket(hour) so logger.js can auto-populate per-card selects.
SECONDARY: Updates global #time-of-day select in the header as a display indicator.
           The global select is NOT read during log saves.
```

### NAMED EXPORT
```javascript
export function getTimeBucket(hour)
// hour: integer 0–23
// returns: one of the TIME_OF_DAY_OPTIONS strings (see below)
// Used by: logger.js import { getTimeBucket } from './time-of-day.js'
```

### TIME BUCKET MAP (verified against index.html option values)
```javascript
hour 6–8        → 'Early Morning'
hour 9–11       → 'Morning'
hour 12         → 'Lunch'
hour 13–14      → 'Early Afternoon'
hour 15–16      → 'Afternoon'
hour 17–18      → 'Early Evening'
hour 19–20      → 'Evening'
hour 21–23, 0–5 → 'Late'
```

### TIME_OF_DAY_OPTIONS (complete list — order matches index.html)
```
'Early Morning' | 'Morning' | 'Lunch' | 'Early Afternoon' |
'Afternoon' | 'Early Evening' | 'Evening' | 'Late'
```

### TRIGGER
```
window 'app:ready' event — fires _updateGlobalSelect() once on startup
```

### DOM TARGET
```
#time-of-day — global <select> in header — DISPLAY INDICATOR only
select.dataset.autoSet — tracks last auto-set value to detect manual override
```

### MODULE INTERFACE
```javascript
window._timeOfDayModule = {
  refresh()              // re-runs global select update, respects manual override
  getBucket(hour)        // returns bucket string for hour 0–23
}
```


## MODULE: progressions-ui.js (T3.9)

```
FILE:           js/progressions-ui.js
SOURCE STATUS:  DELIVERED T3.9 — written against verified sources
VERIFIED FROM:  index.html, styles.css, progression.js, exercises.js — all confirmed
TASK:           T3.9 — COMPLETE
```

### PURPOSE
```
Renders one card per exercise (all 12, regardless of today's schedule) into
#progression-list. Each card shows the current level, description, and two
action buttons: Revert (go down one level) and Advance (go up one level).
Advance is disabled when at maxProgression; Revert is disabled when at level 0.
```

### IMPORTS
```javascript
import { getExerciseProgressionSummary, setLevel } from './progression.js';
import { showToast }                               from './ui.js';
import { EXERCISES }                               from './exercises.js';
```

### TRIGGER
```
window 'app:ready' CustomEvent — renders list on startup.
window._progressionsModule.refresh() — re-renders on nav tap.
```

### DOM TARGET
```
#progression-list  — injection container (verified in index.html)
                     role="list", class="exercise-list"
```

### CARD ELEMENT IDs (keyed by exerciseId)
```
#prog-card-{id}      — outer article element
#prog-chip-{id}      — level chip (updated in-place on advance/revert)
#prog-desc-{id}      — description paragraph (updated in-place)
#prog-advance-{id}   — Advance button
#prog-revert-{id}    — Revert button
```

### CSS CLASSES USED
```
.progression-card          — card wrapper
.prog-card-header          — flex row: name group (left) + level chip (right)
.prog-name-group           — flex column: displayName + frequency badge (NEW)
.prog-card-name            — exercise display name
.freq-badge                — base frequency badge
.freq-badge--daily/alt1/alt2
.prog-level-chip           — level indicator chip (blue when can advance)
.prog-level-chip--maxed    — modifier when at max or single-level (green)
.prog-description          — description text block
.prog-card-actions         — 2-column grid: Revert (1fr) + Advance (2fr) (NEW)
.btn-advance               — primary advance button
.btn-revert                — outlined revert button (NEW)
.empty-state               — fallback if EXERCISES is empty
```

### BEHAVIOR
```
All 12 exercises rendered in EXERCISES array order (Daily first, then Alt1, then Alt2).
On Advance click: calls setLevel(id, currentLevel + 1)
On Revert click:  calls setLevel(id, currentLevel - 1)
On success:       _refreshCard(id) updates chip, description, button states in-place.
On failure:       _refreshCard(id) restores prior state, showToast error shown.
Double-tap guard: _submitting Map prevents concurrent writes per card.
```

### MODULE INTERFACE
```javascript
window._progressionsModule = {
  refresh()   // Re-renders all cards from current window._app state.
              // Called by app.js nav wiring when user taps Progressions nav button.
}
```

### SCRIPT TAG (add to index.html)
```html
<script type="module" src="js/progressions-ui.js"></script>
```

---

```
PHASE 1 — Project Planning
  T1.x  All complete ✓

PHASE 2 — Core Modules
  T2.1  firebase-config.js    COMPLETE ✓
  T2.2  auth.js               COMPLETE ✓  (revised: Google Sign-In replacing anonymous)
  T2.3  firestore.js          COMPLETE ✓
  T2.4  exercises.js          COMPLETE ✓  (Walk type→'Minutes', defaultCount→20)
  T2.5  scheduler.js          COMPLETE ✓  (getDayNumber added for T3.3)
  T2.6  progression.js        COMPLETE ✓

PHASE 3 — UI Shell  ★ ALL TASKS COMPLETE ★
  T3.1   index.html + styles.css    COMPLETE ✓
  T3.2   ui.js                      COMPLETE ✓  (revised: screen-signin in ALL_SCREENS)
  T3.3   app.js                     COMPLETE ✓  (revised: Google Sign-In flow in Step 3)
  T3.4   bottom nav bar             COMPLETE ✓  (built into T3.1/T3.3)
  T3.5   exercise cards/logger      COMPLETE ✓  (in logger.js)
  T3.6   time-of-day.js             COMPLETE ✓  (named export; per-card selects)
  T3.7   log entry capture          COMPLETE ✓  (in logger.js)
  T3.8   edit/update log entry      COMPLETE ✓  (in logger.js)
  T3.9   progressions-ui.js         COMPLETE ✓
  T3.10  history.js                 COMPLETE ✓
  T3.11  table.css                  COMPLETE ✓  (built into T3.1)

PHASE 4 — Polish & Testing
  T4.1  Recovery day counter        COMPLETE ✓  (built in T3.3)
  T4.2  Completion indicator badge  COMPLETE ✓  (built in T3.2/T3.3)
  T4.3  Offline banner              COMPLETE ✓  (built in T3.2)
  T4.4  Firestore offline persist   COMPLETE ✓  (in firebase-config.js — persistentLocalCache)
  T4.5  Cross-browser testing       COMPLETE ✓  (Windows Edge + iPhone Safari confirmed)
  T4.6  Mobile layout review        IN PROGRESS
  T4.7  E2E functional test         IN PROGRESS
  T4.8  Bug fixes                   PENDING
  T4.9  README.md                   PENDING

  UNPLANNED: Google Sign-In replacing anonymous auth
             firebase-config.js, auth.js, app.js, ui.js, index.html, styles.css
             COMPLETE ✓ — cross-device sync confirmed working
```

---

## OPEN ITEMS

```
FS-OI-2   Repo visibility (public or private)    PENDING
FS-OI-3   Exact repo name capitalization         PENDING
SIGN-OUT  Sign-out button not yet added          PENDING — needed for account switching
```

### PENDING COMMITS (current session)
```
js/firebase-config.js        — GoogleAuthProvider import and provider export
js/auth.js                   — Google Sign-In replacing anonymous auth
js/app.js                    — waitForSignIn() and revised Step 3
js/ui.js                     — screen-signin added to ALL_SCREENS
index.html                   — #screen-signin screen + all script tags present
css/styles.css               — sign-in screen styles (.signin-inner, .btn-google-signin)
docs/module-api-reference.md — this document
```

### index.html SCRIPT TAGS (current state — verified)
```html
<script type="module" src="js/app.js"></script>
<script type="module" src="js/logger.js"></script>
<script type="module" src="js/history.js"></script>
<script type="module" src="js/time-of-day.js"></script>
<script type="module" src="js/progressions-ui.js"></script>
```

---
*Document last updated: 2026-03-07 (revision 4). Phase 3 complete. Phase 4 in progress.*
*Google Sign-In implemented and confirmed working across Windows Edge + iPhone Safari.*
*Next: sign-out button (T4.6 prerequisite), T4.9 README.md, then Phase 5.*
*When in doubt: ask the human to paste the current file. Do not infer.*