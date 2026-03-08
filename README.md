# PostOp Exercise Tracker

A mobile-first progressive web app for tracking post-operative hip replacement rehabilitation exercises. Patients log daily exercises, track progression levels, and view 30 days of history. Data is stored in Firebase Firestore and syncs across devices via Google Sign-In.

**Live app:** https://perelgut.github.io/postopExerciseTracker/

---

## Features

- 12 prescribed exercises (daily, Alt1, Alt2 schedules)
- Per-exercise progression levels with Advance / Revert controls
- Multiple sessions per exercise per day (Add Session)
- 30-day scrollable history table
- Offline support via Firestore persistent cache
- Cross-device sync via Google account
- Recovery day counter (Day N from surgery date)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 · CSS3 · Vanilla JavaScript (ES Modules) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions (`deploy.yml`) |

---

## Repository Structure

```
postopExerciseTracker/
├── index.html              # App shell — all screens defined here
├── css/
│   ├── styles.css          # Main styles, exercise cards, buttons
│   └── table.css           # History table layout
├── js/
│   ├── app.js              # Startup sequence, global state, nav wiring
│   ├── auth.js             # Google Sign-In (Firebase Auth)
│   ├── exercises.js        # Exercise definitions, progressions, descriptions
│   ├── firebase-config.js  # Firebase SDK init, Firestore, Auth provider
│   ├── firestore.js        # All Firestore read/write functions
│   ├── history.js          # 30-day history table renderer
│   ├── logger.js           # Exercise card renderer, Log / Add Session
│   ├── progression.js      # Progression read/write, max level guard
│   ├── progressions-ui.js  # Progressions screen (Advance / Revert cards)
│   ├── scheduler.js        # Exercise scheduling (daily / Alt1 / Alt2)
│   └── time-of-day.js      # Time-of-day bucket detection and selector
└── docs/
    ├── module-api-reference.md   # Full module API, data shapes, flow docs
    ├── PostOp_TaskTracker.html   # Interactive project task tracker
    └── [project planning docs]
```

---

## Deploying a New Instance

### Prerequisites

- A Google account
- A GitHub account
- Node.js not required — this is a plain HTML/CSS/JS project

### Step 1 — Fork or clone the repository

```bash
git clone https://github.com/perelgut/postopExerciseTracker.git
cd postopExerciseTracker
```

### Step 2 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `postop-tracker`)
3. Disable Google Analytics (not needed) → **Create project**

### Step 3 — Enable Google Sign-In

1. In the Firebase console: **Authentication** → **Sign-in method**
2. Click **Google** → toggle **Enable**
3. Set a **support email** (required by Google)
4. Click **Save**

### Step 4 — Create the Firestore database

1. **Firestore Database** → **Create database**
2. Choose **Start in production mode**
3. Select region: `northamerica-northeast2` (Toronto) or your preferred region
4. Click **Enable**

### Step 5 — Apply Firestore security rules

In **Firestore → Rules**, replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Click **Publish**.

### Step 6 — Get your Firebase config

1. **Project Settings** (gear icon) → **General** → **Your apps**
2. Click **Add app** → choose **Web** (`</>`)
3. Register app (no Firebase Hosting needed)
4. Copy the `firebaseConfig` object — you need these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Step 7 — Add Firebase config as GitHub Secrets

In your GitHub repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add one secret for each config value:

| Secret name | Firebase config field |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

### Step 8 — Add your GitHub Pages domain to Firebase Auth

Firebase requires your deployment domain to be explicitly authorized.

1. **Authentication** → **Settings** → **Authorized domains**
2. Click **Add domain**
3. Enter: `your-github-username.github.io`

### Step 9 — Enable GitHub Pages

1. **Settings** → **Pages**
2. Source: **GitHub Actions**

### Step 10 — Push and deploy

```bash
git push origin main
```

The `deploy.yml` workflow will:
1. Inject your Firebase secrets into `js/firebase-config.js`
2. Deploy to GitHub Pages

Watch the deployment at **Actions** → the latest workflow run. When it goes green, your app is live at:

```
https://your-github-username.github.io/postopExerciseTracker/
```

---

## How the deploy workflow works

`.github/workflows/deploy.yml` uses `sed` to replace placeholder tokens in `js/firebase-config.js` with the actual secret values before deploying. The file committed to the repository contains `__FIREBASE_API_KEY__`-style placeholders — **actual keys are never committed**.

---

## Adding a new patient

Each Google account gets its own isolated data partition in Firestore under `/users/{uid}/`. A new patient simply signs in with their Google account and enters their surgery date on first launch. No admin steps required.

---

## Data model

```
/users/{uid}/
  profile                     — { day1: 'YYYY-MM-DD' }
  progressions                — { [exerciseId]: level }
  logs/
    {dateStr}/                — 'YYYY-MM-DD'
      entries: LogEntry[]     — array, one entry per exercise session
```

A `LogEntry` contains:
```javascript
{
  exerciseId:       number,   // matches id in exercises.js
  progressionLevel: number,   // level at time of logging
  timeOfDay:        string,   // 'Morning', 'Afternoon', etc.
  count:            number,   // reps, seconds, or minutes depending on type
  repeats:          number,   // number of sets
  loggedAt:         string,   // ISO 8601 timestamp
}
```

---

## Exercise schedule

| Exercise | ID | Frequency | Type |
|---|---|---|---|
| Walk | 0 | Daily | Minutes |
| Bridge | 7 | Alt1 (Mon/Wed/Fri) | Rep |
| Clam Shell | 8 | Alt1 | Rep |
| Hip Flexor Strengthening | 9 | Daily | Rep |
| Standing Hip Abduction | 10 | Alt2 (Tue/Thu/Sat) | Rep |
| Squat | 11 | Alt2 | Rep |
| Crab Walk | 12 | Alt2 | Rep |
| Standing Leg Abductor | 13 | Alt2 | Rep |
| Marching in Place | 14 | Daily | Rep |
| Hip Bending Stretch | 15 | Daily | Time |
| Hip Flexor Stretch | 16 | Daily | Time |
| Seated Hamstring Stretch | 17 | Daily | Time |

Alt1 = Monday / Wednesday / Friday  
Alt2 = Tuesday / Thursday / Saturday

---

## Developer notes

- All modules are ES Modules (`type="module"`) — no bundler required
- `window._app` is the single global state object, owned by `app.js`
- `window._loggerModule`, `window._historyModule`, `window._progressionsModule` expose `refresh()` for nav wiring
- Firestore uses `persistentLocalCache` for offline support — the app functions without a network connection after first load
- See `docs/module-api-reference.md` for full API documentation, data shapes, and flow diagrams

---

## Known limitations

- Single patient per Google account (no family / therapist multi-patient view)
- No server-side validation — security relies entirely on Firestore rules
- Exercise list and schedule are hardcoded in `exercises.js` — changes require a code deployment
- COOP warnings may appear in the browser console when the Google Sign-In popup closes — these are harmless and expected on GitHub Pages

---

## License

Private — not licensed for redistribution.