import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLeagueData } from '../../lib/leagueData';
import FieldsTab from './FieldsTab';
import TeamsTab from './TeamsTab';

export default function CityAdminPage() {
  const data = useLeagueData();
  const { isLeagueAdmin, cityId: myCityId } = useAuth();
  const [tab, setTab] = useState<'fields' | 'teams'>('fields');
  const [pickedCityId, setPickedCityId] = useState('');

  // City admins are locked to their city; league admins pick one.
  const cityId = isLeagueAdmin && !myCityId ? pickedCityId || data.cities[0]?.id || '' : myCityId ?? '';

  if (!data.season) {
    return (
      <p className="py-16 text-center text-stone-500">
        No active season yet. The league administrator needs to create one first.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">City Admin</h1>
        {isLeagueAdmin && !myCityId ? (
          <select className="input w-48" value={cityId} onChange={(e) => setPickedCityId(e.target.value)}>
            {data.cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="badge bg-emerald-100 text-emerald-800">{data.cityName(cityId)}</span>
        )}
        <div className="ml-auto flex gap-1.5">
          <button className={`chip ${tab === 'fields' ? 'chip-on' : ''}`} onClick={() => setTab('fields')}>
            Fields &amp; Permits
          </button>
          <button className={`chip ${tab === 'teams' ? 'chip-on' : ''}`} onClick={() => setTab('teams')}>
            Teams &amp; Coaches
          </button>
        </div>
      </div>

      {!cityId ? (
        <p className="py-16 text-center text-stone-500">
          No cities exist yet — the league administrator adds them under League Admin.
        </p>
      ) : tab === 'fields' ? (
        <FieldsTab cityId={cityId} data={data} />
      ) : (
        <TeamsTab cityId={cityId} data={data} />
      )}
    </div>
  );
}
