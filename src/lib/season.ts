import { limit, where } from 'firebase/firestore';
import { useCol } from './hooks';
import type { Season } from './types';

/** The single active season, or null while loading / when none exists. */
export function useActiveSeason(): Season | null {
  const { data } = useCol<Season>('seasons', () => [where('active', '==', true), limit(1)], []);
  return data?.[0] ?? null;
}
