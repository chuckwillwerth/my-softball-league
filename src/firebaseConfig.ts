// Paste your Firebase web app config here (Firebase console -> Project settings
// -> Your apps -> SDK setup and configuration). These values are safe to commit;
// they identify the project but grant no access — Firestore security rules do that.
//
// See SETUP.md for step-by-step instructions.
export const firebaseConfig = {
  apiKey: "AIzaSyDcg2pPlSGKRCpTSR9IJgwwF-pTtZnC1ds",
  authDomain: "my-softball-league.firebaseapp.com",
  projectId: "my-softball-league",
  storageBucket: "my-softball-league.firebasestorage.app",
  messagingSenderId: "529658512661",
  appId: "1:529658512661:web:5c4d5420bdcbcd13e7151c"
};

export const isConfigured =
  firebaseConfig.apiKey !== 'AIzaSyDcg2pPlSGKRCpTSR9IJgwwF-pTtZnC1ds' || import.meta.env.VITE_USE_EMULATORS === 'true';
