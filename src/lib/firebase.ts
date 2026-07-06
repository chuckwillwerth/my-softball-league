import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

const app = initializeApp(
  useEmulators
    ? { apiKey: 'demo', authDomain: 'demo-softball.firebaseapp.com', projectId: 'demo-softball' }
    : firebaseConfig,
);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // Dev convenience: sign in as any email from the browser console, e.g.
  //   devSignIn('chuckwillwerth@gmail.com')
  (window as unknown as Record<string, unknown>).devSignIn = (email: string) =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })),
    );
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
