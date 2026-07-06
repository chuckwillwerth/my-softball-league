import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOutUser } from '../lib/firebase';

function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-emerald-800 text-white' : 'text-emerald-100 hover:bg-emerald-800/60'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, email, isLeagueAdmin, isCityAdmin, coachTeamIds } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="bg-emerald-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-bold text-white">🥎 League Central</span>
          <nav className="flex flex-wrap items-center gap-1">
            <Tab to="/">Schedule</Tab>
            <Tab to="/standings">Standings</Tab>
            {(coachTeamIds.length > 0 || isLeagueAdmin) && <Tab to="/my-games">My Games</Tab>}
            {(isCityAdmin || isLeagueAdmin) && <Tab to="/city">City Admin</Tab>}
            {isLeagueAdmin && <Tab to="/league">League Admin</Tab>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-xs text-emerald-200 sm:inline">{email}</span>
                <button onClick={() => void signOutUser()} className="btn-ghost !text-emerald-100 hover:!bg-emerald-800/60">
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="btn-ghost !text-emerald-100 hover:!bg-emerald-800/60">
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
