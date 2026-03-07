// Firebase configuration — initialises Firebase app, exports auth and db instances.
// IMPORTANT: Placeholder values below are replaced at deploy time by GitHub Actions.
// Never replace placeholders with real values in this file.

import { initializeApp }                    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeFirestore,
         persistentLocalCache }             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "__FIREBASE_API_KEY__",
  authDomain:        "__FIREBASE_AUTH_DOMAIN__",
  projectId:         "__FIREBASE_PROJECT_ID__",
  storageBucket:     "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__FIREBASE_APP_ID__"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// v10 persistent local cache (replaces deprecated enableIndexedDbPersistence)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export { auth, db, provider };