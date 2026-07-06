import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { CoachIndex, RoleDoc } from '../lib/types';

export interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  isLeagueAdmin: boolean;
  isCityAdmin: boolean;
  /** City the user administers (city admins only). */
  cityId: string | null;
  /** Teams the user coaches (email appears in contacts). */
  coachTeamIds: string[];
}

const EMPTY: AuthState = {
  user: null,
  email: null,
  loading: true,
  isLeagueAdmin: false,
  isCityAdmin: false,
  cityId: null,
  coachTeamIds: [],
};

const AuthContext = createContext<AuthState>(EMPTY);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setState({ ...EMPTY, loading: false });
        return;
      }
      const email = user.email.toLowerCase();
      try {
        const [roleSnap, coachSnap] = await Promise.all([
          getDoc(doc(db, 'roles', email)),
          getDoc(doc(db, 'coachIndex', email)),
        ]);
        const role = roleSnap.exists() ? (roleSnap.data() as RoleDoc) : null;
        const coach = coachSnap.exists() ? (coachSnap.data() as CoachIndex) : null;
        setState({
          user,
          email,
          loading: false,
          isLeagueAdmin: role?.role === 'league_admin',
          isCityAdmin: role?.role === 'city_admin',
          cityId: role?.cityId ?? null,
          coachTeamIds: coach?.teamIds ?? [],
        });
      } catch (err) {
        console.error('Failed to load role for', email, err);
        setState({ ...EMPTY, user, email, loading: false });
      }
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
