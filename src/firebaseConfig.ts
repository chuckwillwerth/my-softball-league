// Paste your Firebase web app config here (Firebase console -> Project settings
// -> Your apps -> SDK setup and configuration). These values are safe to commit;
// they identify the project but grant no access — Firestore security rules do that.
//
// See SETUP.md for step-by-step instructions.
export const firebaseConfig = {
  apiKey: 'PASTE_ME',
  authDomain: 'PASTE_ME.firebaseapp.com',
  projectId: 'PASTE_ME',
  storageBucket: 'PASTE_ME.firebasestorage.app',
  messagingSenderId: 'PASTE_ME',
  appId: 'PASTE_ME',
};

export const isConfigured =
  firebaseConfig.apiKey !== 'PASTE_ME' || import.meta.env.VITE_USE_EMULATORS === 'true';
