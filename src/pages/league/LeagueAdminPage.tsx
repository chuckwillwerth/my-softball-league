import { useState } from 'react';
import { useLeagueData } from '../../lib/leagueData';
import SetupTab from './SetupTab';
import RolesTab from './RolesTab';
import SchedulerTab from './SchedulerTab';

const TABS = [
  { key: 'setup', label: 'Season Setup' },
  { key: 'roles', label: 'Admins & Roles' },
  { key: 'scheduler', label: 'Generate Schedule' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function LeagueAdminPage() {
  const data = useLeagueData();
  const [tab, setTab] = useState<TabKey>('setup');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold">League Admin</h1>
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button key={t.key} className={`chip ${tab === t.key ? 'chip-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'setup' && <SetupTab data={data} />}
      {tab === 'roles' && <RolesTab data={data} />}
      {tab === 'scheduler' && <SchedulerTab data={data} />}
    </div>
  );
}
