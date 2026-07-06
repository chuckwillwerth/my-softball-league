import { useState } from 'react';
import { removeDoc, saveDoc } from '../../lib/db';
import { useCol } from '../../lib/hooks';
import type { RoleDoc } from '../../lib/types';
import type { LeagueData } from '../../lib/leagueData';
import { useAuth } from '../../context/AuthContext';

type RoleRow = RoleDoc & { id: string };

export default function RolesTab({ data }: { data: LeagueData }) {
  const { email: myEmail } = useAuth();
  const roles = useCol<RoleRow>('roles', () => [], []);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'league_admin' | 'city_admin'>('city_admin');
  const [cityId, setCityId] = useState('');

  const add = async () => {
    const id = email.trim().toLowerCase();
    if (!id.includes('@')) return;
    await saveDoc('roles', id, role === 'city_admin' ? { role, cityId } : { role });
    setEmail('');
  };

  const del = async (r: RoleRow) => {
    if (r.id === myEmail) {
      alert("You can't remove your own league admin role.");
      return;
    }
    if (window.confirm(`Remove ${r.id}'s ${r.role.replace('_', ' ')} role?`)) await removeDoc('roles', r.id);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card">
        <h2 className="mb-1 font-semibold">Grant a role</h2>
        <p className="mb-3 text-xs text-stone-500">
          The person signs in with Google using this email address. Coaches don't need a role here
          — they get access automatically when a city admin lists them as a team contact.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="city_admin">City admin</option>
              <option value="league_admin">League admin</option>
            </select>
          </div>
          {role === 'city_admin' && (
            <div>
              <label className="label">City</label>
              <select className="input" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                <option value="">Choose…</option>
                {data.cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-primary" onClick={() => void add()} disabled={!email.includes('@') || (role === 'city_admin' && !cityId)}>
            Grant
          </button>
        </div>
      </div>

      <div className="card !p-0">
        <div className="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold">Current roles</div>
        {(roles.data ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-stone-100 px-3 py-2 last:border-b-0">
            <span className="text-sm font-medium">{r.id}</span>
            <span className={`badge ${r.role === 'league_admin' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
              {r.role.replace('_', ' ')}
            </span>
            {r.cityId && <span className="text-sm text-stone-500">{data.cityName(r.cityId)}</span>}
            <button className="btn-ghost ml-auto !text-red-600" onClick={() => void del(r)}>Remove</button>
          </div>
        ))}
        {roles.data?.length === 0 && <p className="px-3 py-4 text-sm text-stone-500">No roles yet.</p>}
      </div>
    </div>
  );
}
