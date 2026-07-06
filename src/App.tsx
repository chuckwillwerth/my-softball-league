import { Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './firebaseConfig';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SchedulePage from './pages/SchedulePage';
import StandingsPage from './pages/StandingsPage';
import MyGamesPage from './pages/MyGamesPage';
import CityAdminPage from './pages/city/CityAdminPage';
import LeagueAdminPage from './pages/league/LeagueAdminPage';

function SetupRequired() {
  return (
    <div className="card mx-auto mt-16 max-w-lg">
      <h1 className="text-lg font-bold">Setup required</h1>
      <p className="mt-2 text-sm text-stone-600">
        This app is not connected to Firebase yet. Paste your Firebase web config into{' '}
        <code className="rounded bg-stone-100 px-1">src/firebaseConfig.ts</code> and redeploy, or
        run locally with <code className="rounded bg-stone-100 px-1">VITE_USE_EMULATORS=true</code>.
        See SETUP.md for the walkthrough.
      </p>
    </div>
  );
}

export default function App() {
  const { loading, isLeagueAdmin, isCityAdmin, coachTeamIds } = useAuth();

  if (!isConfigured) return <SetupRequired />;

  return (
    <Layout>
      {loading ? (
        <div className="py-16 text-center text-stone-500">Loading…</div>
      ) : (
        <Routes>
          <Route path="/" element={<SchedulePage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/my-games"
            element={coachTeamIds.length > 0 || isLeagueAdmin ? <MyGamesPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/city/*"
            element={isCityAdmin || isLeagueAdmin ? <CityAdminPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/league/*"
            element={isLeagueAdmin ? <LeagueAdminPage /> : <Navigate to="/login" />}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </Layout>
  );
}
