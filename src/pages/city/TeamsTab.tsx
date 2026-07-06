import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { deleteContact, newId, removeDoc, saveContact, saveDoc } from '../../lib/db';
import { useCol } from '../../lib/hooks';
import type { Contact, DayName, Division, Team } from '../../lib/types';
import type { LeagueData } from '../../lib/leagueData';
import DayChips from '../../components/DayChips';

interface ContactDraft {
  name: string;
  email: string;
  phone: string;
}

const EMPTY_CONTACT: ContactDraft = { name: '', email: '', phone: '' };

function TeamCard({
  team,
  division,
  contacts,
  data,
}: {
  team: Team;
  division: Division;
  contacts: Contact[];
  data: LeagueData;
}) {
  const head = contacts.find((c) => c.role === 'head');
  const assistant = contacts.find((c) => c.role === 'assistant');

  const [name, setName] = useState(team.name);
  const [classification, setClassification] = useState<'A' | 'B' | null>(team.classification);
  const [preferredDays, setPreferredDays] = useState<DayName[]>(team.preferredDays ?? []);
  const [headDraft, setHeadDraft] = useState<ContactDraft>(EMPTY_CONTACT);
  const [assistantDraft, setAssistantDraft] = useState<ContactDraft>(EMPTY_CONTACT);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeadDraft(head ? { name: head.name, email: head.email, phone: head.phone } : EMPTY_CONTACT);
  }, [head]);
  useEffect(() => {
    setAssistantDraft(
      assistant ? { name: assistant.name, email: assistant.email, phone: assistant.phone } : EMPTY_CONTACT,
    );
  }, [assistant]);

  const saveCoach = async (role: 'head' | 'assistant', draft: ContactDraft, existing?: Contact) => {
    const id = `${team.id}-${role}`;
    if (!draft.email.trim()) {
      if (existing) await deleteContact(existing);
      return;
    }
    // If the email changed, clear the old coach's access first.
    if (existing && existing.email !== draft.email.trim().toLowerCase()) await deleteContact(existing);
    await saveContact({
      id,
      teamId: team.id,
      cityId: team.cityId,
      role,
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveDoc('teams', team.id, {
        seasonId: team.seasonId,
        divisionId: team.divisionId,
        cityId: team.cityId,
        name: name.trim(),
        classification: division.classificationEnabled ? classification : null,
        preferredDays: division.allowedDays === null ? preferredDays : null,
      });
      await saveCoach('head', headDraft, head);
      await saveCoach('assistant', assistantDraft, assistant);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (data.games.some((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)) {
      alert('This team has games on the schedule. Ask the league administrator to remove them first.');
      return;
    }
    if (!window.confirm(`Delete ${team.name}?`)) return;
    if (head) await deleteContact(head);
    if (assistant) await deleteContact(assistant);
    await removeDoc('teams', team.id);
  };

  const contactRow = (label: string, draft: ContactDraft, set: (d: ContactDraft) => void) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr_1fr_10rem]">
      <span className="self-center text-sm font-medium text-stone-600">{label}</span>
      <input className="input" placeholder="Name" value={draft.name} onChange={(e) => set({ ...draft, name: e.target.value })} />
      <input className="input" placeholder="Email" type="email" value={draft.email} onChange={(e) => set({ ...draft, email: e.target.value })} />
      <input className="input" placeholder="Phone" type="tel" value={draft.phone} onChange={(e) => set({ ...draft, phone: e.target.value })} />
    </div>
  );

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input !w-56 font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
        {division.classificationEnabled && (
          <span className="flex gap-1.5">
            {(['A', 'B'] as const).map((c) => (
              <button
                key={c}
                className={`chip ${classification === c ? 'chip-on' : ''}`}
                onClick={() => setClassification(classification === c ? null : c)}
                title={`Classify as ${c} team`}
              >
                {c}
              </button>
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          <button className="btn-primary" onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-danger" onClick={() => void del()}>Delete</button>
        </span>
      </div>

      {division.allowedDays === null && (
        <div className="mt-3">
          <label className="label">Preferred game days (used by the scheduler)</label>
          <DayChips value={preferredDays} onChange={setPreferredDays} />
        </div>
      )}

      <div className="mt-3 space-y-2">
        {contactRow('Head coach', headDraft, setHeadDraft)}
        {contactRow('Assistant', assistantDraft, setAssistantDraft)}
        <p className="text-xs text-stone-400">
          Coaches sign in with these email addresses (Google account) to report scores.
        </p>
      </div>
    </div>
  );
}

export default function TeamsTab({ cityId, data }: { cityId: string; data: LeagueData }) {
  const [divisionId, setDivisionId] = useState('');
  const [newName, setNewName] = useState('');
  const division = data.divisions.find((d) => d.id === divisionId) ?? data.divisions[0] ?? null;

  const contacts = useCol<Contact>('contacts', () => [where('cityId', '==', cityId)], [cityId]);

  if (!division) {
    return (
      <p className="py-16 text-center text-stone-500">
        No divisions yet — the league administrator creates them under League Admin.
      </p>
    );
  }

  const teams = data.teams.filter((t) => t.cityId === cityId && t.divisionId === division.id);

  const addTeam = async () => {
    if (!newName.trim() || !data.season) return;
    await saveDoc('teams', newId('teams'), {
      seasonId: data.season.id,
      divisionId: division.id,
      cityId,
      name: newName.trim(),
      classification: null,
      preferredDays: null,
    });
    setNewName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {data.divisions.map((d) => (
            <button key={d.id} className={`chip ${division.id === d.id ? 'chip-on' : ''}`} onClick={() => setDivisionId(d.id)}>
              {d.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <input
            className="input !w-56"
            placeholder={`New ${division.name} team name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addTeam()}
          />
          <button className="btn-primary" onClick={() => void addTeam()} disabled={!newName.trim()}>
            Add team
          </button>
        </div>
      </div>

      {teams.map((t) => (
        <TeamCard
          key={t.id}
          team={t}
          division={division}
          contacts={(contacts.data ?? []).filter((c) => c.teamId === t.id)}
          data={data}
        />
      ))}
      {teams.length === 0 && (
        <p className="py-8 text-center text-stone-500">No {division.name} teams for this city yet.</p>
      )}
    </div>
  );
}
