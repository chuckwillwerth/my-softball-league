import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../lib/firebase';

export default function LoginPage() {
  const { user, isLeagueAdmin, isCityAdmin, coachTeamIds } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (user) {
    if (isLeagueAdmin) return <Navigate to="/league" />;
    if (isCityAdmin) return <Navigate to="/city" />;
    if (coachTeamIds.length > 0) return <Navigate to="/my-games" />;
    return (
      <div className="mx-auto mt-16 max-w-md card text-center">
        <h1 className="text-lg font-bold">Signed in</h1>
        <p className="mt-2 text-sm text-stone-600">
          Your account ({user.email}) isn't linked to a coach or admin role yet. Ask your city
          administrator to add you as a coach contact, or the league administrator to grant you a
          role. You can still browse the schedule and standings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-md card text-center">
      <h1 className="text-xl font-bold">Coach &amp; Admin Sign-in</h1>
      <p className="mt-2 text-sm text-stone-600">
        Schedules and standings are public — signing in is only needed to report scores or manage
        the league.
      </p>
      <button
        className="btn-primary mt-6 w-full justify-center py-2.5"
        onClick={() => {
          setError(null);
          signInWithGoogle().catch((e: Error) => setError(e.message));
        }}
      >
        Sign in with Google
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
